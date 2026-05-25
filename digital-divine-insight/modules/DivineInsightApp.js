import { DragController } from './DragController.js';
import { CardView } from './CardView.js';
import { AmbientEngine } from './ambientEngine.js';
import { updateParticleTheme, createBurst, initParticleSystem } from '../assets/fx/particles.js';
import { JournalView } from '../JournalView.js';
import { GalleryView } from '../GalleryView.js';
import { SettingsView } from '../SettingsView.js';
import { ManagerView } from '../ManagerView.js';
import { saveReading, getReadings, clearReadings, addThought, reportIncident } from '../KarenVault.js';

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
const KAREN_RENDER_TIMEOUT_MS = 1200;

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
        this.journalView = new JournalView();
        this.galleryView = new GalleryView();
        this.settingsView = new SettingsView({
            onVolumeChange: (value) => this.ambientEngine.setMasterVolume(value),
            onIntensityChange: (value) => this.cardView.setVisualIntensity(value)
        });
        this.managerView = new ManagerView();

        this.karenWorker = null;
        this.mikeyWorker = null;
        this.karenWorkerReady = false;
        this._karenTasks = new Map();
        this._karenTaskCounter = 0;

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
                void this.logIncident({
                    source: 'logic-worker',
                    error: error.message || 'unknown worker failure',
                    stack: error.error?.stack || '',
                    timestamp: Date.now()
                });
            };
            this.logicWorker.onmessageerror = () => {
                this.setError('Logic engine sent an unreadable message.');
                void this.logIncident({
                    source: 'logic-worker',
                    error: 'Logic engine sent an unreadable message.',
                    timestamp: Date.now()
                });
            };
            this.logicWorker.postMessage({ type: 'INIT_DECK', payload: this.deckDataText });
            this.initKarenAssistantWorkers();
            this.initManagerConsoleExposure();
            await this.migrateLegacyJournalToVault();

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
        const journalBtn = document.getElementById('btn-journal');
        const galleryBtn = document.getElementById('btn-deck-gallery');
        const settingsBtn = document.getElementById('btn-altar-settings');
        const journalPanel = document.getElementById('journal-panel');
        const galleryPanel = document.getElementById('gallery-panel');
        const settingsPanel = document.getElementById('settings-panel');
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
        if (pastReadingsBtn) pastReadingsBtn.addEventListener('click', () => void this.showJournal());
        if (journalBtn) journalBtn.addEventListener('click', () => void this.showJournal());
        if (galleryBtn) galleryBtn.addEventListener('click', () => void this.showGallery());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettings());
        if (closeJournalBtn) closeJournalBtn.addEventListener('click', () => this.hideJournal());
        if (clearJournalBtn) clearJournalBtn.addEventListener('click', () => void this.clearJournal());

        if (journalPanel) {
            journalPanel.addEventListener('click', (event) => {
                if (event.target === journalPanel) this.hideJournal();
            });
        }

        if (galleryPanel) {
            galleryPanel.addEventListener('click', (event) => {
                if (event.target === galleryPanel) this.hideGallery();
            });
        }

        if (settingsPanel) {
            settingsPanel.addEventListener('click', (event) => {
                if (event.target === settingsPanel) this.hideSettings();
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

    async migrateLegacyJournalToVault() {
        try {
            const legacyRaw = localStorage.getItem(JOURNAL_KEY);
            if (!legacyRaw) return;

            const legacy = JSON.parse(legacyRaw);
            if (!Array.isArray(legacy) || legacy.length === 0) {
                localStorage.removeItem(JOURNAL_KEY);
                return;
            }

            const existing = await getReadings();
            if (Array.isArray(existing) && existing.length > 0) return;

            for (const entry of legacy.slice(0, MAX_JOURNAL_ENTRIES)) {
                await saveReading({
                    date: entry.date || new Date().toISOString(),
                    cardName: entry.cardName || 'Unknown Card',
                    orientation: entry.orientation || 'upright',
                    dominantAxis: entry.dominantAxis || 'balance'
                });
            }

            localStorage.removeItem(JOURNAL_KEY);
        } catch (error) {
            console.warn('Failed to migrate legacy journal data:', error);
        }
    }

    async readJournal() {
        try {
            const readings = await getReadings();
            return Array.isArray(readings)
                ? readings.filter(Boolean).slice(0, MAX_JOURNAL_ENTRIES)
                : [];
        } catch (error) {
            console.warn('Failed to read vault journal:', error);
            return [];
        }
    }

    async showJournal() {
        this.hideGallery();
        this.hideSettings();
        const readings = await this.readJournal();
        const rendered = await this.delegateKarenRender('RENDER_JOURNAL', readings, 'JOURNAL_READY');
        this.journalView.show(readings, rendered);
    }

    hideJournal() {
        this.journalView.hide();
    }

    async clearJournal() {
        try {
            await clearReadings();
        } catch (error) {
            this.setStatus('Could not clear reading history (vault unavailable).');
            return;
        }
        await this.showJournal();
        this.setStatus('Arcana Journal cleared.');
    }

    async saveToJournal(result) {
        const entry = {
            date: new Date().toISOString(),
            cardName: result.cardName,
            orientation: result.orientation,
            dominantAxis: this._getDominantAxis(result.localWeights)
        };
        await saveReading(entry);
    }

    async showGallery() {
        this.hideJournal();
        this.hideSettings();
        let deckData = null;
        try {
            deckData = JSON.parse(this.deckDataText || '{}');
        } catch (error) {
            this.setStatus('Deck gallery is unavailable (deck data malformed).');
            return;
        }

        const rendered = await this.delegateKarenRender('RENDER_GALLERY', deckData, 'GALLERY_READY');
        this.galleryView.show(deckData, rendered);
    }

    hideGallery() {
        this.galleryView.hide();
    }

    showSettings() {
        this.hideJournal();
        this.hideGallery();
        this.settingsView.show();
    }

    hideSettings() {
        this.settingsView.hide();
    }

    initManagerConsoleExposure() {
        const params = new URLSearchParams(window.location.search);
        const enabled = params.has('manager') || localStorage.getItem('divine_manager_mode') === '1';
        if (enabled) this.managerView.expose();

        window.enableDivineManager = () => {
            localStorage.setItem('divine_manager_mode', '1');
            this.managerView.expose();
            return 'Manager mode enabled. Run showMeTheManager() for vault report.';
        };
    }

    initKarenAssistantWorkers() {
        try {
            this.karenWorker = new Worker(new URL('../karen-worker.js', import.meta.url));
            this.mikeyWorker = new Worker(new URL('../mikey-worker.js', import.meta.url));
            this.karenWorker.onmessage = this.handleKarenMessage.bind(this);
            this.karenWorker.onerror = (error) => this.handleKarenWorkerError(error);
            this.mikeyWorker.onerror = (error) => this.handleKarenWorkerError(error);

            const channel = new MessageChannel();
            this.karenWorker.postMessage({ type: 'LINK_ASSISTANT' }, [channel.port1]);
            this.mikeyWorker.postMessage({ type: 'LINK_KAREN' }, [channel.port2]);
            this.karenWorkerReady = true;
        } catch (error) {
            this.karenWorkerReady = false;
            console.warn('Karen/Mikey worker pipeline unavailable:', error);
        }
    }

    handleKarenWorkerError(error) {
        this.karenWorkerReady = false;
        void this.logIncident({
            source: 'karen-pipeline',
            error: error?.message || 'Unknown Karen worker failure',
            stack: error?.error?.stack || ''
        });
    }

    async logIncident(payload) {
        try {
            await reportIncident({
                source: payload.source || 'system',
                error: payload.error || 'Unknown error',
                stack: payload.stack || '',
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('Incident logging unavailable:', error);
        }
    }

    async logKarenThought(payload) {
        try {
            await addThought({
                message: payload.message || 'Karen had an unspecified thought.',
                timestamp: payload.timestamp || Date.now(),
                irritationLevel: payload.irritationLevel ?? 0
            });
        } catch (error) {
            console.warn('Thought logging unavailable:', error);
        }
    }

    handleKarenMessage(event) {
        const data = event?.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'KAREN_THOUGHT') {
            void this.logKarenThought(data.payload || {});
            return;
        }

        if (data.type === 'KAREN_INCIDENT_REPORT') {
            void this.logIncident(data.payload || {});
            return;
        }

        if (data.type === 'KAREN_ESCALATION') {
            void this.logIncident({ source: 'karen-escalation', error: data.error || 'Unknown escalation error', timestamp: Date.now() });
            return;
        }

        if (data.type === 'JOURNAL_READY' || data.type === 'GALLERY_READY') {
            const task = this._karenTasks.get(data.taskId);
            if (!task) return;
            if (task.expectedType && data.type !== task.expectedType) return;
            this._karenTasks.delete(data.taskId);
            task.resolve(Array.isArray(data.payload) ? data.payload : null);
        }
    }

    async delegateKarenRender(type, payload, expectedType) {
        if (!this.karenWorker || !this.karenWorkerReady) return null;

        this._karenTaskCounter += 1;
        const taskId = this._karenTaskCounter;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this._karenTasks.delete(taskId);
                resolve(null);
            }, KAREN_RENDER_TIMEOUT_MS);

            this._karenTasks.set(taskId, {
                expectedType,
                resolve: (html) => {
                    clearTimeout(timeout);
                    resolve(html);
                }
            });

            this.karenWorker.postMessage({ type, payload, taskId });
        });
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
            timestamp: performance.now(),
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
            void this.logIncident({
                source: 'logic-worker',
                error: data.payload?.message || 'Could not draw a card.',
                timestamp: Date.now()
            });
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

        void this.saveToJournal(result);
        this.ambientEngine.transitionTo('active');
        this.setState(APP_STATES.REVEALED);
        this.setStatus(`${result.cardName} revealed (${result.orientation}).`);
    }
}
