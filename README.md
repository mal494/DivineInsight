# Divine Insight 🎴

A high-performance, web-based Tarot reading application featuring a millisecond-precision draw engine, Web Worker-driven logic, and a decoupled 78-card JSON taxonomy. This project is built with a modular ES6 JavaScript architecture to ensure maintainability, fluid 60fps interactions, and an immersive audio-visual experience.

## ⚙️ Technical Architecture

This MVP focuses on processing speed and fluid interaction, utilizing modern web standards without the overhead of heavy frameworks:

- **Modular Structure:** The front-end is cleanly divided into specific controllers for state orchestration, DOM manipulation, and pointer tracking.
- **Web Worker Engine:** Core calculations — including the 1-to-5 influence scale, entropy pooling based on user swipe speed, and array shuffling — are offloaded to a background thread to prevent main-thread blocking.
- **Decoupled Taxonomy:** Card data is managed via a rigid JSON schema (`divine-insight-optimized.json`) containing structured metadata (elemental affinities, astrological associations) for dynamic, context-aware readings.
- **Interactive Audio:** Utilizes the Web Audio API to drive an ambient soundscape that reacts to the application's state.

The app is a **progressive web app (PWA)**: a service worker (`sw.js`) provides offline support, and `manifest.webmanifest` makes it installable.

## ✅ Prerequisites

| What | Why | Version |
|------|-----|---------|
| A browser | Run the app | Any modern browser (Chrome, Firefox, Safari, Edge) |
| Node.js | Run the test suite only | >= 18 (tested on 20 and 22) |

There is **no build step and no framework** — the app is plain ES6 modules served as static files. A static HTTP server is required only so that modules, Web Workers, and assets load without CORS restrictions (opening `index.html` directly via `file://` will not work).

## 🚀 Quickstart

Clone the repository:

```bash
git clone https://github.com/mal494/DivineInsight.git
cd DivineInsight
```

Serve the app from the `digital-divine-insight/` directory (this is the document root — it contains `index.html`). Either of these works:

```bash
# Option A: Python's built-in server
cd digital-divine-insight
python3 -m http.server 8000

# Option B: Node's npx serve (no install needed)
cd digital-divine-insight
npx serve .
```

Then open **http://localhost:8000** in your browser to see the application in action. (Both commands serve the current directory; if you already ran one, you can stop it with `Ctrl+C`.)

## 🧪 Running Tests

The test suite uses Node's built-in test runner (`node --test`) — no dependencies to install.

```bash
npm test
```

Tests cover the core deck/reading utility modules under `tests/core/`.

## 📁 Project Structure

```
DivineInsight/
├── package.json              # Scripts (test → `node --test`), no runtime deps
├── package-lock.json         # Lockfile for reproducible CI installs
├── DESIGN.md                 # Vision & identity documentation
├── tests/
│   └── core/                 # Node test runner suites for deck/reading logic
└── digital-divine-insight/   # The static app (served directly)
    ├── index.html            # Entry point
    ├── app.js                # Bootstrap entrypoint; registers the service worker
    ├── styles.css
    ├── sw.js                 # Service worker (offline / PWA caching)
    ├── manifest.webmanifest  # PWA manifest
    ├── logic-worker.js       # Deterministic draw engine + vector synthesis contract
    ├── karen-worker.js       # "Karen" incident/error-tracking worker
    ├── mikey-worker.js       # Additional background worker
    ├── divine-insight-optimized.json  # 78-card deck taxonomy
    ├── modules/
    │   ├── app/DivineInsightApp.js    # Core application orchestration/state management
    │   ├── audio/ambientEngine.js     # Web Audio API ambient soundscape
    │   ├── components/                # CardView, DragController (rendering + pointer tracking)
    │   ├── content/                   # UI copy and synthesis templates
    │   └── core/                      # deckUtils, readingUtils (shared, unit-tested logic)
    ├── assets/               # img (deck art, icon), audio, fx (particles)
    ├── GalleryView.js / JournalView.js / ManagerView.js / SettingsView.js / KarenVault.js
    └── README.md             # App-level docs: verify workflow + smoke checklist
```

## 🐛 Issues

If you find a bug or have a feature request, please open an issue on GitHub.