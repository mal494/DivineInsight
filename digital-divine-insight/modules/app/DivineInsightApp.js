import { DragController } from '../components/DragController.js';
import { CardView } from '../components/CardView.js';
import { AmbientEngine } from '../audio/ambientEngine.js';
import { STATUS_MESSAGES, JOURNAL_MESSAGES } from '../content/messages.js';
import { updateParticleTheme, createBurst, initParticleSystem } from '../assets/fx/particles.js';

/**
 * Valid states for the DivineInsightApp.
 * @readonly
 * @enum {string}
 */
const APP_STATES = Object.freeze({
    BOOTING: 'booting',
    IDLE: 'idle',
    CHANNELING: 'channeling',
    REVEALED: 'revealed',
    ERROR: 'error'
});

/**
 * Valid state transitions to prevent illegal state changes.
 * Defines which states can transition to which next states.
 * @type {Record<string, string[]>}
 */
const VALID_TRANSITIONS = Object.freeze({
    [APP_STATES.BOOTING]: [APP_STATES.IDLE, APP_STATES.ERROR],
    [APP_STATES.IDLE]: [APP_STATES.CHANNELING, APP_STATES.ERROR],
    [APP_STATES.CHANNELING]: [APP_STATES.REVEALED, APP_STATES.IDLE, APP_STATES.ERROR],
    [APP_STATES.REVEALED]: [APP_STATES.IDLE, APP_STATES.CHANNELING, APP_STATES.ERROR],
    [APP_STATES.ERROR]: [APP_STATES.IDLE] // Must reset to go back to IDLE
});

const DRAW_RESULT_SCHEMA_VERSION = 1;
const JOURNAL_KEY = 'divine_readings';
const MAX_JOURNAL_ENTRIES = 50;

/**
 * Main application orchestrator for Divine Insight.
 * Handles state management, UI component coordination, worker communication, and audio integration.
 */
export class DivineInsightApp {
    constructor() {
        this.deckDataText = null;
        this.logicWorker = null;
        this.workerReady = false;
        this.audioReady = false;
        this.pendingDraw = false;
        this.appState = APP_STATES.BOOTING;
        this._lastBurstAt = 0;

        this.cardView = new CardView();
        this.ambientEngine = new AmbientEngine();

        const cardElement = document.getElementById('tarot-card');
        this.dragController = new DragController(cardElement, this.handleInteraction.bind(this));
    }

    /**
     * Bootstraps the application, loads the deck, sets up workers and audio.
     * Transitions state from BOOTING to IDLE on success, or ERROR on failure.
     * @returns {Promise<void>}
     */
    async initialize() {
        this.setState(APP_STATES.BOOTING);
        this.bindGlobalStatusEvents();
        this.bindEvents();

        try {
            const response = await fetch('divine-insight-optimized.json');
            if (!response.ok) throw new Error(`Deck fetch failed with status ${response.status}`);
            
            this.deckDataText = await response.text();
            const parsed = JSON.parse(this.deckDataText);

            const cards = parsed.cards || (parsed.deck && parsed.deck.arcana
                ? [...parsed.deck.arcana.major, ...Object.values(parsed.deck.arcana.minor).flat()]
                : []);
            const keys = cards.map(c => c.key || c.id).filter(Boolean);
            this.cardView.setDeckImages(keys);

            initParticleSystem('starfield');

            this.setupLogicWorker();
            await this.setupAudio();

            this.setState(APP_STATES.IDLE);
            this.setStatus(STATUS_MESSAGES.READY);
        } catch (error) {
            this.setError(error?.message || 'Failed to initialize system.');
        }
    }

    /**
     * Initializes the background worker for draw logic calculation.
     * @private
     */
    setupLogicWorker() {
        this.logicWorker = new Worker(new URL('../logic-worker.js', import.meta.url));
        this.logicWorker.onmessage = this.handleWorkerResponse.bind(this);
        this.logicWorker.onerror = (error) => {
            this.setError(`Logic engine error: ${error.message || 'unknown worker failure'}`);
        };
        this.logicWorker.onmessageerror = () => {
            this.setError('Logic engine sent an unreadable message.');
        };
        
        // Kick off deck initialization in worker
        this.logicWorker.postMessage({ type: 'INIT_DECK', payload: this.deckDataText });
    }

