import { DragController } from './DragController.js';
import { CardView } from './CardView.js';
import { AmbientEngine } from './ambientEngine.js';
import { updateParticleTheme, createBurst, initParticleSystem } from '../assets/fx/particles.js';

const APP_STATES = Object.freeze({
    BOOTING: 'booting',
    IDLE: 'idle',
    CHANNELING: 'channeling',
    REVEALED: 'revealed',
    ERROR: 'error'
});

const DRAW_RESULT_SCHEMA_VERSION = 1;
const JOURNAL_KEY = 'divine_readings';
const MAX_JOURNAL_ENTRIES = 50;

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

            this.logicWorker = new Worker(new URL('../logic-worker.js', import.meta.url));
            this.logicWorker.onmessage = this.handleWorkerResponse.bind(this);
            this.logicWorker.onerror = (error) => {
                this.setError(`Logic engine error: ${error.message || 'unknown worker failure'}`);
            };
            this.logicWorker.onmessageerror = () => {
                this.setError('Logic engine sent an unreadable message.');
            };
            this.logicWorker.postMessage({ type: 'INIT_DECK', payload: this.deckDataText });

            await this.ambientEngine.init({
                baseEl: document.getElementById('audio-base'),
                swooshEl: document.getElementById('audio-swoosh'),
                sfxHover: document.getElementById('audio-hover'),
                sfxDraw: document.getElementById('audio-draw'),
                sfxFlip: document.getElementById('audio-flip')
            });
            this.audioReady = true;

            this.setState(APP_STATES.IDLE);
            this.setStatus('Concentrate on your intent...');
        } catch (error) {
            this.setError(error?.message || 'Failed to initialize system.');
        }
    }

    bindGlobalStatusEvents() {
        window.addEventListener('app:error', (event) => {
            this.setError(event?.detail || 'An unexpected error occurred.');
        });

        window.addEventListener('app:status', (event) => {
            const message = event?.detail;
            if (message) this.setStatus(message);
        });
    }

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

    setState(nextState) {
        this.appState = nextState;
        this.pendingDraw = nextState === APP_STATES.CHANNELING;
        this.cardView.setUiState({ state: nextState });
    }

    setStatus(message) {
        this.cardView.setStatus(message, { isError: false });
    }

    setError(message) {
        console.error('[DivineInsightApp]', message);
        this.setState(APP_STATES.ERROR);
        this.cardView.setStatus(message, { isError: true });
    }

    resetAltar() {
        this.cardView.resetCard();
        this.ambientEngine.transitionTo('passive');
        updateParticleTheme('balance');
        const intentInput = document.getElementById('intent-input');
        if (intentInput) intentInput.value = '';
        this.setState(APP_STATES.IDLE);
        this.setStatus('Concentrate on your intent...');
    }

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

    writeJournal(entries) {
        try {
            const normalized = Array.isArray(entries) ? entries.slice(0, MAX_JOURNAL_ENTRIES) : [];
            localStorage.setItem(JOURNAL_KEY, JSON.stringify(normalized));
        } catch (error) {
            this.setStatus('Could not save reading history (storage unavailable).');
        }
    }

    showJournal() {
        const panel = document.getElementById('journal-panel');
        const list = document.getElementById('journal-list');
        if (!panel || !list) return;

        const readings = this.readJournal();
        list.innerHTML = '';

        if (readings.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'text-moon-silver/60 text-sm';
            empty.innerText = 'No saved readings yet.';
            list.appendChild(empty);
        } else {
            readings.forEach((entry) => {
                const li = document.createElement('li');
                li.className = 'rounded-lg border border-moon-silver/15 bg-white/5 p-3';
                const date = new Date(entry.date || Date.now()).toLocaleString();
                li.innerHTML = `<div class="font-semibold text-ethereal-teal">${entry.cardName || 'Unknown Card'} (${entry.orientation || 'upright'})</div>
<div class="text-moon-silver/70 text-xs mt-1">${date}</div>
<div class="text-moon-silver/60 text-xs mt-1">Axis: ${entry.dominantAxis || 'balance'}</div>`;
                list.appendChild(li);
            });
        }

        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
    }

    hideJournal() {
        const panel = document.getElementById('journal-panel');
        if (!panel) return;
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
    }

    clearJournal() {
        this.writeJournal([]);
        this.showJournal();
        this.setStatus('Arcana Journal cleared.');
    }

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

    _getDominantAxis(weights) {
        if (!weights || typeof weights !== 'object') return 'balance';
        const keys = Object.keys(weights);
        if (!keys.length) return 'balance';
        return keys.reduce((a, b) => (weights[a] > weights[b] ? a : b));
    }

    handleInteraction(event) {
        if (!event || this.appState === APP_STATES.ERROR) return;

        if (event.type === 'HIGH_VELOCITY') {
            this.ambientEngine.adjustHum(event.value);
            return;
        }

        if (event.type === 'MOUSE_MOVE') {
            this.cardView.updateMousePos(event.x, event.y);
            return;
        }

        if (event.type === 'DRAG_START') {
            this.cardView.setDragging(true);
            return;
        }

        if (event.type === 'DRAG_END') {
            this.cardView.setDragging(false);
            if (this.cardView._spreadLayout) this.cardView.startDynamicsLoop();
            return;
        }

        if (event.type === 'BURST') {
            const now = performance.now();
            if (now - this._lastBurstAt < 80) return;
            this._lastBurstAt = now;
            createBurst(event.x, event.y);
        }
    }

    canRequestDraw() {
        return this.workerReady
            && this.audioReady
            && this.logicWorker
            && this.appState !== APP_STATES.CHANNELING
            && this.appState !== APP_STATES.ERROR;
    }

    requestDraw(intentText, physicalVelocity) {
        if (!this.canRequestDraw()) {
            if (!this.workerReady) this.setStatus('Logic engine is still preparing...');
            else if (!this.audioReady) this.setStatus('Audio layer is still preparing...');
            return;
        }

        this.setState(APP_STATES.CHANNELING);
        this.cardView.showChanneling();
        this.ambientEngine.swell();
        this.ambientEngine.playDrawSound();

        const intentWeight = intentText.trim().length > 0 ? intentText.length : 1;
        const seedData = {
            timestamp: Date.now(),
            velocityMetric: physicalVelocity * intentWeight
        };

        this.logicWorker.postMessage({ type: 'REQUEST_DRAW', payload: seedData });
    }

    validateDrawResult(result) {
        if (!result || typeof result !== 'object') return false;
        if (result.schemaVersion !== DRAW_RESULT_SCHEMA_VERSION) return false;
        if (!result.cardName || !result.cardKey) return false;
        if (!result.vectorState || !result.positionVector) return false;
        if (!['upright', 'reversed'].includes(result.orientation)) return false;
        return true;
    }

    handleWorkerResponse(event) {
        const data = event?.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'INIT_DECK_OK') {
            this.workerReady = true;
            if (this.appState === APP_STATES.BOOTING) this.setState(APP_STATES.IDLE);
            this.setStatus('Concentrate on your intent...');
            return;
        }

        if (data.type === 'INIT_DECK_ERROR') {
            this.workerReady = false;
            this.setError(data.payload?.message || 'Deck failed to initialize.');
            return;
        }

        if (data.type === 'DRAW_ERROR') {
            this.setState(APP_STATES.IDLE);
            this.setError(data.payload?.message || 'Could not draw a card.');
            return;
        }

        if (data.type !== 'DRAW_RESULT') return;

        const result = data.payload;
        if (!this.validateDrawResult(result)) {
            this.setState(APP_STATES.IDLE);
            this.setError('Draw result contract mismatch.');
            return;
        }

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
    }
}
