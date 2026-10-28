# Nocturne Atlas 🌙

> An offline-first, private personal sleep-tracking Progressive Web App (PWA).  
> Designed with circadian precision, zero cloud dependencies, and uncompromising user data ownership.

---

## 🧭 Phase 1: Project Foundation Overview

Nocturne Atlas is engineered as a zero-dependency, standards-compliant Progressive Web App built on standard Web APIs (ES Modules, IndexedDB, CSS Custom Properties, and Service Workers).

### Core Highlights
- **100% Offline-First & Private:** All user sleep data is kept strictly inside your local browser via IndexedDB. There are no cloud servers, no user accounts, no analytics tracking, and no external AI endpoints.
- **Dual Visual Theme System:**
  - **Dark Theme:** Deep **Ink Plum** (`#171629`) surfaces paired with **Tidal Mint** (`#8ADBD0`) and **Orbit Lilac** (`#AAA0FF`) accents.
  - **Light Theme:** **Moon Paper** (`#F3EFE7`) surfaces with high-contrast, readable typography.
  - **System Dynamic Mode:** Automatically tracks your OS theme preference. Persists locally in `localStorage`.
- **4 Permanent Navigation Destinations:**
  1. **Home:** 24-hour circular sleep map dial, key sleep indicators, 7-day rhythm preview, and recent session archive.
  2. **Insights:** Longitudinal sleep trends, chronobiology evidence principles, and weekly habit experiments.
  3. **History:** Monthly calendar density matrix and chronological session history.
  4. **Settings:** Theme controls, PWA install status, IndexedDB diagnostics, privacy guarantees, and Phase 3 export/import anchors.
- **Dedicated Journal Action ("Log Sleep"):**
  - Accessible from the mobile bottom bar and desktop sidebar.
  - Opens a dedicated journal form dialog with start/end times, subjective quality ratings, behavioral tags, and notes.
  - **Honest Foundation Notice:** The structural form is fully interactive, but active session calculations and persistence are deferred to Phase 2.
- **GitHub Pages Subpath Ready:** All asset links (`./`), manifest scopes (`./`), and service worker registrations (`./sw.js`) are relative, enabling seamless deployment to subpaths such as `https://username.github.io/Sleep-Tracker/`.

---

## 🚀 Running Locally on Windows

You can run Nocturne Atlas immediately using either option:

### Option A: One-Click Batch Script (Recommended for Windows)
Simply double-click or run:
```cmd
.\dev.bat
```
This automatically detects your Node runtime (including Antigravity's bundled Node) and launches the local development server at:
👉 **[http://localhost:3000](http://localhost:3000)**

### Option B: Command Line (Node.js)
```bash
npm start
# or: node scripts/dev-server.js
```

### Option C: Any Static Web Server
Since Nocturne Atlas requires no compilation or bundling, you can also use:
- VS Code Live Server extension
- Python: `python -m http.server 3000`
- `npx serve .`

---

## 🧪 Running Verification Checks

To run the automated Phase 1 Acceptance Suite (107 checks covering files, subpath safety, manifest, service worker privacy, database schema, themes, and server integration):

### Option A: One-Click Batch Script
```cmd
.\test.bat
```

### Option B: Command Line
```bash
npm test
# or: node scripts/verify.js
```

---

## 📂 Project Structure

```text
d:\Pratik\APPS\Sleep Tracker\
├── index.html                  # Accessible semantic application shell & dialogs
├── manifest.webmanifest         # PWA Web App Manifest (relative subpath-safe)
├── sw.js                       # Service Worker (offline caching, zero data caching)
├── favicon.svg                 # Scalable vector favicon
├── package.json                # Project descriptor & scripts
├── dev.bat                     # Windows one-click local server starter
├── test.bat                    # Windows one-click verification test runner
├── README.md                   # Project documentation & beginner's guide
├── assets/
│   ├── icon.svg                # Master vector brand mark
│   ├── icon-192.png            # 192x192 PWA launcher icon
│   ├── icon-512.png            # 512x512 PWA launcher icon
│   └── icon-maskable.png       # 512x512 adaptive/maskable icon
├── css/
│   ├── variables.css           # Design tokens (Ink Plum, Moon Paper, Mint, Lilac, Afterglow)
│   ├── base.css                # Reset, typography, accessibility, touch sizing
│   ├── layout.css              # Responsive layout (mobile bottom-nav + desktop sidebar)
│   ├── components.css          # Cards, buttons, dialogs, form controls, badges
│   └── screens.css             # Screen-specific layouts (Sleep Map, Heatmap, Settings)
├── src/
│   ├── app.js                  # Application coordinator & bootstrap
│   ├── storage/
│   │   └── db.js               # IndexedDB schema, connection manager, migration scaffold
│   ├── services/
│   │   ├── theme.js            # Theme controller (dark/light/system, persistence)
│   │   ├── pwa.js              # PWA installation & service worker registration
│   │   └── navigation.js       # Destination router & active state manager
│   ├── components/
│   │   ├── logModal.js         # Dedicated Log Sleep dialog controller
│   │   └── emptyState.js       # Reusable accessible empty state component
│   └── screens/
│       ├── homeScreen.js       # Home screen view
│       ├── insightsScreen.js   # Insights screen view
│       ├── historyScreen.js    # History screen view
│       └── settingsScreen.js   # Settings screen view
└── scripts/
    ├── dev-server.js           # Built-in lightweight zero-dependency HTTP server
    ├── generate-icons.js       # Generates crisp PNG icons using pure Node zlib
    └── verify.js               # Phase 1 acceptance verification suite
```

---

## 🔒 Privacy & Architecture Principles
1. **Zero Recurring Costs:** No hosted databases, no authentication systems, no third-party APIs.
2. **Offline Resilience:** App shell is cached by the service worker; works fully offline after first load.
3. **Data Isolation:** User sleep data never enters service worker caches or network payloads.
4. **Transparent Evolution:** No fake metrics or simulated sleep scores. Features are activated systematically across phases.
