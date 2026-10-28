// src/storage/db.js
// Nocturne Atlas - IndexedDB Storage Layer & Schema Migrations
// Schema Version 3: Real Sleep Sessions CRUD, Daily Habits & Weekly Behavioural Experiments

import { formatLocalDate } from '../services/calculations.js';

const DB_NAME = 'nocturne_atlas_db';
const DB_VERSION = 3;

/**
 * Migration registry.
 * Each entry defines a schema version, upgrade logic, and metadata.
 * Deterministic and versioned — preserves existing records and settings during upgrades.
 */
const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema: sleep_sessions, settings, and schema_meta',
    upgrade(db) {
      if (!db.objectStoreNames.contains('sleep_sessions')) {
        const sessionStore = db.createObjectStore('sleep_sessions', { keyPath: 'id' });
        sessionStore.createIndex('startTime', 'startTime', { unique: false });
        sessionStore.createIndex('endTime', 'endTime', { unique: false });
        sessionStore.createIndex('date', 'date', { unique: false });
        sessionStore.createIndex('rating', 'rating', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('schema_meta')) {
        db.createObjectStore('schema_meta', { keyPath: 'version' });
      }
    }
  },
  {
    version: 2,
    description: 'Phase 2: Add daily_habits store and wakeDate index on sleep_sessions',
    upgrade(db, transaction) {
      // 1. Add indexes to existing sleep_sessions store
      if (db.objectStoreNames.contains('sleep_sessions')) {
        const sessionStore = transaction.objectStore('sleep_sessions');
        if (!sessionStore.indexNames.contains('wakeDate')) {
          sessionStore.createIndex('wakeDate', 'wakeDate', { unique: false });
        }
        if (!sessionStore.indexNames.contains('sessionType')) {
          sessionStore.createIndex('sessionType', 'sessionType', { unique: false });
        }
      }

      // 2. Create daily_habits store with keyPath 'date' (YYYY-MM-DD)
      if (!db.objectStoreNames.contains('daily_habits')) {
        const habitStore = db.createObjectStore('daily_habits', { keyPath: 'date' });
        habitStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    }
  },
  {
    version: 3,
    description: 'Phase 3: Add experiments store for weekly behavioural experiments',
    upgrade(db) {
      if (!db.objectStoreNames.contains('experiments')) {
        const expStore = db.createObjectStore('experiments', { keyPath: 'id' });
        expStore.createIndex('status', 'status', { unique: false });
        expStore.createIndex('startedAt', 'startedAt', { unique: false });
        expStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    }
  }
];

let dbInstance = null;

/**
 * Generate stable unique ID for records
 */
export function generateRecordId(prefix = 's') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Open and initialize the IndexedDB database.
 * Executes version upgrades deterministically.
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this browser environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;
      console.log(`[DB] Upgrading schema from version ${oldVersion} to ${newVersion}`);

      for (const migration of MIGRATIONS) {
        if (migration.version > oldVersion && migration.version <= newVersion) {
          console.log(`[DB] Applying migration v${migration.version}: ${migration.description}`);
          migration.upgrade(db, transaction);
        }
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        console.warn('[DB] Database version changed elsewhere. Connection closed.');
      };

      // Record migration metadata
      recordMigrationMeta(dbInstance, DB_VERSION)
        .then(() => resolve(dbInstance))
        .catch(() => resolve(dbInstance));
    };

    request.onerror = (event) => {
      console.error('[DB] Failed to open IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Record schema migration timestamp into schema_meta store
 */
function recordMigrationMeta(db, version) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(['schema_meta'], 'readwrite');
      const store = tx.objectStore('schema_meta');
      store.put({
        version,
        migratedAt: new Date().toISOString(),
        description: MIGRATIONS.find(m => m.version === version)?.description || 'Current schema'
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------
// SLEEP SESSIONS CRUD
// ---------------------------------------------------------------------

/**
 * Add a new sleep session record
 */
export async function addSession(sessionData) {
  const db = await initDB();
  const id = sessionData.id || generateRecordId('ses');
  const nowIso = new Date().toISOString();

  const record = {
    ...sessionData,
    id,
    wakeDate: sessionData.wakeDate || formatLocalDate(new Date(sessionData.endTimestamp || sessionData.endTime)),
    createdAt: sessionData.createdAt || nowIso,
    updatedAt: nowIso
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sleep_sessions'], 'readwrite');
    const store = tx.objectStore('sleep_sessions');
    const req = store.add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update an existing sleep session record
 */
export async function updateSession(sessionData) {
  if (!sessionData.id) {
    throw new Error('Cannot update session without valid record ID.');
  }
  const db = await initDB();
  const nowIso = new Date().toISOString();

  const record = {
    ...sessionData,
    wakeDate: sessionData.wakeDate || formatLocalDate(new Date(sessionData.endTimestamp || sessionData.endTime)),
    updatedAt: nowIso
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sleep_sessions'], 'readwrite');
    const store = tx.objectStore('sleep_sessions');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a sleep session record by ID
 */
export async function deleteSession(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sleep_sessions'], 'readwrite');
    const store = tx.objectStore('sleep_sessions');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve a single sleep session by ID
 */
export async function getSessionById(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sleep_sessions'], 'readonly');
    const store = tx.objectStore('sleep_sessions');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all sleep sessions sorted by startTimestamp descending (newest first)
 */
export async function getAllSessions() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sleep_sessions'], 'readonly');
    const store = tx.objectStore('sleep_sessions');
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => (b.startTimestamp || 0) - (a.startTimestamp || 0));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve sessions matching a specific wake-up date (YYYY-MM-DD)
 */
export async function getSessionsByWakeDate(wakeDate) {
  const all = await getAllSessions();
  return all.filter((s) => s.wakeDate === wakeDate);
}

// ---------------------------------------------------------------------
// DAILY HABITS CRUD
// ---------------------------------------------------------------------

/**
 * Retrieve daily habit record for a specific date (YYYY-MM-DD)
 */
export async function getHabit(date) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['daily_habits'], 'readonly');
    const store = tx.objectStore('daily_habits');
    const req = store.get(date);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save or update daily habit record
 * Fields: { date, caffeine: 'yes'|'no'|'not_recorded', caffeineTiming, screenLate: 'yes'|'no'|'not_recorded', screenTiming, stressRating: 1..5|null, notes }
 */
export async function saveHabit(habitData) {
  if (!habitData.date) {
    throw new Error('Daily habit record requires a date (YYYY-MM-DD).');
  }
  const db = await initDB();
  const nowIso = new Date().toISOString();

  const record = {
    date: habitData.date,
    caffeine: habitData.caffeine || 'not_recorded',
    caffeineTiming: habitData.caffeineTiming || null,
    screenLate: habitData.screenLate || 'not_recorded',
    screenTiming: habitData.screenTiming || null,
    stressRating: habitData.stressRating || null,
    notes: typeof habitData.notes === 'string' ? habitData.notes.trim() : '',
    updatedAt: nowIso
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['daily_habits'], 'readwrite');
    const store = tx.objectStore('daily_habits');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all habit records
 */
export async function getAllHabits() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['daily_habits'], 'readonly');
    const store = tx.objectStore('daily_habits');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------
// WEEKLY BEHAVIOURAL EXPERIMENTS CRUD
// ---------------------------------------------------------------------

/**
 * Retrieve currently active experiment, if any
 */
export async function getActiveExperiment() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('experiments')) {
      return resolve(null);
    }
    const tx = db.transaction(['experiments'], 'readonly');
    const store = tx.objectStore('experiments');
    const index = store.index('status');
    const req = index.get('active');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all experiment records (active, completed, abandoned) sorted chronologically
 */
export async function getAllExperiments() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('experiments')) {
      return resolve([]);
    }
    const tx = db.transaction(['experiments'], 'readonly');
    const store = tx.objectStore('experiments');
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      // Sort newest first by createdAt / startedAt
      records.sort((a, b) => new Date(b.createdAt || b.startedAt).getTime() - new Date(a.createdAt || a.startedAt).getTime());
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve single experiment by ID
 */
export async function getExperimentById(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('experiments')) {
      return resolve(null);
    }
    const tx = db.transaction(['experiments'], 'readonly');
    const store = tx.objectStore('experiments');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save or start a new behavioural experiment
 */
export async function saveExperiment(expData) {
  const db = await initDB();
  const nowIso = new Date().toISOString();
  const id = expData.id || generateRecordId('exp');

  const record = {
    id,
    protocolId: expData.protocolId || 'custom',
    title: expData.title || 'Custom Experiment',
    hypothesis: expData.hypothesis || '',
    behaviorToChange: expData.behaviorToChange || '',
    outcomeToObserve: expData.outcomeToObserve || '',
    targetDays: Number(expData.targetDays) || 7,
    startedAt: expData.startedAt || formatLocalDate(new Date()),
    targetEndDate: expData.targetEndDate || formatLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    status: expData.status || 'active', // 'active' | 'completed' | 'abandoned'
    notes: typeof expData.notes === 'string' ? expData.notes.trim() : '',
    outcomeReflection: expData.outcomeReflection || '',
    completedAt: expData.completedAt || null,
    createdAt: expData.createdAt || nowIso,
    updatedAt: nowIso
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['experiments'], 'readwrite');
    const store = tx.objectStore('experiments');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mark active experiment completed with reflection notes
 */
export async function completeExperiment(id, outcomeReflection = '', notes = '') {
  const exp = await getExperimentById(id);
  if (!exp) throw new Error(`Experiment ${id} not found.`);

  exp.status = 'completed';
  exp.completedAt = new Date().toISOString();
  if (outcomeReflection) exp.outcomeReflection = outcomeReflection.trim();
  if (notes) exp.notes = notes.trim();
  exp.updatedAt = new Date().toISOString();

  return await saveExperiment(exp);
}

/**
 * Mark active experiment abandoned / archived early
 */
export async function abandonExperiment(id, reason = '') {
  const exp = await getExperimentById(id);
  if (!exp) throw new Error(`Experiment ${id} not found.`);

  exp.status = 'abandoned';
  exp.completedAt = new Date().toISOString();
  if (reason) exp.outcomeReflection = reason.trim();
  exp.updatedAt = new Date().toISOString();

  return await saveExperiment(exp);
}

/**
 * Delete experiment record
 */
export async function deleteExperiment(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['experiments'], 'readwrite');
    const store = tx.objectStore('experiments');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------
// USER SETTINGS & PREFERENCES
// ---------------------------------------------------------------------

export async function getSetting(key, defaultValue = null) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key, value) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key, value, updatedAt: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all user settings records
 */
export async function getAllSettings() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Target sleep minutes preference (defaults to 480 minutes = 8 hours)
 */
export async function getTargetSleepMinutes() {
  return await getSetting('targetSleepMinutes', 480);
}

export async function setTargetSleepMinutes(minutes) {
  return await setSetting('targetSleepMinutes', Number(minutes) || 480);
}

// ---------------------------------------------------------------------
// BACKUP EXPORT & ATOMIC RESTORE (PHASE 4)
// ---------------------------------------------------------------------

/**
 * Export complete application dataset for backup.
 * Reads sleep_sessions, daily_habits, experiments, and settings without modifying anything.
 */
export async function exportAllDatabaseData() {
  const [sessions, habits, experiments, settings] = await Promise.all([
    getAllSessions(),
    getAllHabits(),
    getAllExperiments(),
    getAllSettings()
  ]);

  return {
    app: 'nocturne-atlas',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceSchemaVersion: DB_VERSION,
    metadata: {
      sessionCount: sessions.length,
      habitCount: habits.length,
      experimentCount: experiments.length,
      settingsCount: settings.length
    },
    data: {
      sleep_sessions: sessions,
      daily_habits: habits,
      experiments,
      settings
    }
  };
}

/**
 * Helper to test if two records are identical in content
 */
function areRecordsEqual(a, b) {
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Atomic Merge Restore:
 * Adds new records that do not exist locally.
 * Skips identical duplicate records.
 * Flags and skips conflicting records with different content under an existing ID (protects local data).
 */
export async function importRestoreMerge(validatedData) {
  const db = await initDB();

  // 1. Fetch current local records for in-memory comparison
  const [currentSessions, currentHabits, currentExperiments, currentSettings] = await Promise.all([
    getAllSessions(),
    getAllHabits(),
    getAllExperiments(),
    getAllSettings()
  ]);

  const localSessionsMap = new Map(currentSessions.map(s => [s.id, s]));
  const localHabitsMap = new Map(currentHabits.map(h => [h.date, h]));
  const localExpMap = new Map(currentExperiments.map(e => [e.id, e]));
  const localSettingsMap = new Map(currentSettings.map(s => [s.key, s]));

  const toAdd = {
    sleep_sessions: [],
    daily_habits: [],
    experiments: [],
    settings: []
  };

  const skipped = {
    sleep_sessions: 0,
    daily_habits: 0,
    experiments: 0,
    settings: 0
  };

  const conflicts = {
    sleep_sessions: [],
    daily_habits: [],
    experiments: [],
    settings: []
  };

  // Sessions
  for (const s of (validatedData.sleep_sessions || [])) {
    const existing = localSessionsMap.get(s.id);
    if (!existing) {
      toAdd.sleep_sessions.push(s);
    } else if (areRecordsEqual(existing, s)) {
      skipped.sleep_sessions++;
    } else {
      conflicts.sleep_sessions.push({ id: s.id, type: 'session', existing, incoming: s });
      skipped.sleep_sessions++;
    }
  }

  // Daily Habits
  for (const h of (validatedData.daily_habits || [])) {
    const existing = localHabitsMap.get(h.date);
    if (!existing) {
      toAdd.daily_habits.push(h);
    } else if (areRecordsEqual(existing, h)) {
      skipped.daily_habits++;
    } else {
      conflicts.daily_habits.push({ id: h.date, type: 'habit', existing, incoming: h });
      skipped.daily_habits++;
    }
  }

  // Experiments
  for (const exp of (validatedData.experiments || [])) {
    const existing = localExpMap.get(exp.id);
    if (!existing) {
      toAdd.experiments.push(exp);
    } else if (areRecordsEqual(existing, exp)) {
      skipped.experiments++;
    } else {
      conflicts.experiments.push({ id: exp.id, type: 'experiment', existing, incoming: exp });
      skipped.experiments++;
    }
  }

  // Settings
  for (const set of (validatedData.settings || [])) {
    const existing = localSettingsMap.get(set.key);
    if (!existing) {
      toAdd.settings.push(set);
    } else {
      // Local settings are preserved in merge mode
      skipped.settings++;
    }
  }

  // 2. Perform atomic readwrite transaction for all queued additions
  return new Promise((resolve, reject) => {
    const stores = ['sleep_sessions', 'daily_habits', 'experiments', 'settings'];
    const tx = db.transaction(stores, 'readwrite');

    const sessionStore = tx.objectStore('sleep_sessions');
    toAdd.sleep_sessions.forEach(item => sessionStore.put(item));

    const habitStore = tx.objectStore('daily_habits');
    toAdd.daily_habits.forEach(item => habitStore.put(item));

    const expStore = tx.objectStore('experiments');
    toAdd.experiments.forEach(item => expStore.put(item));

    const settingStore = tx.objectStore('settings');
    toAdd.settings.forEach(item => settingStore.put(item));

    tx.oncomplete = () => {
      resolve({
        mode: 'merge',
        added: {
          sessions: toAdd.sleep_sessions.length,
          habits: toAdd.daily_habits.length,
          experiments: toAdd.experiments.length,
          settings: toAdd.settings.length
        },
        skipped: {
          sessions: skipped.sleep_sessions,
          habits: skipped.daily_habits,
          experiments: skipped.experiments,
          settings: skipped.settings
        },
        conflictsCount: (
          conflicts.sleep_sessions.length +
          conflicts.daily_habits.length +
          conflicts.experiments.length
        ),
        conflicts
      });
    };

    tx.onerror = () => reject(tx.error || new Error('Merge transaction failed'));
    tx.onabort = () => reject(new Error('Merge transaction was aborted'));
  });
}

/**
 * Atomic Replace Restore:
 * Replaces all user records in sleep_sessions, daily_habits, experiments, and settings
 * in a single atomic transaction.
 */
export async function importRestoreReplace(validatedData) {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const stores = ['sleep_sessions', 'daily_habits', 'experiments', 'settings'];
    const tx = db.transaction(stores, 'readwrite');

    // 1. Clear all 4 stores atomically
    stores.forEach(name => tx.objectStore(name).clear());

    // 2. Insert incoming records
    const sessionStore = tx.objectStore('sleep_sessions');
    (validatedData.sleep_sessions || []).forEach(item => sessionStore.put(item));

    const habitStore = tx.objectStore('daily_habits');
    (validatedData.daily_habits || []).forEach(item => habitStore.put(item));

    const expStore = tx.objectStore('experiments');
    (validatedData.experiments || []).forEach(item => expStore.put(item));

    const settingStore = tx.objectStore('settings');
    (validatedData.settings || []).forEach(item => settingStore.put(item));

    tx.oncomplete = () => {
      resolve({
        mode: 'replace',
        replaced: {
          sessions: (validatedData.sleep_sessions || []).length,
          habits: (validatedData.daily_habits || []).length,
          experiments: (validatedData.experiments || []).length,
          settings: (validatedData.settings || []).length
        }
      });
    };

    tx.onerror = () => reject(tx.error || new Error('Replace transaction failed'));
    tx.onabort = () => reject(new Error('Replace transaction was aborted'));
  });
}

// ---------------------------------------------------------------------
// DIAGNOSTICS & DATA PURGE
// ---------------------------------------------------------------------

/**
 * Get summary diagnostics about database status, store count, and disk usage
 */
export async function getDatabaseSummary() {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames);

  let sessionCount = 0;
  try {
    const tx = db.transaction(['sleep_sessions'], 'readonly');
    const store = tx.objectStore('sleep_sessions');
    sessionCount = await new Promise((res) => {
      const countReq = store.count();
      countReq.onsuccess = () => res(countReq.result);
      countReq.onerror = () => res(0);
    });
  } catch {
    sessionCount = 0;
  }

  let habitCount = 0;
  if (storeNames.includes('daily_habits')) {
    try {
      const tx = db.transaction(['daily_habits'], 'readonly');
      const store = tx.objectStore('daily_habits');
      habitCount = await new Promise((res) => {
        const countReq = store.count();
        countReq.onsuccess = () => res(countReq.result);
        countReq.onerror = () => res(0);
      });
    } catch {
      habitCount = 0;
    }
  }

  let experimentCount = 0;
  if (storeNames.includes('experiments')) {
    try {
      const tx = db.transaction(['experiments'], 'readonly');
      const store = tx.objectStore('experiments');
      experimentCount = await new Promise((res) => {
        const countReq = store.count();
        countReq.onsuccess = () => res(countReq.result);
        countReq.onerror = () => res(0);
      });
    } catch {
      experimentCount = 0;
    }
  }

  let storageEstimate = null;
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      storageEstimate = {
        usageBytes: est.usage || 0,
        quotaBytes: est.quota || 0,
        usageHuman: `${((est.usage || 0) / (1024 * 1024)).toFixed(2)} MB`,
        quotaHuman: `${((est.quota || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB`
      };
    } catch {
      storageEstimate = null;
    }
  }

  return {
    name: db.name,
    version: db.version,
    stores: storeNames,
    sessionCount,
    habitCount,
    experimentCount,
    storageEstimate,
    status: `Ready (Schema v${db.version} active)`
  };
}

/**
 * Clear all data from stores (used by Settings reset action)
 */
export async function clearAllDatabaseData() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const storesToClear = ['sleep_sessions', 'settings'];
    if (db.objectStoreNames.contains('daily_habits')) {
      storesToClear.push('daily_habits');
    }
    if (db.objectStoreNames.contains('experiments')) {
      storesToClear.push('experiments');
    }
    const tx = db.transaction(storesToClear, 'readwrite');
    storesToClear.forEach((name) => tx.objectStore(name).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
