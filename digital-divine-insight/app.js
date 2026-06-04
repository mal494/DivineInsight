// app.js - The Bootstrap Entrypoint
import { DivineInsightApp } from './modules/app/DivineInsightApp.js';
import { STATUS_MESSAGES } from './modules/content/messages.js';

/**
 * Registers the service worker to enable offline support and PWA capabilities.
 * @returns {Promise<ServiceWorkerRegistration|null>} The service worker registration, or null if unsupported/failed.
 */
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.info('Service Worker is not supported in this browser.');
        return null;
    }

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

// Initialize the application when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', async () => {
    const app = new DivineInsightApp();
    
    // Register the service worker concurrently (non-blocking)
    registerServiceWorker();

    try {
        await app.initialize();
        console.log('Divine Insight initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize Divine Insight:', err);
        window.dispatchEvent(new CustomEvent('app:error', {
            detail: STATUS_MESSAGES.INIT_FAILED
        }));
    }
});
