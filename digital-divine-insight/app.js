// app.js - The Bootstrap Entrypoint
import { DivineInsightApp } from './modules/DivineInsightApp.js';

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;

    try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    window.dispatchEvent(new CustomEvent('app:status', {
                        detail: 'An update is ready. Refresh to get the latest version.'
                    }));
                }
            });
        });

        return registration;
    } catch (error) {
        console.warn('Service worker registration failed:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new DivineInsightApp();
    await registerServiceWorker();

    app.initialize().catch(err => {
        console.error('Failed to initialize Divine Insight:', err);
        window.dispatchEvent(new CustomEvent('app:error', {
            detail: 'Initialization failed. Please refresh and try again.'
        }));
    });
});