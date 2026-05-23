export class KarennAgent {
    constructor({
        workerFactory = null,
        toastId = 'karenn-toast',
        textId = 'karenn-text',
        muteId = 'karenn-mute',
        voiceId = 'karenn-voice',
        repeatId = 'karenn-repeat',
        closeId = 'karenn-close',
        storage = window.localStorage,
    } = {}) {
        this.workerFactory = workerFactory;
        this.toastId = toastId;
        this.textId = textId;
        this.muteId = muteId;
        this.voiceId = voiceId;
        this.repeatId = repeatId;
        this.closeId = closeId;
        this.storage = storage;

        this.worker = null;
        this.voiceArmed = false;
        this.lastText = '';
        this._hideTimer = null;
        this._boundArm = null;

        this.settings = {
            muted: false,
            voiceEnabled: true,
        };
    }

    initialize() {
        this._loadSettings();
        this._bindDom();
        this._spawnWorker();
        this._armVoiceOnFirstGesture();
        this._syncControls();
        return this;
    }

    notify(eventType, payload = {}) {
        if (!this.worker) return;
        try {
            this.worker.postMessage({
                type: 'KARENN_EVENT',
                payload: {
                    eventType,
                    at: Date.now(),
                    payload,
                },
            });
        } catch (error) {
            // Worker may have died; fail silent.
        }
    }

    _spawnWorker() {
        try {
            if (this.workerFactory) {
                this.worker = this.workerFactory();
            } else {
                this.worker = new Worker(new URL('../karenn-worker.js', import.meta.url));
            }
        } catch (error) {
            this.worker = null;
            return;
        }

        this.worker.onmessage = (event) => {
            const data = event?.data;
            if (!data || typeof data !== 'object') return;
            if (data.type !== 'KARENN_SAY') return;
            const text = data.payload?.text;
            if (typeof text !== 'string' || !text.trim()) return;
            this._handleSay(text);
        };

        this.worker.onerror = () => {
            this.worker = null;
        };
    }

    _handleSay(text) {
        this.lastText = text;
        if (this.settings.muted) return;
        this._showToast(text);
        this._maybeSpeak(text);
    }

    _bindDom() {
        this.toastEl = document.getElementById(this.toastId);
        this.textEl = document.getElementById(this.textId);
        this.muteBtn = document.getElementById(this.muteId);
        this.voiceBtn = document.getElementById(this.voiceId);
        this.repeatBtn = document.getElementById(this.repeatId);
        this.closeBtn = document.getElementById(this.closeId);

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => {
                this.settings.muted = !this.settings.muted;
                this._persistSettings();
                this._syncControls();
                if (this.settings.muted) this._hideToast();
            });
        }

        if (this.voiceBtn) {
            this.voiceBtn.addEventListener('click', () => {
                this.settings.voiceEnabled = !this.settings.voiceEnabled;
                this._persistSettings();
                this._syncControls();
            });
        }

        if (this.repeatBtn) {
            this.repeatBtn.addEventListener('click', () => {
                if (this.worker) this.worker.postMessage({ type: 'KARENN_REPEAT_LAST' });
                this._maybeSpeak(this.lastText);
            });
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this._hideToast());
        }
    }

    _armVoiceOnFirstGesture() {
        const arm = () => {
            this.voiceArmed = true;
            if (this._boundArm) {
                window.removeEventListener('pointerdown', this._boundArm);
                window.removeEventListener('keydown', this._boundArm);
                this._boundArm = null;
            }
        };
        this._boundArm = arm;
        window.addEventListener('pointerdown', arm, { once: true });
        window.addEventListener('keydown', arm, { once: true });
    }

    _showToast(text) {
        if (!this.toastEl || !this.textEl) return;
        this.textEl.textContent = text;
        this.toastEl.setAttribute('aria-hidden', 'false');

        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => this._hideToast(), 6500);
    }

    _hideToast() {
        if (!this.toastEl) return;
        this.toastEl.setAttribute('aria-hidden', 'true');
    }

    _maybeSpeak(text) {
        if (!this.settings.voiceEnabled) return;
        if (!this.voiceArmed) return;
        if (!text || typeof text !== 'string') return;
        if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return;

        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 0.9;
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            // Ignore speech failures (blocked / unsupported).
        }
    }

    _loadSettings() {
        try {
            const muted = this.storage.getItem('karenn_muted');
            const voice = this.storage.getItem('karenn_voice_enabled');
            this.settings.muted = muted === '1';
            // Default voice enabled unless explicitly off.
            this.settings.voiceEnabled = voice !== '0';
        } catch (error) {
            // ignore storage failures
        }
    }

    _persistSettings() {
        try {
            this.storage.setItem('karenn_muted', this.settings.muted ? '1' : '0');
            this.storage.setItem('karenn_voice_enabled', this.settings.voiceEnabled ? '1' : '0');
        } catch (error) {
            // ignore storage failures
        }
    }

    _syncControls() {
        if (this.muteBtn) {
            this.muteBtn.setAttribute('aria-pressed', this.settings.muted ? 'true' : 'false');
            this.muteBtn.textContent = this.settings.muted ? 'Unmute' : 'Mute';
        }
        if (this.voiceBtn) {
            this.voiceBtn.setAttribute('aria-pressed', this.settings.voiceEnabled ? 'true' : 'false');
            this.voiceBtn.textContent = this.settings.voiceEnabled ? 'Voice: On' : 'Voice: Off';
        }
    }
}

