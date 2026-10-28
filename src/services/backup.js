// src/services/backup.js
// Nocturne Atlas — Backup, Restore & Validation Engine (Phase 4)
// Zero external dependencies. Fully client-side, privacy-preserving, and non-destructive.

import { formatLocalDate } from './calculations.js';

export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 15 * 1024 * 1024; // 15 Megabytes

/**
 * Generate standard backup filename containing the local export date
 * e.g. "nocturne-atlas-backup-2026-10-28.json"
 */
export function generateBackupFilename(date = new Date()) {
  const dateStr = formatLocalDate(date) || 'backup';
  return `nocturne-atlas-backup-${dateStr}.json`;
}

/**
 * Trigger browser file download for a backup payload using Blob and temporary Object URL.
 * Automatically releases the temporary Object URL after download initiation.
 *
 * @param {Object} backupPayload - Validated backup envelope
 * @param {string} [filename] - Custom filename override
 * @returns {boolean} Whether download trigger was dispatched
 */
export function triggerBackupDownload(backupPayload, filename = null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const finalName = filename || generateBackupFilename();
  const link = document.createElement('a');
  link.href = url;
  link.download = finalName;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL to avoid memory leaks
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return true;
}

/**
 * Parse and validate an incoming backup string or object.
 * Strictly verifies schema structure, record data types, timestamp arithmetic, enum fields,
 * and checks for internal duplicate IDs.
 *
 * @param {string|Object} input - Raw JSON string from FileReader or pre-parsed object
 * @returns {Object} { isValid: boolean, error?: string, warnings: string[], data?: Object, metadata?: Object }
 */
