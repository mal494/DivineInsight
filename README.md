Divine Insight 🎴

A high-performance, web-based Tarot reading application featuring a millisecond-precision draw engine, Web Worker-driven logic, and a decoupled 78-card JSON taxonomy. This project is built with a modular ES6 JavaScript architecture to ensure maintainability, fluid 60fps interactions, and an immersive audio-visual experience.
⚙️ Technical Architecture

This MVP focuses on processing speed and fluid interaction, utilizing modern web standards without the overhead of heavy frameworks:

    Modular Structure: The front-end is cleanly divided into specific controllers for state orchestration, DOM manipulation, and pointer tracking.
    Web Worker Engine: Core calculations—including the 1-to-5 influence scale, entropy pooling based on user swipe speed, and array shuffling—are offloaded to a background thread to prevent main-thread blocking.
    Decoupled Taxonomy: Card data is managed via a rigid JSON schema (tarot_data.json) containing structured metadata (elemental affinities, astrological associations) for dynamic, context-aware readings.
    Interactive Audio: Utilizes the Web Audio API to drive an ambient soundscape that reacts to the application's state.

📁 Project Structure

The application utilizes a small, module-based JavaScript structure for clear separation of concerns:

    digital-divine-insight/app.js — The bootstrap entrypoint that initializes the application.
    digital-divine-insight/modules/app/DivineInsightApp.js — Core application orchestration/state management.
    digital-divine-insight/modules/components/DragController.js — Pointer tracking and drag signal emission.
    digital-divine-insight/modules/components/CardView.js — Card rendering, flip flow, and insight panel binding.
    digital-divine-insight/modules/audio/ambientEngine.js — Ambient audio orchestration.
    digital-divine-insight/modules/content/ — UI copy and synthesis content templates separated from runtime logic.
    digital-divine-insight/logic-worker.js — Deterministic draw engine + vector synthesis contract.

💻 Local Setup

To run this project locally, a development server is required so the ES6 modules, Web Worker, and audio assets load correctly without triggering CORS restrictions.

    Clone the repository:

    git clone https://github.com/mal494/DivineInsight.git

    Navigate to the project directory:

    cd DivineInsight

    Start a local development server. You can use any static server

    python3 -m http.server 8000

    Open your browser and navigate to http://localhost:8000 to see the application in action.
