export class CardView {
    constructor({ cardEl = null, statusTextEl = null, options = {} } = {}) {
        // Cache DOM elements so we aren't querying the document repeatedly.
        // Support both injected elements and the original zero-arg wiring style.
        this.cardEl = cardEl || document.getElementById('active-card');
        this.statusTextEl = statusTextEl || document.getElementById('status-text');
        this.drawBtn = document.getElementById('draw-btn');

        // Configurable selectors / classes
        this.edgeSelector = options.edgeSelector || '.card-edge';
        this.glowClass = options.glowClass || 'glow-edge';
        this.flipClass = options.flipClass || 'flipped';
        this.drawingClass = options.drawingClass || 'drawing-animation';
        this.defaultGlowDuration = typeof options.defaultGlowDuration === 'number' ? options.defaultGlowDuration : 1200;

        // DOM references (prefer local cardEl scope, fallback to document)
        this.cardBackLayer = (this.cardEl && this.cardEl.querySelector('.card-back')) || document.querySelector('.card-back');
        this.edgeEl = (this.cardEl && this.cardEl.querySelector(this.edgeSelector)) || document.querySelector(this.edgeSelector);

        // Animation state
        this._deckImages = [];
        this._animInterval = null;
        this._animIndex = 0;
        this._queuedFinal = null;
        this._resolveQueued = null;
        this._glowTimeout = null;
        this._spreadLayout = null;
        this._vectorDynamics = {
            velocity: { x: 0, y: 0 },
            ambientDrift: { x: 0, y: 0 },
            noise: 0
        };
        this._rafId = null;
        this._lastFrameTime = performance.now();
    }

