export class AmbientEngine {
    constructor({
        baseEl = null,
        swooshEl = null,
        bgmMagic = null,
        sfxHover = null,
        sfxDraw = null,
        sfxFlip = null,
        effectEls = {},
    } = {}) {
        this.audioCtx = null;

        this.baseEl = baseEl ?? bgmMagic;
        this.swooshEl = swooshEl;
        this.bgmMagic = bgmMagic ?? this.baseEl;

        this.sfxHover = sfxHover ?? effectEls.hover ?? null;
        this.sfxDraw = sfxDraw ?? effectEls.draw ?? effectEls.slide ?? null;
        this.sfxFlip = sfxFlip ?? effectEls.flip ?? null;

        this.effectEls = {
            hover: this.sfxHover,
            draw: this.sfxDraw,
            slide: this.sfxDraw,
            flip: this.sfxFlip,
            ...effectEls,
        };

        this.isAmbientPlaying = false;
        this.isInitialized = false;
        this.currentState = 'passive';
        this._fadeToken = 0;
    }

    bindElements({
        baseEl = null,
        swooshEl = null,
        bgmMagic = null,
        sfxHover = null,
        sfxDraw = null,
        sfxFlip = null,
        effectEls = {},
    } = {}) {
        if (baseEl) this.baseEl = baseEl;
        if (swooshEl) this.swooshEl = swooshEl;
        if (bgmMagic) this.bgmMagic = bgmMagic;

        if (!this.bgmMagic && this.baseEl) {
            this.bgmMagic = this.baseEl;
        }

        if (sfxHover) this.sfxHover = sfxHover;
        if (sfxDraw) this.sfxDraw = sfxDraw;
        if (sfxFlip) this.sfxFlip = sfxFlip;

        this.effectEls = {
            ...this.effectEls,
            ...effectEls,
        };

        this.effectEls.hover = this.sfxHover ?? this.effectEls.hover ?? null;
        this.effectEls.draw = this.sfxDraw ?? this.effectEls.draw ?? this.effectEls.slide ?? null;
        this.effectEls.slide = this.effectEls.draw;
        this.effectEls.flip = this.sfxFlip ?? this.effectEls.flip ?? null;
    }

    async init({
        baseEl,
        swooshEl,
        bgmMagic,
        sfxHover,
        sfxDraw,
        sfxFlip,
        effectEls,
    } = {}) {
        this.bindElements({
            baseEl,
            swooshEl,
            bgmMagic,
            sfxHover,
            sfxDraw,
            sfxFlip,
            effectEls,
        });

        if (!this.bgmMagic && !this.baseEl && !this.swooshEl) {
            throw new Error('AmbientEngine.init requires at least one ambient audio element.');
        }

        await this.preload();
        this._setInitialVolumes();
        this.isInitialized = true;
        return this;
    }

    async preload() {
        const elements = [
            this.baseEl,
            this.bgmMagic,
            this.swooshEl,
            this.sfxHover,
            this.sfxDraw,
            this.sfxFlip,
            ...Object.values(this.effectEls),
        ].filter(Boolean);

        elements.forEach(el => {
            try {
                el.preload = 'auto';
                el.load();
            } catch (error) {
                console.warn('Failed to preload audio element:', error);
            }
        });

        await Promise.all(elements.map(el => this._waitForReady(el)));
    }

    async _waitForReady(el) {
        if (!el) return;
        if (el.readyState >= 2) return;

        return new Promise(resolve => {
            const done = () => {
                el.removeEventListener('canplaythrough', done);
                el.removeEventListener('loadeddata', done);
                resolve();
            };

            el.addEventListener('canplaythrough', done, { once: true });
            el.addEventListener('loadeddata', done, { once: true });
        });
    }

    _setInitialVolumes() {
        if (this.bgmMagic) this.bgmMagic.volume = 0.2;
        if (this.baseEl && this.baseEl !== this.bgmMagic) this.baseEl.volume = 0.15;
        if (this.swooshEl) this.swooshEl.volume = 0.05;
    }

    async start() {
        if (!this.isInitialized || this.isAmbientPlaying) return;

        const ambientPrimary = this.baseEl ?? this.bgmMagic;
        await this._playLoop(ambientPrimary, { reset: false });
        await this._playLoop(this.swooshEl, { reset: false });

        this.isAmbientPlaying = true;
    }

