// src/screens/settingsScreen.js
// Nocturne Atlas - Settings Screen (Phase 4 Backup, Restore & Release Hardening)
// Includes: Theme selection, Sleep Target preference, Accurate PWA diagnostics, Database diagnostics, Real JSON Backup & Restore

import { applyTheme, getThemePreference, THEME_OPTIONS } from '../services/theme.js';
import {
  getDatabaseSummary,
  clearAllDatabaseData,
  getTargetSleepMinutes,
  setTargetSleepMinutes,
  getAllSessions,
  getAllHabits,
  getAllExperiments,
  getAllSettings,
  exportAllDatabaseData,
  importRestoreMerge,
  importRestoreReplace
} from '../storage/db.js';
import { promptPWAInstall, getPWADiagnostics } from '../services/pwa.js';
import {
  validateBackupPayload,
  triggerBackupDownload,
  generatePreImportPreview
} from '../services/backup.js';

export async function renderSettingsScreen() {
  const container = document.getElementById('screen-settings');
  if (!container) return;

  const currentTheme = getThemePreference();
  const [dbSummary, currentTargetMin, diag] = await Promise.all([
    getDatabaseSummary().catch(e => { console.warn(e); return null; }),
    getTargetSleepMinutes().catch(() => 480),
    getPWADiagnostics()
  ]);

  // Status badge determined strictly by evidence
  const pwaBadge = diag.isStandalone
    ? '<span class="badge badge-mint">Installed App</span>'
    : diag.isOfflineReady
      ? '<span class="badge badge-mint">Offline Ready</span>'
      : (!diag.isSecureContext || diag.isFileSystem)
        ? '<span class="badge badge-afterglow">Insecure Context</span>'
        : '<span class="badge badge-subtle">Web Shell</span>';

  container.innerHTML = `
    <div class="screen-content">
      <!-- Screen Header -->
      <header class="screen-header">
        <div>
          <span class="subheading-accent">Preferences &amp; Diagnostics</span>
          <h1 class="screen-title">Settings</h1>
        </div>
      </header>

      <!-- 1. Theme Configuration -->
      <section class="card section-card" aria-labelledby="section-theme-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-theme-title" class="section-title">Visual Appearance</h2>
            <p class="section-subtitle">Nocturne Atlas is crafted with Ink Plum and Moon Paper palettes.</p>
          </div>
          <span class="badge badge-mint" id="theme-active-badge">Active: ${currentTheme.toUpperCase()}</span>
        </div>

        <div class="theme-selector-group" role="radiogroup" aria-label="Theme options">
          <label class="theme-option-card ${currentTheme === 'dark' ? 'selected' : ''}">
            <input type="radio" name="theme-choice" value="dark" ${currentTheme === 'dark' ? 'checked' : ''} class="sr-only" />
            <div class="theme-preview-swatch dark-preview">
              <span class="swatch-circle mint"></span>
              <span class="swatch-circle lilac"></span>
            </div>
            <div class="theme-info">
              <span class="theme-name">Dark Theme</span>
              <span class="theme-desc">Ink Plum surfaces with Tidal Mint &amp; Orbit Lilac accents.</span>
            </div>
          </label>

          <label class="theme-option-card ${currentTheme === 'light' ? 'selected' : ''}">
            <input type="radio" name="theme-choice" value="light" ${currentTheme === 'light' ? 'checked' : ''} class="sr-only" />
            <div class="theme-preview-swatch light-preview">
              <span class="swatch-circle mint"></span>
              <span class="swatch-circle dark-plum"></span>
            </div>
            <div class="theme-info">
              <span class="theme-name">Light Theme</span>
              <span class="theme-desc">Moon Paper surfaces with crisp, readable contrast.</span>
            </div>
          </label>

          <label class="theme-option-card ${currentTheme === 'system' ? 'selected' : ''}">
            <input type="radio" name="theme-choice" value="system" ${currentTheme === 'system' ? 'checked' : ''} class="sr-only" />
            <div class="theme-preview-swatch system-preview">
              <span class="swatch-half-dark"></span>
              <span class="swatch-half-light"></span>
            </div>
            <div class="theme-info">
              <span class="theme-name">System Dynamic</span>
              <span class="theme-desc">Automatically matches your operating system preference.</span>
            </div>
          </label>
        </div>
      </section>

      <!-- 2. Personal Sleep Target Preference (Configurable) -->
      <section class="card section-card" aria-labelledby="section-target-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-target-title" class="section-title">Personal Sleep Target</h2>
            <p class="section-subtitle">Individual target duration used for daily indicator benchmarks (user preference, not medical prescription).</p>
          </div>
          <span class="badge badge-mint" id="target-active-badge">${Math.floor(currentTargetMin / 60)}h ${currentTargetMin % 60 ? (currentTargetMin % 60) + 'm' : '00m'}</span>
        </div>

        <div class="form-group">
          <label for="select-target-sleep" class="form-label">Preferred Daily Sleep Benchmark</label>
          <select id="select-target-sleep" class="form-select">
            <option value="360" ${currentTargetMin === 360 ? 'selected' : ''}>6.0 Hours (360 min)</option>
            <option value="390" ${currentTargetMin === 390 ? 'selected' : ''}>6.5 Hours (390 min)</option>
            <option value="420" ${currentTargetMin === 420 ? 'selected' : ''}>7.0 Hours (420 min)</option>
            <option value="450" ${currentTargetMin === 450 ? 'selected' : ''}>7.5 Hours (450 min)</option>
            <option value="480" ${currentTargetMin === 480 ? 'selected' : ''}>8.0 Hours (480 min - Default)</option>
            <option value="510" ${currentTargetMin === 510 ? 'selected' : ''}>8.5 Hours (510 min)</option>
            <option value="540" ${currentTargetMin === 540 ? 'selected' : ''}>9.0 Hours (540 min)</option>
          </select>
        </div>
      </section>

      <!-- 3. PWA & Installation Status (Accurate & Evidence-Based) -->
      <section class="card section-card" aria-labelledby="section-pwa-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-pwa-title" class="section-title">Application Status &amp; PWA</h2>
            <p class="section-subtitle">Real browser security context, verified service-worker state, and cache diagnostics.</p>
          </div>
          ${pwaBadge}
        </div>

        ${(!diag.isSecureContext || diag.isFileSystem || !diag.hasSWApi) ? `
          <div class="pwa-diagnostic-alert" role="alert">
            <span class="alert-icon" aria-hidden="true">⚠️</span>
            <div class="alert-content">
              <strong>Connection Environment Notice</strong>
              <p>${diag.originExplanation}</p>
            </div>
          </div>
        ` : ''}

        <div class="diagnostics-list">
          <div class="diag-row">
            <span class="diag-key">Connection Origin:</span>
            <span class="diag-val font-mono">${diag.originLabel}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Secure Context:</span>
            <span class="diag-val">${diag.originSecurity}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Service Worker:</span>
            <span class="diag-val">${diag.swStatus}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Shell Cache Verification:</span>
            <span class="diag-val">${diag.cacheStatus}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Offline Readiness:</span>
            <span class="diag-val">${diag.offlineReadiness}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Application Mode:</span>
            <span class="diag-val">${diag.installLabel}</span>
          </div>
        </div>

        <div class="pwa-action-bar">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-install-pwa" ${diag.isStandalone || !diag.isInstallable ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>${diag.isStandalone ? 'Application Installed' : diag.isInstallable ? 'Install Nocturne Atlas' : 'Install PWA'}</span>
          </button>
          <span class="pwa-install-hint" id="pwa-install-hint">
            ${diag.isStandalone
              ? 'Running in standalone display mode.'
              : diag.isInstallable
                ? 'Click to install Nocturne Atlas to your home screen or dock for instant offline launch.'
                : (!diag.isSecureContext || diag.isFileSystem)
                  ? 'Installation requires a secure context (localhost or HTTPS).'
                  : 'Install prompt becomes available when browser installation criteria are met.'}
          </span>
        </div>
      </section>

      <!-- 4. Local Storage & Database Diagnostics -->
      <section class="card section-card" aria-labelledby="section-db-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-db-title" class="section-title">Local Database Architecture</h2>
            <p class="section-subtitle">Device-native IndexedDB engine with schema migration support.</p>
          </div>
          <span class="badge badge-lilac">IndexedDB v${dbSummary?.version || 3}</span>
        </div>

        <div class="diagnostics-list">
          <div class="diag-row">
            <span class="diag-key">Database Name:</span>
            <span class="diag-val font-mono">${dbSummary?.name || 'nocturne_atlas_db'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Schema Version:</span>
            <span class="diag-val font-mono">v${dbSummary?.version || 3}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Configured Stores:</span>
            <span class="diag-val font-mono">${dbSummary?.stores ? dbSummary.stores.join(', ') : 'sleep_sessions, settings, schema_meta, daily_habits, experiments'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Total Sleep Records:</span>
            <span class="diag-val font-mono">${dbSummary?.sessionCount || 0}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Total Daily Habit Records:</span>
            <span class="diag-val font-mono">${dbSummary?.habitCount || 0}</span>
          </div>
          <div class="diag-row">
            <span class="diag-key">Behavioural Experiments:</span>
            <span class="diag-val font-mono">${dbSummary?.experimentCount || 0}</span>
          </div>
          ${dbSummary?.storageEstimate ? `
            <div class="diag-row">
              <span class="diag-key">IndexedDB Usage:</span>
              <span class="diag-val font-mono">${dbSummary.storageEstimate.usageHuman} of ${dbSummary.storageEstimate.quotaHuman} quota</span>
            </div>
          ` : ''}
        </div>
      </section>

      <!-- 5. Privacy & Zero-Cloud Principles -->
      <section class="card section-card" aria-labelledby="section-privacy-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-privacy-title" class="section-title">Privacy &amp; Data Ownership</h2>
            <p class="section-subtitle">Uncompromising offline-first architecture.</p>
          </div>
          <span class="badge badge-mint">100% Private</span>
        </div>

        <div class="privacy-bullet-points">
          <div class="privacy-point">
            <span class="privacy-icon">🛡️</span>
            <div>
              <strong>Device-Local Storage Only</strong>
              <p>Your sleep data is recorded exclusively inside your browser's IndexedDB on this physical device.</p>
            </div>
          </div>
          <div class="privacy-point">
            <span class="privacy-icon">🚫</span>
            <div>
              <strong>Zero External Services &amp; No Cloud Dependency</strong>
              <p>No backend servers, no analytics trackers, no account sign-in, and zero third-party AI APIs.</p>
            </div>
          </div>
          <div class="privacy-point">
            <span class="privacy-icon">⚡</span>
            <div>
              <strong>Cache Isolation Safeguard</strong>
              <p>Service worker caches strictly hold static application code. Your sleep sessions are never stored in cache storage.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. Data Portability, Backup & Reset (Phase 4) -->
      <section class="card section-card" aria-labelledby="section-data-mgmt-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-data-mgmt-title" class="section-title">Data Portability &amp; Reset</h2>
            <p class="section-subtitle">Full user data ownership guarantees with local JSON export and atomic restore.</p>
          </div>
          <span class="badge badge-mint">Phase 4 Ready</span>
        </div>

        <div class="backup-advice-banner">
          <span class="advice-icon" aria-hidden="true">💾</span>
          <div class="advice-text">
            <strong>Personal Backup Recommendation</strong>
            <p>Your sleep data exists solely on this device. Create periodic JSON backups and store them securely (e.g. in Documents or an external drive) to protect your archive if browser history or site data is cleared.</p>
          </div>
        </div>

        <!-- Status Alert Container -->
        <div id="backup-status-alert" class="backup-status-alert" style="display: none;" role="alert"></div>

        <div class="future-feature-grid">
          <!-- Export Card -->
          <div class="future-feature-card">
            <div class="future-header">
              <strong>Export Database (JSON)</strong>
              <span class="badge badge-mint">Active</span>
            </div>
            <p class="future-desc">Download a complete, unencrypted JSON backup of all your sleep sessions, daily habits, behavioral experiments, and personal settings.</p>
            <button type="button" class="btn btn-primary btn-sm" id="btn-export-backup">
              Export JSON Backup
            </button>
          </div>

          <!-- Import Card -->
          <div class="future-feature-card">
            <div class="future-header">
              <strong>Import &amp; Restore (JSON)</strong>
              <span class="badge badge-mint">Active</span>
            </div>
            <p class="future-desc">Select a previously exported Nocturne Atlas backup file to preview, merge, or restore your records.</p>
            <input type="file" id="input-backup-file" accept=".json,application/json" class="sr-only" aria-label="Select JSON backup file" />
            <button type="button" class="btn btn-secondary btn-sm" id="btn-trigger-import-file">
              Select Backup File (.json)
            </button>
          </div>
        </div>

        <!-- Backup Preview Modal Container (Appears when valid file loaded) -->
        <div id="backup-preview-container" class="backup-preview-card" style="display: none;"></div>

        <!-- Danger Zone for clearing local data -->
        <div class="danger-zone-container">
          <div class="danger-header">
            <strong>Clear Local Data</strong>
            <p>Erase all local IndexedDB records and stored settings on this browser.</p>
          </div>
          <button type="button" class="btn btn-danger btn-sm" id="btn-clear-local-data">
            Clear Local Data
          </button>
        </div>
      </section>
    </div>
  `;

  // Bind theme selector radios
  const themeRadios = container.querySelectorAll('input[name="theme-choice"]');
  themeRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const selected = e.target.value;
      applyTheme(selected);

      container.querySelectorAll('.theme-option-card').forEach((card) => {
        card.classList.toggle('selected', card.querySelector('input').value === selected);
      });

      const badge = container.querySelector('#theme-active-badge');
      if (badge) badge.textContent = `Active: ${selected.toUpperCase()}`;
    });
  });

  // Bind Target Sleep selector
  const targetSelect = container.querySelector('#select-target-sleep');
  if (targetSelect) {
    targetSelect.addEventListener('change', async (e) => {
      const val = Number(e.target.value) || 480;
      await setTargetSleepMinutes(val);
      const badge = container.querySelector('#target-active-badge');
      if (badge) badge.textContent = `${Math.floor(val / 60)}h ${val % 60 ? (val % 60) + 'm' : '00m'}`;
      window.dispatchEvent(new CustomEvent('nocturne-data-changed', { detail: { action: 'target-change' } }));
    });
  }

  // Bind PWA install button
  const installBtn = container.querySelector('#btn-install-pwa');
  const installHint = container.querySelector('#pwa-install-hint');
  if (installBtn && !diag.isStandalone && diag.isInstallable) {
    installBtn.addEventListener('click', async () => {
      const res = await promptPWAInstall();
      if (res && res.outcome === 'accepted') {
        installHint.textContent = 'Installation accepted! Launching standalone app.';
        installBtn.disabled = true;
      } else if (res && res.outcome === 'dismissed') {
        installHint.textContent = 'Installation dismissed.';
      } else {
        installHint.textContent = 'To install, use your browser menu (e.g. Chrome > "Install Nocturne Atlas" or "Add to Home screen").';
      }
    });
  }

  // Bind Export Backup button
  const exportBtn = container.querySelector('#btn-export-backup');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Generating...';
        const payload = await exportAllDatabaseData();
        const success = triggerBackupDownload(payload);
        if (success) {
          showBackupAlert(
            container,
            'success',
            `✓ Backup generated successfully (${payload.metadata.sessionCount} sessions, ${payload.metadata.habitCount} habits, ${payload.metadata.experimentCount} experiments). Save this file in a secure location outside your browser.`
          );
        } else {
          showBackupAlert(container, 'error', 'Failed to generate download in this environment.');
        }
      } catch (err) {
        showBackupAlert(container, 'error', `Export error: ${err.message}`);
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export JSON Backup';
      }
    });
  }

  // Bind Import Backup button & file input
  const triggerImportBtn = container.querySelector('#btn-trigger-import-file');
  const fileInput = container.querySelector('#input-backup-file');
  const previewContainer = container.querySelector('#backup-preview-container');

  if (triggerImportBtn && fileInput && previewContainer) {
    triggerImportBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (readEvt) => {
        try {
          const content = readEvt.target.result;
          const validation = validateBackupPayload(content);
          if (!validation.isValid) {
            showBackupAlert(container, 'error', `⚠️ Invalid Backup File: ${validation.error}`);
            previewContainer.style.display = 'none';
            return;
          }

          // Fetch current records to generate preview breakdown
          const [currentSessions, currentHabits, currentExperiments, currentSettings] = await Promise.all([
            getAllSessions(),
            getAllHabits(),
            getAllExperiments(),
            getAllSettings()
          ]);

          const preview = generatePreImportPreview(validation.backupData, {
            sessions: currentSessions,
            habits: currentHabits,
            experiments: currentExperiments,
            settings: currentSettings
          });

          renderBackupPreviewUI(container, validation.backupData, preview);
        } catch (err) {
          showBackupAlert(container, 'error', `Error reading backup file: ${err.message}`);
          previewContainer.style.display = 'none';
        } finally {
          fileInput.value = '';
        }
      };

      reader.onerror = () => {
        showBackupAlert(container, 'error', 'Error reading backup file from disk.');
        fileInput.value = '';
      };

      reader.readAsText(file);
    });
  }

  // Bind clear data button
  const clearBtn = container.querySelector('#btn-clear-local-data');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(
        'Are you sure you want to clear all local data? This will empty all IndexedDB stores in this browser.'
      );
      if (confirmed) {
        try {
          await clearAllDatabaseData();
          alert('Local data cleared successfully.');
          window.dispatchEvent(new CustomEvent('nocturne-data-changed', { detail: { action: 'purge' } }));
          renderSettingsScreen();
        } catch (err) {
          alert('Error clearing data: ' + err.message);
        }
      }
    });
  }
}

