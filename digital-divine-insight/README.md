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

## 📁 Project Structure

The application utilizes a small, module-based JavaScript structure for clear separation of concerns:

* `app.js` — The bootstrap entrypoint that initializes the application.
* `modules/app/DivineInsightApp.js` — Core application orchestration, managing state and connecting the UI components to the background worker.
* `modules/components/DragController.js` — Handles precise pointer tracking and drives the render loop for physical card interactions.
* `modules/components/CardView.js` — Manages DOM updates, flip animations, and visual status handling for the deck.
* `ambientEngine.js` — The Web Audio API ambient controller responsible for the interactive soundscape.

## 💻 Local Setup

To run this project locally, a development server is required so the ES6 modules, Web Worker, and audio assets load correctly without triggering CORS restrictions.

1. Clone the repository:

   git clone <https://github.com/mal494/DivineInsight.git>

2. Navigate to the project directory:

    cd DivineInsight

3. Start a local development server. You can use any static server

    python3 -m http.server 8000

4. Open your browser and navigate to `http://localhost:8000` to see the application in action.
