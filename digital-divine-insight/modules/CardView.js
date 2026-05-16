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
    }

    // TRANSFORM / DRAG
    setDragging(isDragging) {
        if (!this.cardEl) return;
        this.cardEl.style.transition = isDragging ? 'none' : 'transform 0.3s ease-out';
    }

    setTransform({ x = 0, y = 0, rotation = 0, scale = 1 } = {}) {
        if (!this.cardEl) return;
        this.cardEl.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
    }

    reset() {
        this.setTransform({ x: 0, y: 0, rotation: 0, scale: 1 });
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
        } = normalizedResult;

        // Ensure channeling stopped first
        this._stopChannelAnimation();

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