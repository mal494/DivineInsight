export class CardView {
    constructor({ options = {} } = {}) {
        // Map to the new premium UI elements
        this.cardEl = document.getElementById('tarot-card');
        this.cardInner = document.getElementById('card-inner');
        this.cardBackLayer = document.getElementById('card-back');
        this.slotGlow = document.getElementById('slot-glow');
        this.insightPanel = document.getElementById('insight-panel');

        // New DOM References for the Data Binding
        this.insightTitle = this.insightPanel?.querySelector('h4');
        this.insightKeywordsContainer = this.insightPanel?.querySelector('.flex.flex-wrap.gap-2');
        this.insightDescription = this.insightPanel?.querySelector('p.leading-relaxed');

        this.drawBtn = document.getElementById('draw-btn');
        this.statusTextEl = document.getElementById('status-text'); // Fallback for various status readouts

        // Configurable selectors / classes
        this.edgeSelector = options.edgeSelector || '.card-edge';
        this.glowClass = options.glowClass || 'glow-edge';
        this.flipClass = options.flipClass || 'flipped';
        this.drawingClass = options.drawingClass || 'drawing-animation';
        this.defaultGlowDuration = typeof options.defaultGlowDuration === 'number' ? options.defaultGlowDuration : 1200;

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
        this._mousePos = { x: 0, y: 0 };
        this._isFlipped = false;
        this._rafId = null;
        this._lastFrameTime = performance.now();
    }

    updateMousePos(x, y) {
        this._mousePos.x = x;
        this._mousePos.y = y;
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

        // 3D Tilt calculation (Interactive hover response)
        if (this.cardInner) {
            const rect = this.cardEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const mouseX = this._mousePos.x - centerX;
            const mouseY = this._mousePos.y - centerY;

            const rotateX = -mouseY / 25;
            const rotateY = (mouseX / 25) + (this._isFlipped ? 180 : 0);

            this.cardInner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        }
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
        // If caller provided a discrete orientation, force rotation to exactly 0 or 180 degrees
        // to ensure the pulled card only has two possible orientations (upright/reversed).
        let rotationDeg;
        if (layout.orientation === 'upright') {
            rotationDeg = 0;
        } else if (layout.orientation === 'reversed') {
            rotationDeg = 180;
        } else {
            rotationDeg = (typeof layout.angle === 'number' ? layout.angle : 0) * (180 / Math.PI) + basisX * 6;
        }
        const scale = layout.scale || 1 + Math.min(0.18, spreadRadius * 0.08);

        this._spreadLayout = {
            x: translateX,
            y: translateY,
            rotation: rotationDeg,
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

    _populateInsightPanel(nodeData) {
        if (!nodeData) return;
        if (!this.insightTitle || !this.insightKeywordsContainer || !this.insightDescription) return;

        // 1. Update the Title & Orientation
        const titleText = (nodeData.cardName || nodeData.name) + (nodeData.orientation === 'reversed' ? ' (Reversed)' : '');
        this.insightTitle.innerText = titleText;

        // 2. Clear and Rebuild Keyword Tags
        this.insightKeywordsContainer.innerHTML = ''; 
        
        if (nodeData.keywords && Array.isArray(nodeData.keywords)) {
            nodeData.keywords.forEach((keyword, index) => {
                const span = document.createElement('span');
                
                // Style the final keyword as the "Primary" highlighted tag
                if (index === nodeData.keywords.length - 1) {
                    span.className = 'px-3 py-1 bg-ethereal-teal text-midnight-obsidian rounded-full font-label-sm text-label-sm uppercase shadow-[0_0_10px_rgba(0,255,204,0.3)]';
                } else {
                    span.className = 'px-3 py-1 border border-moon-silver/20 rounded-full font-label-sm text-label-sm text-moon-silver/60 uppercase';
                }
                
                span.innerText = keyword;
                this.insightKeywordsContainer.appendChild(span);
            });
        }

        // 3. Generate Dynamic Synthesis Text from Vector Weights
        // This acts as your engine's voice until you hook up an external LLM agent
        let dominantAxis = "balance";
        if (nodeData.localWeights) {
            const weights = nodeData.localWeights;
            dominantAxis = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
        }

        const axisInterpretations = {
            intellect: "a surge of structural logic and mental clarity.",
            emotion: "deep intuitive currents and emotional resonance.",
            material: "a grounding force anchored in physical reality.",
            volition: "high-velocity manifestation and fiery drive."
        };

        const orientationContext = nodeData.orientation === 'reversed' 
            ? "However, its reversed position suggests this energy is currently internalized, blocked, or experiencing friction."
            : "This energy is flowing freely, open to external manifestation.";

        this.insightDescription.innerText = `The presence of ${nodeData.cardName || nodeData.name} at the threshold introduces ${axisInterpretations[dominantAxis] || "a shifting dynamic."} ${orientationContext}`;
    }

    // Overriding the flip to use the new premium transitions
    showResult(result = {}) {
        const normalizedResult = typeof result === 'string' ? { cardName: result } : result;
        const targetNode = normalizedResult.nodes ? normalizedResult.nodes[0] : normalizedResult;
        const { cardKey, cardId, cardName } = targetNode;

        // Ensure channeling stopped first
        this._stopChannelAnimation();

        // Hide the table glow and ensure card is visible
        if (this.slotGlow) this.slotGlow.classList.add('hidden');
        if (this.cardEl) this.cardEl.classList.remove('hidden');

        // Apply vector layout lerp
        this.applySpreadLayout(result);
        
        // --- NEW: Populate the UI text fields with the Worker's JSON ---
        this._populateInsightPanel(targetNode);

        // Update physical card front title (fallback for h3)
        const cardTitle = document.querySelector('#tarot-card h3');
        if (cardTitle) cardTitle.innerText = cardName || targetNode.name || '';

        const finish = () => {
            // Execute the 3D flip and panel reveal
            setTimeout(() => {
                this._isFlipped = true;
                if (this.cardInner) this.cardInner.style.transform = 'rotateY(180deg)';
                
                setTimeout(() => {
                    if (this.insightPanel) {
                        this.insightPanel.style.opacity = '1';
                        this.insightPanel.style.transform = 'translateX(-50%) translateY(0)';
                    }
                    
                    document.body.classList.add('animate-pulse');
                    setTimeout(() => document.body.classList.remove('animate-pulse'), 1000);
                }, 800);
            }, 100);
        };

        const imageKey = cardKey || cardId;
        if (imageKey) {
            // Update the front image as well as the animated back
            const frontImg = (this.cardEl && this.cardEl.querySelector('.rotate-y-180 img')) || document.querySelector('.rotate-y-180 img');
            if (frontImg) frontImg.src = `assets/img/deck/${imageKey}.jpg`;
            this.setDeckImage(imageKey).then(finish);
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
        // Reset 3D flip and hide insight panel
        this._isFlipped = false;
        if (this.cardInner) this.cardInner.style.transform = 'rotateY(0deg)';
        if (this.insightPanel) {
            this.insightPanel.style.opacity = '0';
            this.insightPanel.style.transform = 'translateX(-50%) translateY(40px)';
        }
        if (this.slotGlow) this.slotGlow.classList.remove('hidden');

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