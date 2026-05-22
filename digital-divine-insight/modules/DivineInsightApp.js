import { DragController } from './DragController.js';
import { CardView } from './CardView.js';
import { AmbientEngine } from './ambientEngine.js';

export class DivineInsightApp {
    constructor() {
        // --- Core State ---
        this.deckDataText = null;
        this.logicWorker = null;
        
        // --- Module Instances ---
        this.cardView = new CardView();
        this.ambientEngine = new AmbientEngine();
        
        // Pass the interaction callback to DragController so it can send velocity UP
        const cardElement = document.getElementById('tarot-card');
        this.dragController = new DragController(cardElement, this.handleInteraction.bind(this));
    }

    async initialize() {
        console.log("🔮 Booting Divine Insight Orchestrator...");
        
        try {
            // 1. Fetch the raw JSON text so the worker owns parsing and normalization
            const response = await fetch('divine-insight-optimized.json');
            this.deckDataText = await response.text();
            
            // 2. Spin up the logic worker and wire up result/error handling
            this.logicWorker = new Worker(new URL('../logic-worker.js', import.meta.url));
            this.logicWorker.onmessage = this.handleWorkerResponse.bind(this);
            this.logicWorker.onerror = (error) => {
                console.error('❌ Logic worker encountered an error:', error.message || error);
            };
            this.logicWorker.onmessageerror = (error) => {
                console.error('❌ Logic worker could not deserialize a message:', error);
            };
            
            // 3. Initialize the deck in the worker
            this.logicWorker.postMessage({ type: 'INIT_DECK', payload: this.deckDataText });

            // 4. Initialize the Audio Engine with DOM elements
            await this.ambientEngine.init({
                baseEl: document.getElementById('audio-base'),
                swooshEl: document.getElementById('audio-swoosh'),
                sfxHover: document.getElementById('audio-hover'),
                sfxDraw: document.getElementById('audio-draw'),
                sfxFlip: document.getElementById('audio-flip')
            });
            
            // 5. Bind UI listeners
            this.bindEvents();

            console.log("✨ System Ready");
        } catch (error) {
            console.error("Failed to initialize system:", error);
        }
    }

    bindEvents() {
        const seekBtn = document.getElementById('btn-seek-insight');
        const intentInput = document.querySelector('.whisper-input');
        const cardElement = document.getElementById('tarot-card');
        const deckStack = document.querySelector('.group.float-animation');

        seekBtn.addEventListener('click', () => {
            const intentText = intentInput.value;
            
            // 1. Swell the actual Web Audio API nodes
            this.ambientEngine.swell(); 
            
            // 2. Fetch current physical velocity from your DragController
            const currentVelocity = this.dragController?.inputState?.velocity || 1.0;
            
            // 3. Send the prompt to the Web Worker for deterministic synthesis
            this.requestDraw(intentText, currentVelocity);
        });

        // Add Hover Effects
        [cardElement, deckStack].forEach(el => {
            if (el) {
                el.addEventListener('mouseenter', () => {
                    this.ambientEngine.playEffect('hover');
                });
            }
        });
    }

    // --- Module Routing ---

    handleInteraction(event) {
        if (event.type === 'HIGH_VELOCITY') {
            // Tell the audio engine to swell the volume based on physical swipe speed
            this.ambientEngine.adjustHum(event.value);
        } else if (event.type === 'MOUSE_MOVE') {
            // Route coordinates to the card view for 3D tilt
            this.cardView.updateMousePos(event.x, event.y);
        } else if (event.type === 'DRAG_START') {
            this.cardView.setDragging(true);
        } else if (event.type === 'DRAG_END') {
            this.cardView.setDragging(false);
            // If the card is already in a spread/result layout, resume dynamics
            if (this.cardView._spreadLayout) {
                this.cardView.startDynamicsLoop();
            }
        }
    }

    requestDraw(intentText, physicalVelocity) {
        // 1. Trigger UI and Audio
        this.cardView.showChanneling();
        this.ambientEngine.playDrawSound();
        
        // 2. Calculate entropy modifier based on the user's typed intent
        const intentWeight = intentText.trim().length > 0 ? intentText.length : 1;

        // 3. Package the seed data for the worker
        const seedData = {
            timestamp: performance.now(),
            velocityMetric: physicalVelocity * intentWeight
        };

        // 4. Send to the Logic Engine
        this.logicWorker.postMessage({ type: 'REQUEST_DRAW', payload: seedData });
    }

    handleWorkerResponse(event) {
        if (event.data.type === 'DRAW_RESULT') {
            const result = event.data.payload;
            
            // Route the final result to the View and trigger the flip audio
            this.cardView.showResult(result);
            this.ambientEngine.playFlipSound();
        }
    }
}