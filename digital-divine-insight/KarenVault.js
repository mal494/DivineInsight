/**
 * KarenVault - A "hidden" secure repository for Karen's thoughts.
 * Utilizes IndexedDB for persistent, local-only storage.
 */

const DB_NAME = 'KarenSanctum';
const THOUGHT_STORE = 'thought_logs';
const INCIDENT_STORE = 'incidents';
const READING_STORE = 'readings';
let db = null;

/**
 * Initializes the database.
 */
async function init() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, 3); // Upgrade to version 3

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(THOUGHT_STORE)) {
                database.createObjectStore(THOUGHT_STORE, { keyPath: 'id', autoIncrement: true });
            }
            if (!database.objectStoreNames.contains(INCIDENT_STORE)) {
                database.createObjectStore(INCIDENT_STORE, { keyPath: 'id', autoIncrement: true });
            }
            // Add the new journal readings store
            if (!database.objectStoreNames.contains(READING_STORE)) {
                database.createObjectStore(READING_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("❌ Karen's Sanctum is inaccessible:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Adds a new thought to the vault.
 */
export async function addThought(thought) {
    try {
        const database = await init();
        const transaction = database.transaction([THOUGHT_STORE], 'readwrite');
        const store = transaction.objectStore(THOUGHT_STORE);
        store.add({
            ...thought,
            loggedAt: new Date().toISOString()
        });
    } catch (error) {
        // Fail silently
    }
}

/**
 * Formally archives a system failure in Karen's incident network.
 */
export async function reportIncident(incident) {
    try {
        const database = await init();
        const transaction = database.transaction([INCIDENT_STORE], 'readwrite');
        const store = transaction.objectStore(INCIDENT_STORE);
        store.add({
            ...incident,
            loggedAt: new Date().toISOString(),
            status: 'UNRESOLVED - KAREN NOTIFIED'
        });
    } catch (e) {
        // Fail silently
    }
}

/**
 * Securely saves a tarot reading to the vault.
 */
export async function saveReading(reading) {
    try {
        const database = await init();
        const transaction = database.transaction([READING_STORE], 'readwrite');
        const store = transaction.objectStore(READING_STORE);
        store.add({
            ...reading,
            loggedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error("❌ Failed to save reading to vault:", e);
    }
}

/**
 * Retrieves all stored readings, sorted by date (newest first).
 */
export async function getReadings() {
    const database = await init();
    return new Promise((resolve) => {
        const transaction = database.transaction([READING_STORE], 'readonly');
        const store = transaction.objectStore(READING_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            // Sort by ID (since it's auto-incrementing/timestamped) descending
            const results = request.result.sort((a, b) => b.id - a.id);
            resolve(results);
        };
    });
}

/**
 * Retrieves all archived incident reports.
 */
export async function getIncidents() {
    const database = await init();
    return new Promise((resolve) => {
        const transaction = database.transaction([INCIDENT_STORE], 'readonly');
        const store = transaction.objectStore(INCIDENT_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Retrieves all thoughts from the vault.
 */
export async function getThoughts() {
    const database = await init();
    return new Promise((resolve) => {
        const transaction = database.transaction([THOUGHT_STORE], 'readonly');
        const store = transaction.objectStore(THOUGHT_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}