    /**
     * Sets up the ambient audio engine.
     * @private
     * @returns {Promise<void>}
     */
    async setupAudio() {
        await this.ambientEngine.init({
            baseEl: document.getElementById('audio-base'),
            swooshEl: document.getElementById('audio-swoosh'),
            sfxHover: document.getElementById('audio-hover'),
            sfxDraw: document.getElementById('audio-draw'),
            sfxFlip: document.getElementById('audio-flip')
        });
        this.audioReady = true;
    }

    /**
     * Listens for globally dispatched app status and error events.
     * @private
     */
    bindGlobalStatusEvents() {
        window.addEventListener('app:error', (event) => {
            this.setError(event?.detail || 'An unexpected error occurred.');
        });

        window.addEventListener('app:status', (event) => {
            const message = event?.detail;
            if (message) this.setStatus(message);
        });
    }

    /**
     * Binds DOM event listeners for UI interaction.
     * @private
     */
    bindEvents() {
        const seekBtn = document.getElementById('btn-seek-insight');
        const intentInput = document.getElementById('intent-input');
        const cardElement = document.getElementById('tarot-card');
        const deckStack = document.querySelector('.group.float-animation');
        const resetBtn = document.getElementById('btn-reset-altar');
        const pastReadingsBtn = document.getElementById('btn-past-readings');
        const journalPanel = document.getElementById('journal-panel');
        const closeJournalBtn = document.getElementById('btn-close-journal');
        const clearJournalBtn = document.getElementById('btn-clear-journal');

        if (seekBtn) {
            seekBtn.addEventListener('click', () => {
                const intentText = intentInput?.value || '';
                const currentVelocity = this.dragController?.inputState?.velocity || 1.0;
                this.requestDraw(intentText, currentVelocity);
            });
        }

        if (intentInput) {
            intentInput.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const currentVelocity = this.dragController?.inputState?.velocity || 1.0;
                this.requestDraw(intentInput.value || '', currentVelocity);
            });
        }

        if (resetBtn) resetBtn.addEventListener('click', () => this.resetAltar());
        if (pastReadingsBtn) pastReadingsBtn.addEventListener('click', () => this.showJournal());
        if (closeJournalBtn) closeJournalBtn.addEventListener('click', () => this.hideJournal());
        if (clearJournalBtn) clearJournalBtn.addEventListener('click', () => this.clearJournal());

        if (journalPanel) {
            journalPanel.addEventListener('click', (event) => {
                if (event.target === journalPanel) this.hideJournal();
            });
        }

        [cardElement, deckStack].forEach(el => {
            if (!el) return;
            el.addEventListener('mouseenter', () => this.ambientEngine.playEffect('hover'));
        });
    }

    /**
     * Centralized state transition method. 
     * Ensures we only perform valid state changes and updates dependents.
     * @param {string} nextState - The state to transition to (must be from APP_STATES)
     */
    setState(nextState) {
        // Enforce valid transitions
        const allowedTransitions = VALID_TRANSITIONS[this.appState];
        if (!allowedTransitions.includes(nextState) && this.appState !== nextState) {
            console.warn(`[StateEngine] Illegal transition attempt from ${this.appState} to ${nextState}.`);
            return;
        }

        this.appState = nextState;
        this.pendingDraw = nextState === APP_STATES.CHANNELING;
        
        // Notify UI layer of state changes
        this.cardView.setUiState({ state: nextState });
    }

    /**
     * Updates the status bar UI.
     * @param {string} message - The status message to display.
     */
    setStatus(message) {
        this.cardView.setStatus(message, { isError: false });
    }

    /**
     * Handles error reporting, transitioning to the ERROR state and notifying the user.
     * @param {string} message - The error message.
     */
    setError(message) {
        console.error('[DivineInsightApp] Error:', message);
        this.setState(APP_STATES.ERROR);
        this.cardView.setStatus(message, { isError: true });
    }

    /**
     * Resets the application state to prepare for a new reading.
     */
    resetAltar() {
        this.cardView.resetCard();
        this.ambientEngine.transitionTo('passive');
        updateParticleTheme('balance');
        
        const intentInput = document.getElementById('intent-input');
        if (intentInput) intentInput.value = '';
        
        // If coming from error, reset allows returning to IDLE
        this.setState(APP_STATES.IDLE);
        this.setStatus(STATUS_MESSAGES.READY);
    }

    /**
     * Reads the reading history from local storage.
     * @returns {Array<Object>} List of past readings.
     */
    readJournal() {
        try {
            const parsed = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(Boolean).slice(0, MAX_JOURNAL_ENTRIES);
        } catch (error) {
            console.warn('Failed to parse journal, resetting store:', error);
            return [];
        }
    }

    /**
     * Writes the reading history to local storage.
     * @param {Array<Object>} entries - List of entries to store.
     */
    writeJournal(entries) {
        try {
            const normalized = Array.isArray(entries) ? entries.slice(0, MAX_JOURNAL_ENTRIES) : [];
            localStorage.setItem(JOURNAL_KEY, JSON.stringify(normalized));
        } catch (error) {
            this.setStatus(STATUS_MESSAGES.STORAGE_UNAVAILABLE);
        }
    }

    /**
     * Opens the journal UI panel and populates the reading list.
     */
    showJournal() {
        const panel = document.getElementById('journal-panel');
        const list = document.getElementById('journal-list');
        if (!panel || !list) return;

        const readings = this.readJournal();
        list.innerHTML = '';

        if (readings.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'text-moon-silver/60 text-sm';
            empty.innerText = JOURNAL_MESSAGES.EMPTY;
            list.appendChild(empty);
        } else {
            readings.forEach((entry) => {
                const li = document.createElement('li');
                li.className = 'rounded-lg border border-moon-silver/15 bg-white/5 p-3';
                const date = entry.date ? new Date(entry.date).toLocaleString() : JOURNAL_MESSAGES.UNKNOWN_DATE;
                li.innerHTML = `<div class="font-semibold text-ethereal-teal">${entry.cardName || JOURNAL_MESSAGES.UNKNOWN_CARD} (${entry.orientation || 'upright'})</div>
<div class="text-moon-silver/70 text-xs mt-1">${date}</div>
<div class="text-moon-silver/60 text-xs mt-1">Axis: ${entry.dominantAxis || JOURNAL_MESSAGES.UNKNOWN_AXIS}</div>`;
                list.appendChild(li);
            });
        }

        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
    }

    /**
     * Closes the journal UI panel.
     */
    hideJournal() {
        const panel = document.getElementById('journal-panel');
        if (!panel) return;
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
    }

    /**
     * Clears all reading history from local storage.
     */
    clearJournal() {
        this.writeJournal([]);
        this.showJournal();
        this.setStatus(STATUS_MESSAGES.JOURNAL_CLEARED);
    }

    /**
     * Appends a new reading result to the journal.
     * @param {Object} result - The draw result from the logic worker.
     */
    saveToJournal(result) {
        const readings = this.readJournal();
        const entry = {
            id: Date.now(),
            date: new Date().toISOString(),
            cardName: result.cardName,
            orientation: result.orientation,
            dominantAxis: this._getDominantAxis(result.localWeights)
        };
        readings.unshift(entry);
        this.writeJournal(readings);
    }

    /**
     * Calculates the dominant elemental axis from the draw weights.
     * @private
     * @param {Object} weights - Map of elemental weights.
     * @returns {string} The dominant elemental axis (e.g. 'fire', 'water')
     */
    _getDominantAxis(weights) {
        if (!weights || typeof weights !== 'object') return 'balance';
        const keys = Object.keys(weights);
        if (!keys.length) return 'balance';
        return keys.reduce((a, b) => (weights[a] > weights[b] ? a : b));
    }

    /**
     * Handles pointer interaction events passed up from DragController.
     * @param {Object} event - Interaction event payload.
     */
    handleInteraction(event) {
        if (!event || this.appState === APP_STATES.ERROR) return;

        switch (event.type) {
            case 'HIGH_VELOCITY':
                this.ambientEngine.adjustHum(event.value);
                break;
            case 'MOUSE_MOVE':
                this.cardView.updateMousePos(event.x, event.y);
                break;
            case 'DRAG_START':
                this.cardView.setDragging(true);
                break;
            case 'DRAG_END':
                this.cardView.setDragging(false);
                if (this.cardView._spreadLayout) this.cardView.startDynamicsLoop();
                break;
            case 'BURST':
                const now = performance.now();
                if (now - this._lastBurstAt < 80) return; // Rate limiting bursts
                this._lastBurstAt = now;
                createBurst(event.x, event.y);
                break;
        }
    }

    /**
     * Verifies if the application is ready to perform a card draw.
     * @returns {boolean} True if a draw can be requested.
     */
    canRequestDraw() {
        return this.workerReady
            && this.audioReady
            && !!this.logicWorker
            && this.appState === APP_STATES.IDLE;
    }

    /**
     * Initiates a card draw request to the logic worker.
     * @param {string} intentText - The user's focus/intent text.
     * @param {number} physicalVelocity - Swipe velocity metric for entropy seeding.
     */
    requestDraw(intentText, physicalVelocity) {
        if (!this.canRequestDraw()) {
            if (!this.workerReady) this.setStatus(STATUS_MESSAGES.LOGIC_PREPARING);
            else if (!this.audioReady) this.setStatus(STATUS_MESSAGES.AUDIO_PREPARING);
            else if (this.appState === APP_STATES.ERROR) this.setStatus(STATUS_MESSAGES.ERROR_STATE);
            return;
        }

        this.setState(APP_STATES.CHANNELING);
        this.cardView.showChanneling();
        this.ambientEngine.swell();
        this.ambientEngine.playDrawSound();

        // Feed entropy into worker
        const intentWeight = intentText.trim().length > 0 ? intentText.length : 1;
        const seedData = {
            timestamp: performance.now(),
            velocityMetric: physicalVelocity * intentWeight
        };

        this.logicWorker.postMessage({ type: 'REQUEST_DRAW', payload: seedData });
    }

    /**
     * Validates the schema of a draw result returned by the worker.
     * @private
     * @param {Object} result - The message payload from the worker.
     * @returns {boolean} True if the schema is valid.
     */
    validateDrawResult(result) {
        if (!result || typeof result !== 'object') return false;
        if (result.schemaVersion !== DRAW_RESULT_SCHEMA_VERSION) return false;
        if (!result.cardName || !result.cardKey) return false;
        if (!result.vectorState || !result.positionVector) return false;
        if (!['upright', 'reversed'].includes(result.orientation)) return false;
        return true;
    }

    /**
     * Router for handling asynchronous messages from the logic worker.
     * @param {MessageEvent} event - The message event.
     */
    handleWorkerResponse(event) {
        const data = event?.data;
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case 'INIT_DECK_OK':
                this.workerReady = true;
                if (this.appState === APP_STATES.BOOTING) this.setState(APP_STATES.IDLE);
                this.setStatus(STATUS_MESSAGES.READY);
                break;

            case 'INIT_DECK_ERROR':
                this.workerReady = false;
                this.setError(data.payload?.message || 'Deck failed to initialize.');
                break;

            case 'DRAW_ERROR':
                this.setState(APP_STATES.IDLE); // Revert to IDLE on draw error
                this.setError(data.payload?.message || STATUS_MESSAGES.DRAW_FAILED);
                break;

            case 'DRAW_RESULT':
                const result = data.payload;
                if (!this.validateDrawResult(result)) {
                    this.setState(APP_STATES.IDLE);
                    this.setError(STATUS_MESSAGES.DRAW_CONTRACT_MISMATCH);
                    return;
                }

                // Process the successful draw
                this.cardView.showResult(result);
                this.ambientEngine.playFlipSound();

                const axis = this._getDominantAxis(result.localWeights);
                updateParticleTheme(axis);

                const rect = document.getElementById('tarot-card')?.getBoundingClientRect();
                if (rect) createBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);

                this.saveToJournal(result);
                this.ambientEngine.transitionTo('active');
                
                this.setState(APP_STATES.REVEALED);
                this.setStatus(`${result.cardName} revealed (${result.orientation}).`);
                break;
        }
    }
}
