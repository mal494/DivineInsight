const lerp = (start, end, factor) => start + (end - start) * factor;

export class DragController {
    constructor(cardElement, interactionCallback) {
        this.cardEl = cardElement;
        this.cardInner = cardElement?.querySelector('#card-inner');
        this.onInteraction = interactionCallback;

        this.isPointerDown = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.inputState = { x: 0, y: 0, velocity: 0, lastTime: performance.now() };
        this.visualState = { x: 0, y: 0, rotation: 0, tiltX: 0, tiltY: 0 };
        this._rafId = null;
        this._highVelocityThreshold = 1.6;
        this._burstThreshold = 2.2;
        this._lastBurstAt = 0;

        this._handlePointerDown = this._handlePointerDown.bind(this);
        this._handlePointerMove = this._handlePointerMove.bind(this);
        this._handlePointerUp = this._handlePointerUp.bind(this);

        this.bindEvents();
        this.startRenderLoop();
    }

    lerp(start, end, factor) {
        return lerp(start, end, factor);
    }

    bindEvents() {
        window.addEventListener('pointerdown', this._handlePointerDown);
        window.addEventListener('pointermove', this._handlePointerMove);
        window.addEventListener('pointerup', this._handlePointerUp);
    }

    startRenderLoop() {
        const renderFrame = () => {
            if (this.isPointerDown) {
                // Interpolate visual state towards actual input for smooth, weighty drag
                this.visualState.x = this.lerp(this.visualState.x, this.inputState.x - this.dragStartPos.x, 0.2);
                this.visualState.y = this.lerp(this.visualState.y, this.inputState.y - this.dragStartPos.y, 0.2);

                // Add slight tilt based on horizontal movement
                this.visualState.rotation = this.lerp(this.visualState.rotation, this.visualState.x * 0.05, 0.1);

                this.applyTransform();
                this.triggerVisualJuice();
            }

            this._rafId = requestAnimationFrame(renderFrame);
        };

        this._rafId = requestAnimationFrame(renderFrame);
    }

    stop() {
        window.removeEventListener('pointerdown', this._handlePointerDown);
        window.removeEventListener('pointermove', this._handlePointerMove);
        window.removeEventListener('pointerup', this._handlePointerUp);
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    getVelocity() {
        return this.inputState.velocity;
    }

    reset() {
        this.visualState.x = 0;
        this.visualState.y = 0;
        this.visualState.rotation = 0;
    }

    _handlePointerDown(e) {
        if (e.target?.id === 'draw-btn' || e.target?.id === 'btn-seek-insight' || e.target?.id === 'intent-input') return;
        if (typeof e.isPrimary === 'boolean' && !e.isPrimary) return;

        this.isPointerDown = true;
        this.dragStartPos.x = e.clientX;
        this.dragStartPos.y = e.clientY;
        this.inputState.x = e.clientX;
        this.inputState.y = e.clientY;
        this.inputState.lastTime = performance.now();

        if (this.cardEl) {
            this.cardEl.style.transition = 'none';
        }

        this.onInteraction?.({ type: 'DRAG_START', event: e });
    }

    _handlePointerMove(e) {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.inputState.lastTime;
        const dx = e.clientX - this.inputState.x;
        const dy = e.clientY - this.inputState.y;

        this.inputState.velocity = Math.sqrt(dx * dx + dy * dy) / (deltaTime || 1);
        this.inputState.x = e.clientX;
        this.inputState.y = e.clientY;
        this.inputState.lastTime = currentTime;

        // Send raw coordinates for the tilt loop
        this.onInteraction?.({ type: 'MOUSE_MOVE', x: e.clientX, y: e.clientY });

        if (!this.isPointerDown) return;

        if (this.inputState.velocity > this._highVelocityThreshold) {
            this.onInteraction?.({ type: 'HIGH_VELOCITY', value: this.inputState.velocity });
        }
    }

    _handlePointerUp() {
        if (!this.isPointerDown) return;

        this.isPointerDown = false;
        if (this.cardEl) {
            this.cardEl.style.transition = 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        }
        this.reset();
        this.applyTransform();
        this.onInteraction?.({ type: 'DRAG_END' });
    }

    applyTransform() {
        if (!this.cardEl) return;

        // Container handles layout translation and slight drag rotation
        this.cardEl.style.transform = `translate(${this.visualState.x}px, ${this.visualState.y}px) rotate(${this.visualState.rotation}deg) scale(1.05)`;
    }

    triggerVisualJuice() {
        if (this.inputState.velocity > this._burstThreshold && this.cardEl) {
            const now = performance.now();
            if (now - this._lastBurstAt < 100) return;
            this._lastBurstAt = now;
            const cardRect = this.cardEl.getBoundingClientRect();
            const centerX = cardRect.left + cardRect.width / 2;
            const centerY = cardRect.top + cardRect.height / 2;

            this.onInteraction?.({ 
                type: 'BURST', 
                x: centerX, 
                y: centerY, 
                velocity: this.inputState.velocity 
            });
        }
    }
}