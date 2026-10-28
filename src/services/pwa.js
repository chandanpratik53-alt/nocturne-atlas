// src/services/pwa.js
// Nocturne Atlas - Service Worker Registration & PWA Diagnostics
// Subpath-safe for GitHub Pages

let deferredInstallPrompt = null;
let registrationPromise = null;
let lastRegistrationError = null;

let pwaStatus = {
  isRegistered: false,
  isInstalled: false,
  isInstallable: false,
  isOffline: !navigator.onLine,
  registrationError: null
};

/**
 * Register Service Worker using relative path for GitHub Pages subpath compatibility
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported or blocked in this browser context.');
    return null;
  }

  // Use relative path './sw.js' so it operates within any hosting subpath
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    pwaStatus.isRegistered = true;
    pwaStatus.registrationError = null;
    lastRegistrationError = null;
    console.log('[PWA] Service Worker registered with scope:', registration.scope);

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content is available; please refresh.');
            window.dispatchEvent(new CustomEvent('nocturne-sw-updated'));
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.warn('[PWA] Service Worker registration failed:', error);
    pwaStatus.isRegistered = false;
    pwaStatus.registrationError = error.message || String(error);
    lastRegistrationError = pwaStatus.registrationError;
    return null;
  }
}

/**
 * Initialize install prompt handlers and connectivity listeners
 */
export function initPWA() {
  // Listen for beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    pwaStatus.isInstallable = true;
    console.log('[PWA] Application is installable.');
    window.dispatchEvent(new CustomEvent('nocturne-installable', { detail: { installable: true } }));
  });

  // Check if launched in standalone / installed mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://');
  if (isStandalone) {
    pwaStatus.isInstalled = true;
    pwaStatus.isInstallable = false;
  }

  // Listen for appinstalled
  window.addEventListener('appinstalled', () => {
    pwaStatus.isInstalled = true;
    pwaStatus.isInstallable = false;
    deferredInstallPrompt = null;
    console.log('[PWA] Nocturne Atlas was successfully installed.');
    window.dispatchEvent(new CustomEvent('nocturne-installed'));
  });

  // Connectivity listeners
  window.addEventListener('online', () => {
    pwaStatus.isOffline = false;
    window.dispatchEvent(new CustomEvent('nocturne-connectivity', { detail: { online: true } }));
  });

  window.addEventListener('offline', () => {
    pwaStatus.isOffline = true;
    window.dispatchEvent(new CustomEvent('nocturne-connectivity', { detail: { online: false } }));
  });

  // Trigger worker registration and retain the promise
  registrationPromise = registerServiceWorker();

  return pwaStatus;
}

/**
 * Prompt user to install the PWA
 */
export async function promptPWAInstall() {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable', message: 'Install prompt is not currently available in this browser.' };
  }

  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  pwaStatus.isInstallable = false;
  return choiceResult;
}

export function getPWAStatus() {
  return { ...pwaStatus };
}

/**
 * Thorough, live PWA & Offline Diagnostics.
 * Verifies real secure context, actual Service Worker state, and queries CacheStorage.
 * Never claims offline readiness without concrete evidence.
 */