export function validateBackupPayload(input) {
  const warnings = [];

  // 1. File size check (if raw string)
  if (typeof input === 'string') {
    if (input.length > MAX_BACKUP_FILE_BYTES) {
      return {
        isValid: false,
        error: `Backup file exceeds maximum permitted size of ${Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))}MB.`,
        warnings
      };
    }
  }

  // 2. JSON Parse check
  let parsed = null;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      return {
        isValid: false,
        error: `Malformed JSON: The selected file could not be parsed as valid JSON (${err.message}).`,
        warnings
      };
    }
  } else if (input && typeof input === 'object') {
    parsed = input;
  } else {
    return {
      isValid: false,
      error: 'Invalid input: Expected a JSON string or parsed backup object.',
      warnings
    };
  }

  // 3. Root envelope verification
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      isValid: false,
      error: 'Invalid backup format: Root structure must be a JSON object.',
      warnings
    };
  }

  if (parsed.app !== 'nocturne-atlas') {
    return {
      isValid: false,
      error: `Unrecognized application identifier: Expected "nocturne-atlas", found "${parsed.app || 'undefined'}".`,
      warnings
    };
  }

  // Format Version Check
  if (typeof parsed.formatVersion !== 'number' || !Number.isInteger(parsed.formatVersion)) {
    return {
      isValid: false,
      error: 'Invalid backup format: Missing or non-integer "formatVersion".',
      warnings
    };
  }

  if (parsed.formatVersion > BACKUP_FORMAT_VERSION) {
    return {
      isValid: false,
      error: `Unsupported future backup version (v${parsed.formatVersion}). This version of Nocturne Atlas supports up to v${BACKUP_FORMAT_VERSION}.`,
      warnings
    };
  }

  if (parsed.formatVersion < 1) {
    return {
      isValid: false,
      error: `Unsupported legacy backup format version: v${parsed.formatVersion}.`,
      warnings
    };
  }

  // Data Container Check
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    return {
      isValid: false,
      error: 'Invalid backup structure: Missing "data" container object.',
      warnings
    };
  }

  const { sleep_sessions = [], daily_habits = [], experiments = [], settings = [] } = parsed.data;

  if (!Array.isArray(sleep_sessions)) {
    return { isValid: false, error: 'Invalid backup: "data.sleep_sessions" must be an array.', warnings };
  }
  if (!Array.isArray(daily_habits)) {
    return { isValid: false, error: 'Invalid backup: "data.daily_habits" must be an array.', warnings };
  }
  if (!Array.isArray(experiments)) {
    return { isValid: false, error: 'Invalid backup: "data.experiments" must be an array.', warnings };
  }
  if (!Array.isArray(settings)) {
    return { isValid: false, error: 'Invalid backup: "data.settings" must be an array.', warnings };
  }

  // 4. Record-level Validation: Sleep Sessions
  const seenSessionIds = new Set();
  const validTypes = ['main', 'nap', 'other'];

  for (let i = 0; i < sleep_sessions.length; i++) {
    const s = sleep_sessions[i];
    if (!s || typeof s !== 'object') {
      return { isValid: false, error: `Session at index ${i} is not a valid object.`, warnings };
    }
    if (!s.id || typeof s.id !== 'string') {
      return { isValid: false, error: `Session at index ${i} is missing a required unique string "id".`, warnings };
    }
    if (seenSessionIds.has(s.id)) {
      return { isValid: false, error: `Duplicate session ID within backup dataset: "${s.id}".`, warnings };
    }
    seenSessionIds.add(s.id);

    // Timestamps
    const startMs = Number(s.startTimestamp || (s.startTime ? new Date(s.startTime).getTime() : NaN));
    const endMs = Number(s.endTimestamp || (s.endTime ? new Date(s.endTime).getTime() : NaN));

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return { isValid: false, error: `Session "${s.id}" contains invalid start or end timestamps.`, warnings };
    }
    if (endMs <= startMs) {
      return { isValid: false, error: `Session "${s.id}" has invalid duration: wake time must be later than start time.`, warnings };
    }

    if (s.sessionType && !validTypes.includes(s.sessionType)) {
      return { isValid: false, error: `Session "${s.id}" has invalid sessionType "${s.sessionType}". Must be main, nap, or other.`, warnings };
    }

    // Ratings bounds check
    if (s.restednessRating !== null && s.restednessRating !== undefined) {
      const r = Number(s.restednessRating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return { isValid: false, error: `Session "${s.id}" has invalid restednessRating: must be an integer between 1 and 5.`, warnings };
      }
    }
    if (s.energyRating !== null && s.energyRating !== undefined) {
      const e = Number(s.energyRating);
      if (!Number.isInteger(e) || e < 1 || e > 5) {
        return { isValid: false, error: `Session "${s.id}" has invalid energyRating: must be an integer between 1 and 5.`, warnings };
      }
    }

    // Optional numeric sleep architecture metrics
    if (s.latencyMinutes !== null && s.latencyMinutes !== undefined) {
      const lat = Number(s.latencyMinutes);
      if (!Number.isFinite(lat) || lat < 0) {
        return { isValid: false, error: `Session "${s.id}" has invalid latencyMinutes: must be a non-negative number.`, warnings };
      }
    }
    if (s.awakeAfterOnsetMinutes !== null && s.awakeAfterOnsetMinutes !== undefined) {
      const waso = Number(s.awakeAfterOnsetMinutes);
      if (!Number.isFinite(waso) || waso < 0) {
        return { isValid: false, error: `Session "${s.id}" has invalid awakeAfterOnsetMinutes: must be a non-negative number.`, warnings };
      }
    }
    if (s.awakeningsCount !== null && s.awakeningsCount !== undefined) {
      const awk = Number(s.awakeningsCount);
      if (!Number.isInteger(awk) || awk < 0) {
        return { isValid: false, error: `Session "${s.id}" has invalid awakeningsCount: must be an integer 0 or greater.`, warnings };
      }
    }
  }

  // 5. Record-level Validation: Daily Habits
  const seenHabitDates = new Set();
  const validHabitStates = ['yes', 'no', 'not_recorded'];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  for (let i = 0; i < daily_habits.length; i++) {
    const h = daily_habits[i];
    if (!h || typeof h !== 'object') {
      return { isValid: false, error: `Habit record at index ${i} is not a valid object.`, warnings };
    }
    if (!h.date || typeof h.date !== 'string' || !dateRegex.test(h.date)) {
      return { isValid: false, error: `Habit record at index ${i} has invalid date format (expected YYYY-MM-DD).`, warnings };
    }
    const parsedDate = new Date(`${h.date}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return { isValid: false, error: `Habit record at index ${i} has invalid calendar date (${h.date}).`, warnings };
    }
    if (seenHabitDates.has(h.date)) {
      return { isValid: false, error: `Duplicate habit record date within backup dataset: "${h.date}".`, warnings };
    }
    seenHabitDates.add(h.date);

    if (h.caffeine && !validHabitStates.includes(h.caffeine)) {
      return { isValid: false, error: `Habit "${h.date}" has invalid caffeine value "${h.caffeine}".`, warnings };
    }
    if (h.screenLate && !validHabitStates.includes(h.screenLate)) {
      return { isValid: false, error: `Habit "${h.date}" has invalid screenLate value "${h.screenLate}".`, warnings };
    }
    if (h.stressRating !== null && h.stressRating !== undefined) {
      const st = Number(h.stressRating);
      if (!Number.isInteger(st) || st < 1 || st > 5) {
        return { isValid: false, error: `Habit "${h.date}" has invalid stressRating: must be an integer between 1 and 5.`, warnings };
      }
    }
  }

  // 6. Record-level Validation: Behavioural Experiments
  const seenExpIds = new Set();
  const validExpStatuses = ['active', 'completed', 'abandoned', 'cancelled'];

  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i];
    if (!exp || typeof exp !== 'object') {
      return { isValid: false, error: `Experiment record at index ${i} is not a valid object.`, warnings };
    }
    if (!exp.id || typeof exp.id !== 'string') {
      return { isValid: false, error: `Experiment at index ${i} is missing unique string "id".`, warnings };
    }
    if (seenExpIds.has(exp.id)) {
      return { isValid: false, error: `Duplicate experiment ID within backup dataset: "${exp.id}".`, warnings };
    }
    seenExpIds.add(exp.id);

    if (!exp.protocolId || typeof exp.protocolId !== 'string') {
      return { isValid: false, error: `Experiment "${exp.id}" is missing required "protocolId".`, warnings };
    }
    if (!exp.title || typeof exp.title !== 'string') {
      return { isValid: false, error: `Experiment "${exp.id}" is missing required "title".`, warnings };
    }
    if (exp.status && !validExpStatuses.includes(exp.status)) {
      return { isValid: false, error: `Experiment "${exp.id}" has invalid status "${exp.status}". Must be active, completed, abandoned, or cancelled.`, warnings };
    }
  }

  // 7. Record-level Validation: Settings
  const seenSettingKeys = new Set();
  for (let i = 0; i < settings.length; i++) {
    const s = settings[i];
    if (!s || typeof s !== 'object' || !s.key || typeof s.key !== 'string') {
      return { isValid: false, error: `Setting at index ${i} is missing required string "key".`, warnings };
    }
    if (seenSettingKeys.has(s.key)) {
      return { isValid: false, error: `Duplicate setting key within backup: "${s.key}".`, warnings };
    }
    seenSettingKeys.add(s.key);

    if (s.key === 'targetSleepMinutes' && s.value !== null && s.value !== undefined) {
      const targetMin = Number(s.value);
      if (!Number.isFinite(targetMin) || targetMin <= 0) {
        return { isValid: false, error: `Setting "targetSleepMinutes" must be a positive number.`, warnings };
      }
    }
  }

  return {
    isValid: true,
    warnings,
    backupData: {
      app: parsed.app,
      formatVersion: parsed.formatVersion,
      exportedAt: parsed.exportedAt || null,
      sourceSchemaVersion: parsed.sourceSchemaVersion || null,
      data: {
        sleep_sessions,
        daily_habits,
        experiments,
        settings
      }
    },
    counts: {
      sessions: sleep_sessions.length,
      habits: daily_habits.length,
      experiments: experiments.length,
      settings: settings.length
    }
  };
}

/**
 * Compare incoming validated backup records against existing local database records
 * to generate a transparent pre-import preview breakdown.
 */
export function generatePreImportPreview(backupData, currentRecords) {
  const incoming = backupData.data;
  const current = currentRecords;

  const localSessionsMap = new Map((current.sessions || []).map(s => [s.id, s]));
  const localHabitsMap = new Map((current.habits || []).map(h => [h.date, h]));
  const localExpMap = new Map((current.experiments || []).map(e => [e.id, e]));

  // Helper equality
  const areEqual = (a, b) => {
    if (!a || !b) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  };

  // Sessions analysis
  let sessNew = 0;
  let sessIdentical = 0;
  let sessConflicts = 0;
  for (const s of (incoming.sleep_sessions || [])) {
    const local = localSessionsMap.get(s.id);
    if (!local) sessNew++;
    else if (areEqual(local, s)) sessIdentical++;
    else sessConflicts++;
  }

  // Habits analysis
  let habitNew = 0;
  let habitIdentical = 0;
  let habitConflicts = 0;
  for (const h of (incoming.daily_habits || [])) {
    const local = localHabitsMap.get(h.date);
    if (!local) habitNew++;
    else if (areEqual(local, h)) habitIdentical++;
    else habitConflicts++;
  }

  // Experiments analysis
  let expNew = 0;
  let expIdentical = 0;
  let expConflicts = 0;
  for (const e of (incoming.experiments || [])) {
    const local = localExpMap.get(e.id);
    if (!local) expNew++;
    else if (areEqual(local, e)) expIdentical++;
    else expConflicts++;
  }

  const totalLocalRecords = (
    (current.sessions || []).length +
    (current.habits || []).length +
    (current.experiments || []).length
  );

  const totalIncomingRecords = (
    (incoming.sleep_sessions || []).length +
    (incoming.daily_habits || []).length +
    (incoming.experiments || []).length
  );

  return {
    exportedAt: backupData.exportedAt,
    formatVersion: backupData.formatVersion,
    sourceSchemaVersion: backupData.sourceSchemaVersion,
    counts: {
      sessions: (incoming.sleep_sessions || []).length,
      habits: (incoming.daily_habits || []).length,
      experiments: (incoming.experiments || []).length,
      settings: (incoming.settings || []).length
    },
    merge: {
      sessions: { new: sessNew, identical: sessIdentical, conflicts: sessConflicts },
      habits: { new: habitNew, identical: habitIdentical, conflicts: habitConflicts },
      experiments: { new: expNew, identical: expIdentical, conflicts: expConflicts },
      totalNew: sessNew + habitNew + expNew,
      totalIdentical: sessIdentical + habitIdentical + expIdentical,
      totalConflicts: sessConflicts + habitConflicts + expConflicts
    },
    replace: {
      existingRecordsToWipe: totalLocalRecords,
      incomingRecordsToInstall: totalIncomingRecords
    }
  };
}