/**
 * Display alert banner in Settings
 */
function showBackupAlert(container, type, message) {
  const alertEl = container.querySelector('#backup-status-alert');
  if (!alertEl) return;

  alertEl.className = `backup-status-alert alert-${type}`;
  alertEl.innerHTML = `<span>${escapeHtml(message)}</span>`;
  alertEl.style.display = 'block';

  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Render the Pre-Import Preview and Restore Actions card
 */
function renderBackupPreviewUI(container, backupData, preview) {
  const previewContainer = container.querySelector('#backup-preview-container');
  if (!previewContainer) return;

  const exportDate = preview.exportedAt
    ? new Date(preview.exportedAt).toLocaleString()
    : 'Unknown export date';

  previewContainer.innerHTML = `
    <div class="preview-card-inner">
      <div class="preview-header-row">
        <div>
          <span class="subheading-accent">Backup Verification</span>
          <h3 class="preview-title">Backup File Preview</h3>
        </div>
        <span class="badge badge-mint font-mono">Format v${preview.formatVersion} (Schema v${preview.sourceSchemaVersion || '?'})</span>
      </div>

      <p class="preview-meta-line font-mono text-muted">
        Exported: ${escapeHtml(exportDate)}
      </p>

      <!-- Record Counts Matrix Table -->
      <div class="preview-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Data Category</th>
              <th scope="col">In Backup</th>
              <th scope="col">New to Add</th>
              <th scope="col">Identical (Skip)</th>
              <th scope="col">Conflicts</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sleep Sessions</td>
              <td class="font-mono">${preview.counts.sessions}</td>
              <td class="font-mono text-mint">+${preview.merge.sessions.new}</td>
              <td class="font-mono text-muted">${preview.merge.sessions.identical}</td>
              <td class="font-mono ${preview.merge.sessions.conflicts > 0 ? 'text-afterglow' : 'text-muted'}">${preview.merge.sessions.conflicts}</td>
            </tr>
            <tr>
              <td>Daily Habits</td>
              <td class="font-mono">${preview.counts.habits}</td>
              <td class="font-mono text-mint">+${preview.merge.habits.new}</td>
              <td class="font-mono text-muted">${preview.merge.habits.identical}</td>
              <td class="font-mono ${preview.merge.habits.conflicts > 0 ? 'text-afterglow' : 'text-muted'}">${preview.merge.habits.conflicts}</td>
            </tr>
            <tr>
              <td>Behavioural Experiments</td>
              <td class="font-mono">${preview.counts.experiments}</td>
              <td class="font-mono text-mint">+${preview.merge.experiments.new}</td>
              <td class="font-mono text-muted">${preview.merge.experiments.identical}</td>
              <td class="font-mono ${preview.merge.experiments.conflicts > 0 ? 'text-afterglow' : 'text-muted'}">${preview.merge.experiments.conflicts}</td>
            </tr>
            <tr>
              <td>User Settings</td>
              <td class="font-mono">${preview.counts.settings}</td>
              <td class="font-mono text-mint" colspan="3">Restores personal target &amp; preferences</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${preview.counts.sessions === 0 && preview.counts.habits === 0 && preview.counts.experiments === 0 ? `
        <div class="preview-conflict-notice" role="alert" style="border-left-color: var(--orbit-lilac);">
          <span class="notice-icon" aria-hidden="true">ℹ️</span>
          <span><strong>Empty Dataset:</strong> This backup contains no sleep records, daily habits, or experiments. Merging will make no changes to your sleep logs; Replacing will clear your local records.</span>
        </div>
      ` : ''}

      ${preview.merge.totalConflicts > 0 ? `
        <div class="preview-conflict-notice" role="alert">
          <span class="notice-icon" aria-hidden="true">⚠️</span>
          <span><strong>${preview.merge.totalConflicts} Conflicting Record(s) Detected:</strong> Records with the same ID but differing values will be preserved as your local version during Merge. Use Replace if you want the backup versions to overwrite existing records.</span>
        </div>
      ` : ''}

      <!-- Restore Choices Grid -->
      <div class="restore-choices-grid">
        <!-- Choice 1: Merge Mode -->
        <div class="restore-choice-box">
          <h4 class="choice-title">Option A: Merge Records (Recommended)</h4>
          <p class="choice-desc">
            Adds <strong>${preview.merge.totalNew} new records</strong>. Skips <strong>${preview.merge.totalIdentical} identical records</strong>. Preserves existing unrelated data and local settings safely.
          </p>
          <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-merge">
            Merge Records (${preview.merge.totalNew} to add)
          </button>
        </div>

        <!-- Choice 2: Replace Mode -->
        <div class="restore-choice-box replace-choice-box">
          <h4 class="choice-title text-afterglow">Option B: Replace All Local Data</h4>
          <p class="choice-desc">
            Wipes all <strong>${preview.replace.existingRecordsToWipe} local records</strong> and replaces them with <strong>${preview.replace.incomingRecordsToInstall} records</strong> from this backup file.
          </p>
          <label class="replace-confirm-label">
            <input type="checkbox" id="check-confirm-replace" />
            <span>I confirm that I want to replace all current local data with this backup.</span>
          </label>
          <button type="button" class="btn btn-danger btn-sm" id="btn-confirm-replace" disabled>
            Replace All Data
          </button>
        </div>
      </div>

      <div class="preview-footer-row">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-preview">
          Cancel &amp; Close Preview
        </button>
      </div>
    </div>
  `;

  previewContainer.style.display = 'block';
  previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Bind Merge action
  const mergeBtn = previewContainer.querySelector('#btn-confirm-merge');
  if (mergeBtn) {
    mergeBtn.addEventListener('click', async () => {
      try {
        mergeBtn.disabled = true;
        mergeBtn.textContent = 'Merging...';

        const result = await importRestoreMerge(backupData.data);
        previewContainer.style.display = 'none';

        showBackupAlert(
          container,
          'success',
          `✓ Merge complete: Added ${result.added.sessions} sessions, ${result.added.habits} habits, ${result.added.experiments} experiments. Skipped ${result.skipped.sessions + result.skipped.habits + result.skipped.experiments} duplicates. Conflicts preserved: ${result.conflictsCount}.`
        );

        window.dispatchEvent(new CustomEvent('nocturne-data-changed', { detail: { action: 'merge-restore' } }));
        renderSettingsScreen();
      } catch (err) {
        showBackupAlert(container, 'error', `Merge failed: ${err.message}`);
        mergeBtn.disabled = false;
        mergeBtn.textContent = 'Merge Records';
      }
    });
  }

  // Bind Replace Checkbox & Action
  const replaceCheck = previewContainer.querySelector('#check-confirm-replace');
  const replaceBtn = previewContainer.querySelector('#btn-confirm-replace');

  if (replaceCheck && replaceBtn) {
    replaceCheck.addEventListener('change', () => {
      replaceBtn.disabled = !replaceCheck.checked;
    });

    replaceBtn.addEventListener('click', async () => {
      const finalPrompt = window.confirm(
        'FINAL CONFIRMATION: Are you sure you want to wipe all local data and replace it with this backup file? This action cannot be undone.'
      );
      if (!finalPrompt) return;

      try {
        replaceBtn.disabled = true;
        replaceBtn.textContent = 'Replacing...';

        const result = await importRestoreReplace(backupData.data);
        previewContainer.style.display = 'none';

        showBackupAlert(
          container,
          'success',
          `✓ Replace complete: Successfully restored ${result.replaced.sessions} sessions, ${result.replaced.habits} habits, ${result.replaced.experiments} experiments, and settings.`
        );

        window.dispatchEvent(new CustomEvent('nocturne-data-changed', { detail: { action: 'replace-restore' } }));
        renderSettingsScreen();
      } catch (err) {
        showBackupAlert(container, 'error', `Replace failed: ${err.message}`);
        replaceBtn.disabled = false;
        replaceBtn.textContent = 'Replace All Data';
      }
    });
  }

  // Bind Cancel button
  const cancelBtn = previewContainer.querySelector('#btn-cancel-preview');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      previewContainer.style.display = 'none';
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
