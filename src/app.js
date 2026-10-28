// src/app.js
// Nocturne Atlas - Application Controller (Phase 2 Real Sleep Logging)

import { initTheme } from './services/theme.js';
import { initDB } from './storage/db.js';
import { initPWA } from './services/pwa.js';
import { initNavigation, onNavigate, getCurrentDestination } from './services/navigation.js';
import { initLogSleepModal } from './components/logModal.js';
import { renderHomeScreen } from './screens/homeScreen.js';
import { renderInsightsScreen } from './screens/insightsScreen.js';
import { renderHistoryScreen } from './screens/historyScreen.js';
import { renderSettingsScreen } from './screens/settingsScreen.js';

async function refreshAllScreens() {
  await Promise.all([
    renderHomeScreen(),
    renderInsightsScreen(),
    renderHistoryScreen(),
    renderSettingsScreen()
  ]);
}

async function bootstrap() {
  console.log('[Nocturne Atlas] Initializing Phase 2 Real Sleep Logging...');

  // 1. Initialize Theme immediately to prevent flash of wrong theme
  initTheme();

  // 2. Initialize IndexedDB storage engine with versioned schema migrations
  try {
    await initDB();
    console.log('[Nocturne Atlas] IndexedDB initialized successfully (Schema v2).');
  } catch (err) {
    console.error('[Nocturne Atlas] IndexedDB initialization failed:', err);
  }

  // 3. Render all screens into DOM with real IndexedDB data
  await refreshAllScreens();

  // 4. Initialize navigation router
  initNavigation();

  // 5. Initialize the dedicated Log Sleep modal (real logging, editing, deletion)
  initLogSleepModal();

  // 6. Initialize PWA Service Worker and Install listener
  initPWA();

  // 7. Re-render dynamic content when navigating
  onNavigate(async (destination) => {
    if (destination === 'home') {
      await renderHomeScreen();
    } else if (destination === 'history') {
      await renderHistoryScreen();
    } else if (destination === 'insights') {
      await renderInsightsScreen();
    } else if (destination === 'settings') {
      await renderSettingsScreen();
    }
  });

  // 8. Listen for data change events (add, edit, delete, restore, target change)
  window.addEventListener('nocturne-data-changed', async () => {
    await refreshAllScreens();
  });

  // 9. Bind global header theme toggle button for fast one-tap switching
  const quickThemeBtn = document.getElementById('btn-quick-theme-toggle');
  if (quickThemeBtn) {
    quickThemeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      import('./services/theme.js').then(({ applyTheme }) => {
        applyTheme(next);
      });
    });
  }

  console.log('[Nocturne Atlas] Phase 2 Real Sleep Logging ready.');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
