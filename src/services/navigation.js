// src/services/navigation.js
// Nocturne Atlas - Navigation Manager
// Controls 4 permanent destinations: Home, Insights, History, Settings

export const DESTINATIONS = ['home', 'insights', 'history', 'settings'];
let currentDestination = 'home';
const listeners = new Set();

/**
 * Switch to a specific screen destination
 */
export function navigateTo(destination, updateHash = true) {
  if (!DESTINATIONS.includes(destination)) {
    destination = 'home';
  }

  currentDestination = destination;

  if (updateHash) {
    window.location.hash = `#/${destination}`;
  }

  // Update screen visibility
  DESTINATIONS.forEach((dest) => {
    const screenEl = document.getElementById(`screen-${dest}`);
    if (screenEl) {
      if (dest === destination) {
        screenEl.removeAttribute('hidden');
        screenEl.classList.add('screen-active');
      } else {
        screenEl.setAttribute('hidden', '');
        screenEl.classList.remove('screen-active');
      }
    }
  });

  // Update navigation buttons (mobile bottom nav and desktop sidebar nav)
  const navButtons = document.querySelectorAll('[data-nav-target]');
  navButtons.forEach((btn) => {
    const target = btn.getAttribute('data-nav-target');
    const isCurrent = target === destination;
    btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    btn.classList.toggle('nav-item-active', isCurrent);
  });

  // Notify registered callbacks
  listeners.forEach((fn) => {
    try {
      fn(destination);
    } catch (e) {
      console.error('[Nav] Listener error:', e);
    }
  });

  // Scroll to top of main content
  const main = document.querySelector('main');
  if (main) {
    main.scrollTop = 0;
  }
}

/**
 * Register navigation listener
 */
export function onNavigate(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Initialize navigation from current URL hash and bind hashchange
 */
export function initNavigation() {
  function handleHash() {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
    const target = DESTINATIONS.includes(rawHash) ? rawHash : 'home';
    navigateTo(target, false);
  }

  window.addEventListener('hashchange', handleHash);

  // Bind click handlers on all navigation elements
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav-target]');
    if (navBtn) {
      e.preventDefault();
      const target = navBtn.getAttribute('data-nav-target');
      navigateTo(target, true);
    }
  });

  handleHash();
}

export function getCurrentDestination() {
  return currentDestination;
}