export async function getPWADiagnostics() {
  const isWindow = typeof window !== 'undefined';
  const protocol = isWindow ? window.location.protocol : 'unknown';
  const hostname = isWindow ? window.location.hostname : 'unknown';
  const host = isWindow ? window.location.host : 'unknown';
  const isSecureContext = isWindow ? Boolean(window.isSecureContext) : false;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  const isHttps = protocol === 'https:';
  const isFileSystem = protocol === 'file:';

  // 1. Origin & Secure Context Evaluation
  let originLabel = `${protocol}//${host || 'local'}`;
  let originSecurity = 'Supported';
  let originExplanation = '';

  if (isFileSystem) {
    originLabel = 'Local File System (file://)';
    originSecurity = 'Unsupported Context';
    originExplanation = 'Browsers disallow Service Workers on the file:// protocol. Launch dev.bat to run the app over http://localhost:3000.';
  } else if (isHttps) {
    originLabel = `Secure HTTPS (${hostname})`;
    originSecurity = 'Secure Context (Supported)';
    originExplanation = 'Encrypted HTTPS origin. Supported for Service Worker caching, offline use, and PWA installation.';
  } else if (isLocalhost) {
    originLabel = `Localhost Development (${host})`;
    originSecurity = 'Loopback Secure Context (Supported)';
    originExplanation = 'Browsers treat http://localhost as a trusted secure origin for Service Worker testing.';
  } else {
    originLabel = `Insecure Network Origin (${host})`;
    originSecurity = 'Insecure HTTP Origin (Blocked)';
    originExplanation = `You are accessing this app over an unencrypted network IP (${host}). Browser security policies disable Service Workers on insecure network origins. Use localhost on this machine or deploy with HTTPS (e.g. GitHub Pages).`;
  }

  // 2. Service Worker API & Real Registration Evaluation
  const hasSWApi = isWindow && ('serviceWorker' in navigator);
  let swStatus = 'Unavailable';
  let swActive = false;
  let swControlled = false;

  if (!hasSWApi) {
    swStatus = !isSecureContext
      ? 'Blocked by browser (requires HTTPS or localhost)'
      : 'Not supported by this browser';
  } else {
    try {
      // Await pending registration if currently in progress
      if (registrationPromise) {
        await registrationPromise;
      }
      const reg = await navigator.serviceWorker.getRegistration('./');
      swControlled = Boolean(navigator.serviceWorker.controller);

      if (reg) {
        if (swControlled) {
          swStatus = '✓ Active & Controlling Page';
          swActive = true;
        } else if (reg.active) {
          swStatus = 'Active (Reload page to claim control)';
          swActive = true;
        } else if (reg.installing) {
          swStatus = 'Installing shell assets...';
        } else if (reg.waiting) {
          swStatus = 'Waiting to activate (Reload to activate)';
        } else {
          swStatus = 'Registered';
        }
      } else if (lastRegistrationError || pwaStatus.registrationError) {
        swStatus = `Registration Failed: ${lastRegistrationError || pwaStatus.registrationError}`;
      } else {
        swStatus = 'Not registered yet';
      }
    } catch (err) {
      swStatus = `Registration check failed: ${err.message || 'Security restriction'}`;
    }
  }

  // 3. Concrete Cache Verification via CacheStorage API
  let cacheVerified = false;
  let cachedAssetCount = 0;
  let cacheStatus = 'Unverified';

  if (isWindow && ('caches' in window)) {
    try {
      const allCacheKeys = await caches.keys();
      const shellKey = allCacheKeys.find(k => k.startsWith('nocturne-atlas-shell'));
      if (shellKey) {
        const cache = await caches.open(shellKey);
        const keys = await cache.keys();
        cachedAssetCount = keys.length;
        if (cachedAssetCount > 0) {
          cacheVerified = true;
          cacheStatus = `✓ Verified (${cachedAssetCount} shell assets in ${shellKey})`;
        } else {
          cacheStatus = 'Cache container created, assets downloading...';
        }
      } else {
        cacheStatus = isSecureContext
          ? 'Not yet cached (first download in progress)'
          : 'Unavailable (Service Worker blocked by origin)';
      }
    } catch {
      cacheStatus = 'Cache query restricted by browser';
    }
  } else {
    cacheStatus = 'CacheStorage API not supported';
  }

  // 4. Offline Readiness (Strict Verification)
  let offlineReadiness = 'Not verified';
  let isOfflineReady = false;

  if (cacheVerified && swControlled) {
    offlineReadiness = '✓ Verified: Operates offline after initial load';
    isOfflineReady = true;
  } else if (cacheVerified && swActive) {
    offlineReadiness = 'Shell cached; reload required to activate offline worker';
    isOfflineReady = false;
  } else if (!isSecureContext || isFileSystem) {
    offlineReadiness = 'Unavailable (origin does not support Service Worker caching)';
    isOfflineReady = false;
  } else {
    offlineReadiness = 'Not verified (awaiting cache download and worker activation)';
    isOfflineReady = false;
  }

  // 5. Standalone / Installation Mode
  const isStandalone = isWindow && (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(window.navigator.standalone) ||
    document.referrer.includes('android-app://')
  );

  let installLabel = 'Web Browser (Standard tab)';
  if (isStandalone) {
    installLabel = 'Installed App (Standalone display mode)';
  } else if (pwaStatus.isInstallable) {
    installLabel = 'Installable (Browser prompt available)';
  }

  return {
    originLabel,
    originSecurity,
    originExplanation,
    isSecureContext,
    isFileSystem,
    isLocalhost,
    isHttps,
    hasSWApi,
    swStatus,
    swActive,
    swControlled,
    cacheVerified,
    cachedAssetCount,
    cacheStatus,
    offlineReadiness,
    isOfflineReady,
    isStandalone,
    isInstallable: pwaStatus.isInstallable,
    installLabel
  };
}