    // DYNAMICS / RENDERING
    startDynamicsLoop() {
        if (this._rafId) return;
        const loop = (now) => {
            const dt = (now - this._lastFrameTime) / 1000;
            this._lastFrameTime = now;
            this._updateDynamics(dt);
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stopDynamicsLoop() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = null;
    }

    _updateDynamics(dt) {
        if (!this.cardEl || !this._spreadLayout) return;

        // Apply ambient drift based on vector profile
        const sessionNoise = Math.sin(this._lastFrameTime * 0.001) * this._vectorDynamics.noise;
        const driftX = Math.cos(this._lastFrameTime * 0.0007) * this._vectorDynamics.ambientDrift.x * 20;
        const driftY = Math.sin(this._lastFrameTime * 0.0009) * this._vectorDynamics.ambientDrift.y * 20;

        const currentX = this._spreadLayout.x + driftX + sessionNoise;
        const currentY = this._spreadLayout.y + driftY + sessionNoise;
        const currentRotate = this._spreadLayout.rotation + Math.sin(this._lastFrameTime * 0.0012) * this._vectorDynamics.noise * 2;

        this.cardEl.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg) scale(${this._spreadLayout.scale})`;
    }

    // TRANSFORM / DRAG
    setDragging(isDragging) {
        if (!this.cardEl) return;
        if (isDragging) {
            this.stopDynamicsLoop();
            this.cardEl.style.transition = 'none';
        } else {
            this.cardEl.style.transition = 'transform 0.3s ease-out';
        }
    }

    setTransform({ x = 0, y = 0, rotation = 0, scale = 1 } = {}) {
        if (!this.cardEl) return;
        this.cardEl.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
    }

    reset() {
        this.stopDynamicsLoop();
        this._spreadLayout = null;
        this.setTransform({ x: 0, y: 0, rotation: 0, scale: 1 });
    }

    applySpreadLayout(layout = {}) {
        if (!this.cardEl) return;

        const sourceVector = layout.positionVector || layout.vectorState?.vector || {};
        const drift = layout.vectorState?.drift || { x: 0, y: 0 };
        const entropy = layout.vectorState?.entropy || 0;
        
        const spreadRadius = typeof layout.spreadRadius === 'number'
            ? layout.spreadRadius
            : (typeof layout.vectorState?.spreadRadius === 'number' ? layout.vectorState.spreadRadius : 1);
        const basis = layout.cardBasis || {};

        const x = typeof sourceVector.x === 'number' ? sourceVector.x : 0;
        const y = typeof sourceVector.y === 'number' ? sourceVector.y : 0;
        const basisX = typeof basis.x === 'number' ? basis.x : 0;
        const basisY = typeof basis.y === 'number' ? basis.y : 0;

        const translateX = x + basisX * 14 * spreadRadius;
        const translateY = y + basisY * 14 * spreadRadius;
        const rotation = (typeof layout.angle === 'number' ? layout.angle : 0) * (180 / Math.PI) + basisX * 6;
        const scale = layout.scale || 1 + Math.min(0.18, spreadRadius * 0.08);

        this._spreadLayout = {
            x: translateX,
            y: translateY,
            rotation,
            scale
        };

        // Cache vector dynamics for the render loop
        this._vectorDynamics = {
            ambientDrift: { x: drift.x, y: drift.y },
            noise: (entropy / 100) * 2 // Scale entropy to a small pixel jitter
        };

        this.startDynamicsLoop();
    }

    // GLOW / FLIP
    setGlow(on = true, { durationMs } = {}) {
        if (!this.edgeEl) return;
        const ms = typeof durationMs === 'number' ? durationMs : (on ? this.defaultGlowDuration : 0);

        if (on) {
            this.edgeEl.classList.add(this.glowClass);
            if (ms > 0) {
                clearTimeout(this._glowTimeout);
                this._glowTimeout = setTimeout(() => this.edgeEl.classList.remove(this.glowClass), ms);
            }
        } else {
            clearTimeout(this._glowTimeout);
            this.edgeEl.classList.remove(this.glowClass);
        }
    }

    flip({ withGlow = true, glowDurationMs } = {}) {
        if (!this.cardEl) return;
        if (withGlow) this.setGlow(true, { durationMs: glowDurationMs });
        this.cardEl.classList.add(this.flipClass);
    }

    unflip() {
        if (!this.cardEl) return;
        this.cardEl.classList.remove(this.flipClass);
        this.setGlow(false);
    }

    // DECK IMAGES & CHANNELING
    setDeckImages(keys = []) {
        this._deckImages = keys.map(k => `url('assets/img/deck/${k}.jpg')`);
    }

    setDeckImage(cardId) {
        if (!this.cardBackLayer) return Promise.resolve();
        const finalUrl = `url('assets/img/deck/${cardId}.jpg')`;

        if (this._animInterval) {
            this._queuedFinal = finalUrl;
            return new Promise(resolve => {
                this._resolveQueued = resolve;
            });
        }

        this.cardBackLayer.style.backgroundImage = finalUrl;
        return Promise.resolve();
    }

    showChanneling() {
        if (this.statusTextEl) this.statusTextEl.innerText = 'Channeling intent...';
        if (this.drawBtn) {
            this.drawBtn.disabled = true;
            this.drawBtn.style.opacity = '0.5';
        }
        if (this.cardEl) this.cardEl.classList.add(this.drawingClass);
        if (this.cardEl) this.cardEl.classList.remove(this.flipClass);
        this._startChannelAnimation();
    }

    _startChannelAnimation() {
        if (!this._deckImages || this._deckImages.length === 0) return;
        if (this._animInterval) return;

        this._animIndex = 0;
        this._animInterval = setInterval(() => {
            if (this.cardBackLayer) this.cardBackLayer.style.backgroundImage = this._deckImages[this._animIndex];

            if (this._queuedFinal && this._animIndex === this._deckImages.length - 1) {
                if (this.cardBackLayer) this.cardBackLayer.style.backgroundImage = this._queuedFinal;
                this._queuedFinal = null;
                clearInterval(this._animInterval);
                this._animInterval = null;
                if (this._resolveQueued) {
                    this._resolveQueued();
                    this._resolveQueued = null;
                }
                return;
            }

            this._animIndex = (this._animIndex + 1) % this._deckImages.length;
        }, 80);
    }

    _stopChannelAnimation() {
        if (this._animInterval) {
            clearInterval(this._animInterval);
            this._animInterval = null;
            this._queuedFinal = null;
            if (this._resolveQueued) {
                this._resolveQueued();
                this._resolveQueued = null;
            }
        }
        if (this.cardEl) this.cardEl.classList.remove(this.drawingClass);
    }

    // SHOW RESULT
    showResult(result = {}) {
        const normalizedResult = typeof result === 'string'
            ? { cardName: result }
            : result;

        const {
            cardName = '',
            cardId = null,
            applyGlow = true,
            positionVector = null,
            vectorState = null,
            cardBasis = null,
        } = normalizedResult;

        // Ensure channeling stopped first
        this._stopChannelAnimation();

        this.applySpreadLayout({
            positionVector,
            vectorState,
            cardBasis,
            angle: positionVector?.angle,
            spreadRadius: positionVector?.spreadRadius || vectorState?.spreadRadius,
        });

        const finish = () => {
            if (applyGlow) this.setGlow(true);
            if (this.cardEl) this.cardEl.classList.add(this.flipClass);
            if (this.statusTextEl) this.statusTextEl.innerText = `You drew: ${cardName}`;
            if (this.drawBtn) {
                this.drawBtn.disabled = false;
                this.drawBtn.style.opacity = '1';
            }
        };

        if (cardId) {
            this.setDeckImage(cardId).then(finish);
        } else {
            finish();
        }
    }

    // Backwards-compatible aliases for earlier call sites / snippets.
    setLoadingState() {
        this.showChanneling();
    }

    revealCard(cardResult) {
        this.showResult(cardResult);
    }

    resetCard() {
        this.unflip();
        this.stopDynamicsLoop();
        this._spreadLayout = null;
        this.setTransform({ x: 0, y: 0, rotation: 0, scale: 1 });
        if (this.statusTextEl) this.statusTextEl.innerText = 'Concentrate on your intent...';
        if (this.drawBtn) {
            this.drawBtn.disabled = false;
            this.drawBtn.style.opacity = '1';
        }

        // Clear the background image after the flip finishes so the user doesn't see it.
        setTimeout(() => {
            if (this.cardBackLayer) this.cardBackLayer.style.backgroundImage = 'none';
        }, 600);
    }
}