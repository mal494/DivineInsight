// app.js - The Bootstrap Entrypoint
import { DivineInsightApp } from './modules/DivineInsightApp.js';

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate the orchestrator
    const app = new DivineInsightApp();
    
    // Boot the system
    app.initialize().catch(err => {
        console.error("Failed to initialize Divine Insight:", err);
    });
});