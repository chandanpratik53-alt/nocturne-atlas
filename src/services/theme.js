// src/services/theme.js
// Nocturne Atlas - Theme Manager (Light, Dark, and System-Following)

const THEME_KEY = 'nocturne_theme';
export const THEME_OPTIONS = ['dark', 'light', 'system'];

let currentPreference = 'dark';
let mediaQuery = null;

/**
 * Resolve effective theme ('dark' or 'light') based on user preference and OS mode
 */
function resolveEffectiveTheme(pref) {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  // System mode
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

/**
 * Apply the selected theme to DOM and meta tags
 */
export function applyTheme(pref) {
  if (!THEME_OPTIONS.includes(pref)) {
    pref = 'dark';
  }
  currentPreference = pref;
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch (e) {
    console.warn('[Theme] Could not persist theme to localStorage:', e);
  }

  const effectiveTheme = resolveEffectiveTheme(pref);
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.documentElement.setAttribute('data-theme-mode', pref);

  // Update theme-color meta tag for browser chrome / status bar
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', effectiveTheme === 'dark' ? '#171629' : '#F3EFE7');
  }

  // Dispatch custom event for UI controls (e.g. settings buttons)
  window.dispatchEvent(new CustomEvent('nocturne-theme-changed', {
    detail: { preference: pref, effective: effectiveTheme }
  }));

  return effectiveTheme;
}

/**
 * Initialize theme system on startup
 */
export function initTheme() {
  let stored = 'dark';
  try {
    stored = localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    stored = 'dark';
  }

  if (window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (currentPreference === 'system') {
        applyTheme('system');
      }
    });
  }

  applyTheme(stored);
  return stored;
}

/**
 * Get currently selected preference ('dark', 'light', or 'system')
 */
export function getThemePreference() {
  return currentPreference;
}

/**
 * Get active effective theme ('dark' or 'light')
 */
export function getEffectiveTheme() {
  return resolveEffectiveTheme(currentPreference);
}