    startAmbient() {
        return this.start();
    }

    async _playLoop(el, { reset = true } = {}) {
        if (!el) return;
        if (reset) el.currentTime = 0;
        el.loop = true;

        try {
            await el.play();
        } catch (error) {
            console.warn('Loop playback was blocked or failed:', error);
        }
    }

    _resolveEffectElement(name) {
        const normalized = String(name ?? '').toLowerCase();

        if (normalized === 'hover') return this.sfxHover ?? this.effectEls.hover ?? null;
        if (normalized === 'draw') return this.sfxDraw ?? this.effectEls.draw ?? this.effectEls.slide ?? null;
        if (normalized === 'slide') return this.sfxDraw ?? this.effectEls.slide ?? this.effectEls.draw ?? null;
        if (normalized === 'flip') return this.sfxFlip ?? this.effectEls.flip ?? null;

        return this.effectEls?.[normalized] ?? null;
    }

    playDrawSound() {
        const played = this.playEffect('draw');
        if (!played) this.playEffect('slide');
        void this.startAmbient();
        return played;
    }

    playFlipSound() {
        return this.playEffect('flip');
    }

    swell(durationMs = 1200) {
        const ambientEl = this.bgmMagic ?? this.baseEl;
        if (!ambientEl) return;

        const originalVolume = ambientEl.volume;
        const targetVolume = Math.min(originalVolume + 0.3, 0.9);

        // Quick ramp up
        ambientEl.volume = targetVolume;

        // Slow ramp back
        setTimeout(() => {
            const steps = 30;
            const stepMs = durationMs / steps;
            let currentStep = 0;

            const fadeOut = setInterval(() => {
                currentStep++;
                ambientEl.volume = targetVolume - (targetVolume - originalVolume) * (currentStep / steps);
                if (currentStep >= steps) {
                    clearInterval(fadeOut);
                    ambientEl.volume = originalVolume;
                }
            }, stepMs);
        }, 300);
    }

    playEffect(name, { restart = true } = {}) {
        const el = this._resolveEffectElement(name);
        if (!el) return false;

        if (restart) {
            try {
                el.currentTime = 0;
            } catch (error) {
                // ignore seek errors for certain media states
            }
        }

        try {
            const result = el.play();
            if (result && typeof result.catch === 'function') {
                result.catch(error => console.warn(`Effect playback failed for ${name}:`, error));
            }
            return true;
        } catch (error) {
            console.warn(`Effect playback failed for ${name}:`, error);
            return false;
        }
    }

    adjustHum(velocity) {
        const ambientEl = this.bgmMagic ?? this.baseEl;
        if (!this.isAmbientPlaying || !ambientEl) return ambientEl?.volume ?? 0;

        const safeVelocity = Number.isFinite(velocity) ? Math.max(0, velocity) : 0;
        const targetVolume = Math.min(0.2 + (safeVelocity * 0.04), 0.8);
        ambientEl.volume = this.lerp(ambientEl.volume, targetVolume, 0.1);
        return ambientEl.volume;
    }

    async transitionTo(state) {
        if (!this.isInitialized) return;

        const target = state === 'active'
            ? { base: 0.08, swoosh: 0.25 }
            : { base: 0.15, swoosh: 0.05 };

        if (this.baseEl && this.swooshEl) {
            await this._crossFade({
                baseTarget: target.base,
                swooshTarget: target.swoosh,
                durationMs: 2000,
            });
        } else if (this.bgmMagic) {
            this.bgmMagic.volume = state === 'active' ? 0.35 : 0.2;
        }

        this.currentState = state;
    }

    async _crossFade({ baseTarget, swooshTarget, durationMs = 1500 }) {
        const baseEl = this.baseEl;
        const swooshEl = this.swooshEl;
        if (!baseEl || !swooshEl) return;

        const startBase = baseEl.volume;
        const startSwoosh = swooshEl.volume;
        const token = ++this._fadeToken;
        const start = performance.now();

        return new Promise(resolve => {
            const step = (now) => {
                if (token !== this._fadeToken) return resolve();

                const progress = Math.min((now - start) / durationMs, 1);
                baseEl.volume = this.lerp(startBase, baseTarget, progress);
                swooshEl.volume = this.lerp(startSwoosh, swooshTarget, progress);

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
    }

    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
}

export class DivineAmbientEngine extends AmbientEngine {}
