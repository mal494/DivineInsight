# Divine Insight 🎴

A high-performance, web-based Tarot reading application featuring a millisecond-precision draw engine, Web Worker-driven logic, and a decoupled 78-card JSON taxonomy. This project is built with a modular ES6 JavaScript architecture to ensure maintainability, fluid 60fps interactions, and an immersive audio-visual experience.

## ⚙️ Technical Architecture

This MVP focuses on processing speed and fluid interaction, utilizing modern web standards without the overhead of heavy frameworks:

* **Modular Structure:** The front-end is cleanly divided into specific controllers for state orchestration, DOM manipulation, and pointer tracking.
* **Web Worker Engine:** Core calculations—including the 1-to-5 influence scale, entropy pooling based on user swipe speed, and array shuffling—are offloaded to a background thread to prevent main-thread blocking.
* **Decoupled Taxonomy:** Card data is managed via a rigid JSON schema (`tarot_data.json`) containing structured metadata (elemental affinities, astrological associations) for dynamic, context-aware readings.
* **Interactive Audio:** Utilizes the Web Audio API to drive an ambient soundscape that reacts to the application's state.

## Vector Spread Contract

The worker now parses and normalizes `divine-insight-optimized.json` once during initialization, then returns deterministic vector metadata with each draw result.

* `vectorState` describes the session-level direction, drift, magnitude, and spread radius.
* `positionVector` describes the selected card's derived placement and spread index.
* `CardView.showResult()` consumes this data additively, so the existing flip and reveal flow remains intact.

### Draw Result Contract (schemaVersion: 1)

`logic-worker.js` returns `DRAW_RESULT` payloads with:

* `schemaVersion` (`1`)
* card identity: `cardKey`, `cardId`, `cardName`
* deterministic orientation: `orientation` (`upright` or `reversed`)
* interpretation fields: `keywords`, `localWeights`, `meanings`
* vector fields: `vectorState`, `positionVector`, `cardBasis`
* compatibility projection: `nodes[0]` for UI bindings

Invalid payloads are now treated as contract failures in the app orchestration layer.

## App State Flow

The app now uses explicit orchestration states:

* `booting` → startup and dependency initialization
* `idle` → ready for draw
* `channeling` → draw in progress (duplicate draws blocked)
* `revealed` → card resolved and rendered
* `error` → recoverable user-visible error state

## Run / Verify Workflow

1. Start a static server from `digital-divine-insight`:

   `python3 -m http.server 8000`

2. Open `http://localhost:8000`.
3. Verify:
   * draw is blocked during channeling
   * status updates are visible under the primary action
   * Past Readings opens in-app Arcana Journal panel
   * Deck Gallery opens and renders all cards
   * Altar Settings sliders affect audio/visual intensity
   * service worker registers and offline shell loads after first visit
   * reduced-motion mode minimizes animation

## Browser Smoke Checklist

* Desktop Chrome latest
* Desktop Firefox latest
* Safari (macOS/iOS) basic interaction and audio fallback
* Mobile Chrome (Android) touch drag + draw + journal

## Troubleshooting

* **No audio playback:** some browsers require user interaction before audio can play.
* **Worker initialization failure:** confirm `divine-insight-optimized.json` is served by HTTP, not `file://`.
* **Offline cache stale:** refresh once after deploy to activate new service worker cache version.
* **Journal unavailable:** browser storage restrictions can prevent local persistence.

## 📁 Project Structure

The application utilizes a small, module-based JavaScript structure for clear separation of concerns:

* `app.js` — The bootstrap entrypoint that initializes the application.
* `modules/DivineInsightApp.js` — Core orchestration, wiring UI controllers, KarenVault persistence, and workers.
* `modules/DragController.js` — Handles precise pointer tracking and drives the render loop for physical card interactions.
* `modules/CardView.js` — Manages DOM updates, flip animations, and visual status handling for the deck.
* `modules/ambientEngine.js` — The Web Audio API ambient controller responsible for the interactive soundscape.
* `JournalView.js`, `GalleryView.js`, `SettingsView.js` — Side-panel UI controllers for journal, gallery, and settings.
* `KarenVault.js`, `ManagerView.js`, `karen-worker.js`, `mikey-worker.js` — IndexedDB vault, optional manager console view, and delegated rendering/incident pipeline.

## 💻 Local Setup

To run this project locally, a development server is required so the ES6 modules, Web Worker, and audio assets load correctly without triggering CORS restrictions.

1. Clone the repository:

   git clone <https://github.com/mal494/DivineInsight.git>

2. Navigate to the project directory:

    cd DivineInsight

3. Start a local development server. You can use any static server

    python3 -m http.server 8000

4. Open your browser and navigate to `http://localhost:8000` to see the application in action.
