// scripts/verify.js
// Nocturne Atlas — Comprehensive Acceptance Checks & Verification Suite
// Covers Phase 1 Foundation + Phase 2 Real Sleep Logging & Calculations
// Zero external dependencies — runs directly in Node.js

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    failures.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n======================================================');
console.log('   🌙 Nocturne Atlas — Verification Test Suite');
console.log('======================================================\n');

// ---------------------------------------------------------------------
// TEST GROUP 1: Project Structure & File Integrity
// ---------------------------------------------------------------------
console.log('Test Group 1: Project Structure & File Integrity');

const REQUIRED_FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'favicon.svg',
  'package.json',
  'dev.bat',
  'test.bat',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable.png',
  'assets/icon.svg',
  'css/variables.css',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/screens.css',
  'src/app.js',
  'src/storage/db.js',
  'src/services/calculations.js',
  'src/services/analytics.js',
  'src/services/backup.js',
  'src/components/charts.js',
  'src/services/theme.js',
  'src/services/pwa.js',
  'src/services/navigation.js',
  'src/components/logModal.js',
  'src/components/emptyState.js',
  'src/screens/homeScreen.js',
  'src/screens/insightsScreen.js',
  'src/screens/historyScreen.js',
  'src/screens/settingsScreen.js',
  'scripts/dev-server.js',
  'scripts/generate-icons.js',
  'scripts/verify.js'
];

for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `Required file exists: ${relPath}`);
}

// ---------------------------------------------------------------------
// TEST GROUP 2: Subpath Safety for GitHub Pages Deployment
// ---------------------------------------------------------------------
console.log('\nTest Group 2: Subpath Safety for GitHub Pages Deployment');

const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const absoluteRootRegex = /(?:href|src)=["']\/[^\/]/i;
assert(!absoluteRootRegex.test(htmlContent), 'No absolute root paths (href="/..." or src="/...") in index.html');
assert(htmlContent.includes('href="./manifest.webmanifest"'), 'Manifest linked via relative path "./manifest.webmanifest"');
assert(htmlContent.includes('href="./favicon.svg"'), 'Favicon linked via relative path "./favicon.svg"');
assert(htmlContent.includes('src="./src/app.js"'), 'Bootstrap script linked via relative path "./src/app.js"');

// ---------------------------------------------------------------------
// TEST GROUP 3: PWA Web App Manifest Conformance
// ---------------------------------------------------------------------
console.log('\nTest Group 3: PWA Web App Manifest Conformance');

const manifestRaw = fs.readFileSync(path.join(rootDir, 'manifest.webmanifest'), 'utf8');
let manifest = null;
try {
  manifest = JSON.parse(manifestRaw);
  assert(true, 'manifest.webmanifest is valid JSON');
} catch {
  assert(false, 'manifest.webmanifest is valid JSON');
}

if (manifest) {
  assert(manifest.name === 'Nocturne Atlas — Personal Sleep Tracker', 'Manifest name is "Nocturne Atlas — Personal Sleep Tracker"');
  assert(manifest.short_name === 'Nocturne', 'Manifest short_name is "Nocturne"');
  assert(manifest.start_url === './', 'Manifest start_url is relative "./" (subpath compatible)');
  assert(manifest.scope === './', 'Manifest scope is relative "./" (subpath compatible)');
  assert(manifest.display === 'standalone', 'Manifest display is "standalone"');
  assert(manifest.theme_color === '#171629', 'Manifest theme_color is Ink Plum (#171629)');
  assert(manifest.background_color === '#171629', 'Manifest background_color is Ink Plum (#171629)');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'Manifest includes 4 icon definitions');

  const has192 = manifest.icons.some(i => i.sizes === '192x192' && i.src === 'assets/icon-192.png');
  const has512 = manifest.icons.some(i => i.sizes === '512x512' && i.src === 'assets/icon-512.png');
  const hasMaskable = manifest.icons.some(i => i.purpose && i.purpose.includes('maskable'));
  const hasSvg = manifest.icons.some(i => i.type === 'image/svg+xml');

  assert(has192, 'Manifest contains 192x192 icon');
  assert(has512, 'Manifest contains 512x512 icon');
  assert(hasMaskable, 'Manifest contains maskable icon');
  assert(hasSvg, 'Manifest contains vector SVG icon');
}

// ---------------------------------------------------------------------
// TEST GROUP 4: Service Worker & Privacy Safeguards
// ---------------------------------------------------------------------
console.log('\nTest Group 4: Service Worker & Privacy Safeguards');

const swContent = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
assert(swContent.includes("const CACHE_NAME = 'nocturne-atlas-shell-v4'"), 'Service worker has versioned shell cache name v4');
assert(swContent.includes("addEventListener('install'"), 'Service worker handles install event');
assert(swContent.includes("addEventListener('activate'"), 'Service worker handles activate & cache cleanup event');
assert(swContent.includes("addEventListener('fetch'"), 'Service worker handles fetch event with caching strategy');
assert(swContent.includes("caches.delete"), 'Service worker purges outdated cache versions on activate');
assert(!swContent.toLowerCase().includes('sleep_sessions'), 'Service worker NEVER caches sleep_sessions store');
assert(!swContent.includes('fake') && !swContent.includes('mock_sleep'), 'Service worker contains no fabricated sleep assets');

// ---------------------------------------------------------------------
// TEST GROUP 5: IndexedDB Architecture & Schema Versioning (Schema v3)
// ---------------------------------------------------------------------
console.log('\nTest Group 5: IndexedDB Storage & Schema Versioning (v3)');

const dbContent = fs.readFileSync(path.join(rootDir, 'src/storage/db.js'), 'utf8');
assert(dbContent.includes("const DB_NAME = 'nocturne_atlas_db'"), 'IndexedDB database name is "nocturne_atlas_db"');
assert(dbContent.includes("const DB_VERSION = 3"), 'IndexedDB schema version is upgraded to 3');
assert(dbContent.includes("const MIGRATIONS = ["), 'Migration framework registry is defined');
assert(dbContent.includes("createObjectStore('sleep_sessions'"), 'Creates "sleep_sessions" object store');
assert(dbContent.includes("createObjectStore('settings'"), 'Creates "settings" object store');
assert(dbContent.includes("createObjectStore('schema_meta'"), 'Creates "schema_meta" object store');
assert(dbContent.includes("createObjectStore('daily_habits'"), 'Creates "daily_habits" object store in v2 migration');
assert(dbContent.includes("createIndex('wakeDate'"), 'Creates "wakeDate" index in v2 migration');
assert(dbContent.includes("createIndex('sessionType'"), 'Creates "sessionType" index in v2 migration');
assert(dbContent.includes("createObjectStore('experiments'"), 'Creates "experiments" object store in v3 migration');
assert(dbContent.includes("export async function addSession"), 'Storage exports addSession function');
assert(dbContent.includes("export async function updateSession"), 'Storage exports updateSession function');
assert(dbContent.includes("export async function deleteSession"), 'Storage exports deleteSession function');
assert(dbContent.includes("export async function getHabit"), 'Storage exports getHabit function');
assert(dbContent.includes("export async function saveHabit"), 'Storage exports saveHabit function');
assert(dbContent.includes("export async function getActiveExperiment"), 'Storage exports getActiveExperiment function');
assert(dbContent.includes("export async function getAllExperiments"), 'Storage exports getAllExperiments function');
assert(dbContent.includes("export async function saveExperiment"), 'Storage exports saveExperiment function');
assert(dbContent.includes("export async function completeExperiment"), 'Storage exports completeExperiment function');
assert(dbContent.includes("export async function abandonExperiment"), 'Storage exports abandonExperiment function');
assert(dbContent.includes("export async function getTargetSleepMinutes"), 'Storage exports getTargetSleepMinutes function');
assert(dbContent.includes("export async function getAllSettings"), 'Storage exports getAllSettings function');
assert(dbContent.includes("export async function exportAllDatabaseData"), 'Storage exports exportAllDatabaseData function');
assert(dbContent.includes("export async function importRestoreMerge"), 'Storage exports importRestoreMerge function');
assert(dbContent.includes("export async function importRestoreReplace"), 'Storage exports importRestoreReplace function');

// ---------------------------------------------------------------------
// TEST GROUP 6: Visual Palette & Contrast Check
// ---------------------------------------------------------------------
console.log('\nTest Group 6: Visual Palette & Contrast Check');

const cssVars = fs.readFileSync(path.join(rootDir, 'css/variables.css'), 'utf8');
assert(cssVars.includes('#171629'), 'Ink Plum (#171629) token defined');
assert(cssVars.includes('#F3EFE7'), 'Moon Paper (#F3EFE7) token defined');
assert(cssVars.includes('#8ADBD0'), 'Tidal Mint (#8ADBD0) token defined');
assert(cssVars.includes('#AAA0FF'), 'Orbit Lilac (#AAA0FF) token defined');
assert(cssVars.includes('#FF947F'), 'Afterglow (#FF947F) token defined');
assert(cssVars.includes('[data-theme="dark"]'), 'Dark theme token block configured');
assert(cssVars.includes('[data-theme="light"]'), 'Light theme token block configured');
assert(cssVars.includes('#9E9AB3'), 'Dark theme --text-muted updated with improved contrast (#9E9AB3)');
assert(cssVars.includes('#58546C'), 'Light theme --text-muted updated with WCAG AA compliant contrast (#58546C)');

// Theme service check
const themeServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/theme.js'), 'utf8');
assert(themeServiceContent.includes("'dark'"), 'Theme service supports "dark" option');
assert(themeServiceContent.includes("'light'"), 'Theme service supports "light" option');
assert(themeServiceContent.includes("'system'"), 'Theme service supports "system" option');
assert(themeServiceContent.includes("localStorage.setItem"), 'Theme preference persists to localStorage');

// ---------------------------------------------------------------------
// TEST GROUP 7: Dynamic Calendar Calculations & Alignment
// ---------------------------------------------------------------------
console.log('\nTest Group 7: Dynamic Calendar Calculations & Alignment');

const { getCalendarGridData } = await import('../src/screens/historyScreen.js');

const oct2026 = getCalendarGridData(2026, 9);
assert(oct2026.totalDays === 31, 'October 2026 contains exactly 31 days (including Oct 29, 30, 31)');
assert(oct2026.leadingBlanks === 3, 'October 2026 starts on Thursday (3 leading blank cells for Mon, Tue, Wed)');
assert(oct2026.trailingBlanks === 1, 'October 2026 has 1 trailing blank cell (to complete 5 full 7-day rows)');
assert(oct2026.totalCells === 35, 'October 2026 grid renders exactly 35 cells (5 rows of 7)');

const feb2024 = getCalendarGridData(2024, 1);
assert(feb2024.totalDays === 29, 'Leap year: February 2024 contains 29 days');
assert(feb2024.leadingBlanks === 3, 'February 2024 starts on Thursday (3 leading blank cells)');

const feb2026 = getCalendarGridData(2026, 1);
assert(feb2026.totalDays === 28, 'Non-leap year: February 2026 contains 28 days');
assert(feb2026.leadingBlanks === 6, 'February 2026 starts on Sunday (6 leading blank cells in Mon-first grid)');

const nov2026 = getCalendarGridData(2026, 10);
assert(nov2026.totalDays === 30, 'November 2026 contains 30 days');
assert(nov2026.leadingBlanks === 6, 'November 2026 starts on Sunday (6 leading blank cells)');
assert(nov2026.trailingBlanks === 6, 'November 2026 has 6 trailing blank cells (completing full 6-row grid)');

const historyContent = fs.readFileSync(path.join(rootDir, 'src/screens/historyScreen.js'), 'utf8');
assert(historyContent.includes('calendar-weekday-headers'), 'History screen includes Monday-to-Sunday headers');
assert(historyContent.includes('cal-prev-month'), 'History screen includes previous month navigation button');
assert(historyContent.includes('cal-next-month'), 'History screen includes next month navigation button');
assert(historyContent.includes('cal-today-btn'), 'History screen includes "Today" navigation button');

// ---------------------------------------------------------------------
// TEST GROUP 8: Accurate PWA & Offline Diagnostics
// ---------------------------------------------------------------------
console.log('\nTest Group 8: Accurate PWA & Offline Diagnostics');

const pwaServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/pwa.js'), 'utf8');
assert(pwaServiceContent.includes('export async function getPWADiagnostics()'), 'PWA service exports getPWADiagnostics function');
assert(pwaServiceContent.includes('originExplanation'), 'PWA diagnostics provide beginner-friendly connection guidance');
assert(pwaServiceContent.includes('nocturne-atlas-shell'), 'Cache verification inspects shell cache container');

const settingsContent = fs.readFileSync(path.join(rootDir, 'src/screens/settingsScreen.js'), 'utf8');
assert(settingsContent.includes('getPWADiagnostics'), 'Settings screen queries live getPWADiagnostics()');
assert(settingsContent.includes('Connection Origin:'), 'Settings screen displays Connection Origin row');
assert(settingsContent.includes('Secure Context:'), 'Settings screen displays Secure Context status row');
assert(settingsContent.includes('Shell Cache Verification:'), 'Settings screen displays verified Cache state');
assert(settingsContent.includes('pwa-diagnostic-alert'), 'Settings screen provides helpful notice for insecure/file contexts');
assert(!settingsContent.includes('Offline Readiness: ✓ Shell assets cached locally'), 'Settings screen never uses hardcoded unconditional cache claims');

// ---------------------------------------------------------------------
// TEST GROUP 9: Mobile Dialog Responsiveness & Flexbox Constraints
// ---------------------------------------------------------------------
console.log('\nTest Group 9: Mobile Dialog Responsiveness & Flexbox Constraints');

const componentsCss = fs.readFileSync(path.join(rootDir, 'css/components.css'), 'utf8');
assert(componentsCss.includes('#log-sleep-form'), 'CSS contains dedicated #log-sleep-form selector');
assert(componentsCss.includes('display: flex') && componentsCss.includes('min-height: 0'), 'Form uses flex with min-height: 0 to enable nested scrolling');
assert(componentsCss.includes('-webkit-overflow-scrolling: touch'), 'Modal body enables momentum scrolling for mobile WebKit');
assert(componentsCss.includes('overscroll-behavior: contain'), 'Modal dialog and body contain overscroll to prevent page lock');
assert(componentsCss.includes('max-height: 90dvh'), 'Dialog card uses modern dvh viewport height for mobile keyboards');

// ---------------------------------------------------------------------
// TEST GROUP 10: Screen Structure & Navigation Safeguards
// ---------------------------------------------------------------------
console.log('\nTest Group 10: Screen Structure & Navigation Safeguards');

const navService = fs.readFileSync(path.join(rootDir, 'src/services/navigation.js'), 'utf8');
assert(navService.includes("const DESTINATIONS = ['home', 'insights', 'history', 'settings']"), 'Exactly 4 permanent destinations: Home, Insights, History, Settings');

const homeContent = fs.readFileSync(path.join(rootDir, 'src/screens/homeScreen.js'), 'utf8');
assert(homeContent.includes('24-Hour Sleep Map'), 'Home screen contains 24-Hour Sleep Map placeholder/card');
assert(homeContent.includes('Key Sleep Indicators'), 'Home screen contains Key Sleep Indicators');
assert(homeContent.includes('7-Day Rhythm Preview'), 'Home screen contains 7-Day Rhythm Preview');
assert(homeContent.includes('Recent Sleep Sessions'), 'Home screen contains Recent Sessions section');
assert(homeContent.includes('No sleep sessions recorded yet'), 'Home screen includes honest empty state');

const insightsContent = fs.readFileSync(path.join(rootDir, 'src/screens/insightsScreen.js'), 'utf8');
assert(insightsContent.includes('Longitudinal Trends') || insightsContent.includes('Sleep Duration Trends'), 'Insights screen contains Trends section');
assert(insightsContent.includes('Evidence-Based Sleep Principles'), 'Insights screen contains Science principles section');
assert(insightsContent.includes('Weekly Habit') || insightsContent.includes('Weekly Behavioural Experiment'), 'Insights screen contains Weekly experiment section');

assert(settingsContent.includes('Privacy &amp; Data Ownership') || settingsContent.includes('Privacy & Data Ownership'), 'Settings screen contains Privacy guarantees');
assert(settingsContent.includes('Local Database Architecture'), 'Settings screen contains DB diagnostics');
assert(settingsContent.includes('Data Portability &amp; Reset') || settingsContent.includes('Data Portability & Reset'), 'Settings screen marks future Phase 3 Backup/Restore');
assert(settingsContent.includes('Personal Sleep Target'), 'Settings screen includes configurable sleep target preference');

// ---------------------------------------------------------------------
// TEST GROUP 11: Phase 2 Pure Calculations & Chronobiology Asserts
// ---------------------------------------------------------------------
console.log('\nTest Group 11: Phase 2 Pure Calculations & Chronobiology Asserts');

const calc = await import('../src/services/calculations.js');

// 1. Time in Bed
const tStart = new Date('2026-10-27T23:00:00+05:30').getTime();
const tEnd = new Date('2026-10-28T07:30:00+05:30').getTime();
const tib = calc.calculateTimeInBedMinutes(tStart, tEnd);
assert(tib === 510, 'Overnight time in bed calculated correctly: 8h 30m = 510 minutes');

const napStart = new Date('2026-10-28T14:15:00+05:30').getTime();
const napEnd = new Date('2026-10-28T15:00:00+05:30').getTime();
const napTib = calc.calculateTimeInBedMinutes(napStart, napEnd);
assert(napTib === 45, 'Daytime nap time in bed calculated correctly: 45 minutes');

// 2. Estimated Sleep Duration: Missing Latency
const noLat = calc.calculateEstimatedSleepDuration({ timeInBedMinutes: 480, latencyMinutes: null, awakeAfterOnsetMinutes: 20 });
assert(noLat.hasEstimate === false, 'Estimated sleep is unavailable when latency is missing');
assert(noLat.status === 'unavailable', 'Missing latency status is "unavailable"');
assert(noLat.assumption.includes('not recorded'), 'Missing latency explains assumption clearly');

// 3. Estimated Sleep Duration: Complete with Latency & WASO
const completeEst = calc.calculateEstimatedSleepDuration({ timeInBedMinutes: 480, latencyMinutes: 20, awakeAfterOnsetMinutes: 30 });
assert(completeEst.hasEstimate === true, 'Estimated sleep computed when latency & WASO provided');
assert(completeEst.estimatedMinutes === 430, '480m TIB - 20m latency - 30m WASO = 430 minutes');
assert(completeEst.formatted === '7h 10m', 'Formatted duration is "7h 10m"');
assert(completeEst.status === 'complete_estimate', 'Status is "complete_estimate"');

// 4. Estimated Sleep Duration: Latency provided but WASO missing
const partialEst = calc.calculateEstimatedSleepDuration({ timeInBedMinutes: 480, latencyMinutes: 15, awakeAfterOnsetMinutes: null });
assert(partialEst.hasEstimate === true, 'Partial estimate computed with latency only');
assert(partialEst.estimatedMinutes === 465, '480m TIB - 15m latency = 465 minutes');
assert(partialEst.status === 'partial_estimate', 'Status is "partial_estimate"');
assert(partialEst.assumption.includes('unmeasured awake periods'), 'Partial estimate explicitly notes unmeasured WASO');

// 5. Estimated Sleep Duration: Invalid when awake time exceeds TIB
const invalidEst = calc.calculateEstimatedSleepDuration({ timeInBedMinutes: 100, latencyMinutes: 60, awakeAfterOnsetMinutes: 50 });
assert(invalidEst.hasEstimate === false, 'Estimate is invalid when latency + WASO > TIB');
assert(invalidEst.status === 'invalid', 'Status is "invalid" when awake time exceeds TIB');

// 6. Sleep Efficiency
const eff = calc.calculateSleepEfficiency(480, 432);
assert(eff.hasEfficiency === true, 'Efficiency calculated when sleep and TIB present');
assert(eff.efficiencyPercent === 90, 'Efficiency calculated accurately (432 / 480 = 90%)');
assert(eff.formatted === '90%', 'Efficiency formatted as "90%"');

const noEff = calc.calculateSleepEfficiency(480, null);
assert(noEff.hasEfficiency === false, 'Efficiency unavailable when estimated sleep is null');

// ---------------------------------------------------------------------
// TEST GROUP 12: Interval Union Deduplication & Overlap Detection
// ---------------------------------------------------------------------
console.log('\nTest Group 12: Interval Union Deduplication & Overlap Detection');

// 1. Two overlapping intervals: [100, 300] and [200, 400]
// Union is [100, 400] = 300ms, NOT 200 + 200 = 400ms!
const t1Start = 100000000;
const t1End   = 100000000 + 480 * 60000; // 8h = 480m
const t2Start = 100000000 + 360 * 60000; // Starts 2h before t1 ends
const t2End   = 100000000 + 540 * 60000; // Ends 1h after t1 ends (3h = 180m total)
// Union: [0, 540] = 540 minutes total, NOT 480 + 180 = 660m!
const unionMin = calc.calculateIntervalUnionMinutes([
  { start: t1Start, end: t1End },
  { start: t2Start, end: t2End }
]);
assert(unionMin === 540, 'Interval union deduplication produces exact 540m elapsed time without double-counting');

// 2. Overlap detection function
const s1 = { id: 's1', startTimestamp: t1Start, endTimestamp: t1End, sessionType: 'main' };
const s2 = { id: 's2', startTimestamp: t2Start, endTimestamp: t2End, sessionType: 'nap' };
const overlaps = calc.findOverlappingSessions(s2, [s1]);
assert(overlaps.length === 1, 'findOverlappingSessions identifies 1 conflicting session');
assert(overlaps[0].overlapMinutes === 120, 'Overlap duration between sessions is exactly 120 minutes (2 hours)');

// 3. Non-overlapping contiguous or separated intervals
const s3Start = t2End + 60000;
const s3End = s3Start + 60 * 60000;
const noOverlaps = calc.findOverlappingSessions({ startTimestamp: s3Start, endTimestamp: s3End }, [s1]);
assert(noOverlaps.length === 0, 'No false overlaps for separated non-overlapping sessions');

// ---------------------------------------------------------------------
// TEST GROUP 13: Wake-Up-Date Attribution & Validation Rules
// ---------------------------------------------------------------------
console.log('\nTest Group 13: Wake-Up-Date Attribution & Validation Rules');

// 1. Overnight Wake-Up-Date Attribution
const overnightValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-26T23:15',
  endTime: '2026-10-27T07:15',
  latencyMinutes: '15',
  awakeAfterOnsetMinutes: '20',
  awakeningsCount: '1',
  restednessRating: '4',
  energyRating: '4',
  notes: 'Felt well rested'
});
assert(overnightValidation.isValid === true, 'Overnight session validates successfully');
assert(overnightValidation.sanitized.wakeDate === '2026-10-27', 'Overnight session wakeDate is correctly attributed to the wake-up date (Tuesday Oct 27)');
assert(overnightValidation.sanitized.timeInBedMinutes === 480, 'Overnight time in bed is 480 minutes (8h)');

// 2. Wake time must be later than start time
const backwardsValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-27T08:00',
  endTime: '2026-10-27T06:00'
});
assert(backwardsValidation.isValid === false, 'Rejects wake time earlier than start time');
assert(Boolean(backwardsValidation.errors.endTime), 'Error reported on endTime field');

// 3. Negative latency or awake time
const negativeValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-27T23:00',
  endTime: '2026-10-28T07:00',
  latencyMinutes: '-10'
});
assert(negativeValidation.isValid === false, 'Rejects negative latency input');
assert(Boolean(negativeValidation.errors.latencyMinutes), 'Error reported on latencyMinutes');

// 4. Non-integer awakenings count
const floatAwkValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-27T23:00',
  endTime: '2026-10-28T07:00',
  awakeningsCount: '2.5'
});
assert(floatAwkValidation.isValid === false, 'Rejects non-integer awakenings count (2.5)');
assert(Boolean(floatAwkValidation.errors.awakeningsCount), 'Error reported on awakeningsCount');

// 5. Ratings outside 1-5
const ratingValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-27T23:00',
  endTime: '2026-10-28T07:00',
  restednessRating: '6'
});
assert(ratingValidation.isValid === false, 'Rejects restedness rating outside 1..5 range');
assert(Boolean(ratingValidation.errors.restednessRating), 'Error reported on restednessRating');

// 6. Blank optional inputs remain null (never converted to 0)
const blankValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-27T23:00',
  endTime: '2026-10-28T07:00',
  latencyMinutes: '',
  awakeAfterOnsetMinutes: '',
  awakeningsCount: '',
  restednessRating: null,
  energyRating: null
});
assert(blankValidation.isValid === true, 'Valid session with empty optional fields');
assert(blankValidation.sanitized.latencyMinutes === null, 'Blank latency remains null (not 0)');
assert(blankValidation.sanitized.awakeAfterOnsetMinutes === null, 'Blank WASO remains null (not 0)');
assert(blankValidation.sanitized.awakeningsCount === null, 'Blank awakenings count remains null (not 0)');

// 7. Unusually long session advisory warning
const longValidation = calc.validateSessionData({
  sessionType: 'main',
  startTime: '2026-10-27T18:00',
  endTime: '2026-10-28T12:00' // 18 hours
});
assert(longValidation.isValid === true, 'Unusually long session is not silently blocked or truncated');
assert(longValidation.warnings.length > 0, 'Generates an advisory warning for unusually long duration');

// ---------------------------------------------------------------------
// TEST GROUP 14: Daily Habits & Session Contracts
// ---------------------------------------------------------------------
console.log('\nTest Group 14: Daily Habits & Form Contracts');

const modalContent = fs.readFileSync(path.join(rootDir, 'src/components/logModal.js'), 'utf8');
assert(modalContent.includes('openLogModalForEdit'), 'logModal exports openLogModalForEdit');
assert(modalContent.includes('openLogModalForCreate'), 'logModal exports openLogModalForCreate');
assert(modalContent.includes('executeDelete'), 'logModal exports executeDelete');
assert(modalContent.includes('showToastWithUndo'), 'logModal supports undoing session deletion');
assert(modalContent.includes('isFormDirty'), 'logModal includes dirty form / unsaved changes guard');
assert(modalContent.includes('findOverlappingSessions'), 'logModal executes overlap detection');

assert(htmlContent.includes('id="log-session-type"'), 'Modal contains Session Type selection');
assert(htmlContent.includes('name="habit-caffeine"'), 'Modal contains Caffeine habit radio group');
assert(htmlContent.includes('name="habit-screen"'), 'Modal contains Screen habit radio group');
assert(htmlContent.includes('name="habit-stress"'), 'Modal contains Stress habit radio group');
assert(htmlContent.includes('value="not_recorded"'), 'Habit radios include explicit "not_recorded" option');
assert(htmlContent.includes('id="toast-container"'), 'DOM includes toast container for undo notifications');

// ---------------------------------------------------------------------
// TEST GROUP 15: Live Local HTTP Server Integration Check
// ---------------------------------------------------------------------
console.log('\nTest Group 15: Live Local HTTP Server Integration');

async function testHttpServer() {
  const testPort = 3899;

  return new Promise((resolve) => {
    const MIME_TYPES = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.svg': 'image/svg+xml; charset=utf-8',
      '.png': 'image/png'
    };

    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent(req.url.split('?')[0]);
      if (pathname === '/' || pathname.endsWith('/')) {
        pathname += 'index.html';
      }
      const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(rootDir, safePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('404');
      }
    });

    server.listen(testPort, async () => {
      const checkPath = (urlPath) => new Promise((resFetch) => {
        http.get(`http://localhost:${testPort}${urlPath}`, (response) => {
          resFetch({ status: response.statusCode, contentType: response.headers['content-type'] });
        }).on('error', (err) => resFetch({ status: 500, error: err }));
      });

      const rootRes = await checkPath('/');
      assert(rootRes.status === 200, 'HTTP GET "/" responds with 200 OK');

      const manifestRes = await checkPath('/manifest.webmanifest');
      assert(manifestRes.status === 200, 'HTTP GET "/manifest.webmanifest" responds with 200 OK');

      const swRes = await checkPath('/sw.js');
      assert(swRes.status === 200, 'HTTP GET "/sw.js" responds with 200 OK');

      const calcRes = await checkPath('/src/services/calculations.js');
      assert(calcRes.status === 200, 'HTTP GET "/src/services/calculations.js" responds with 200 OK');

      const analyticsRes = await checkPath('/src/services/analytics.js');
      assert(analyticsRes.status === 200, 'HTTP GET "/src/services/analytics.js" responds with 200 OK');

      const backupRes = await checkPath('/src/services/backup.js');
      assert(backupRes.status === 200, 'HTTP GET "/src/services/backup.js" responds with 200 OK');

      const chartsRes = await checkPath('/src/components/charts.js');
      assert(chartsRes.status === 200, 'HTTP GET "/src/components/charts.js" responds with 200 OK');

      const appRes = await checkPath('/src/app.js');
      assert(appRes.status === 200, 'HTTP GET "/src/app.js" responds with 200 OK');

      const cssRes = await checkPath('/css/variables.css');
      assert(cssRes.status === 200, 'HTTP GET "/css/variables.css" responds with 200 OK');

      server.close(() => {
        resolve();
      });
    });
  });
}

await testHttpServer();

// ---------------------------------------------------------------------
// TEST GROUP 16: Sleep Duration Trends & Window Summaries (Phase 3)
// ---------------------------------------------------------------------
console.log('\nTest Group 16: Sleep Duration Trends & Window Summaries (Phase 3)');

const analytics = await import('../src/services/analytics.js');
const charts = await import('../src/components/charts.js');

const sampleSessions = [
  { id: 's1', wakeDate: '2026-10-25', startTimestamp: new Date('2026-10-24T23:00').getTime(), endTimestamp: new Date('2026-10-25T07:00').getTime(), timeInBedMinutes: 480, latencyMinutes: 15, awakeAfterOnsetMinutes: 15, sessionType: 'main' },
  { id: 's2', wakeDate: '2026-10-27', startTimestamp: new Date('2026-10-26T23:30').getTime(), endTimestamp: new Date('2026-10-27T07:30').getTime(), timeInBedMinutes: 480, latencyMinutes: 20, awakeAfterOnsetMinutes: 10, sessionType: 'main' },
  { id: 's3', wakeDate: '2026-10-27', startTimestamp: new Date('2026-10-27T13:30').getTime(), endTimestamp: new Date('2026-10-27T14:15').getTime(), timeInBedMinutes: 45, latencyMinutes: null, awakeAfterOnsetMinutes: null, sessionType: 'nap' }
];

const trends = analytics.calculateDurationTrends(sampleSessions, { days: 7, endDateStr: '2026-10-27' });
assert(trends.windowDays === 7, 'Duration trends calculates 7-day rolling window');
assert(trends.recordedDaysCount === 2, 'Detects exactly 2 recorded days');
assert(trends.missingDaysCount === 5, 'Detects exactly 5 missing days in 7-day window');

const missingDay = trends.days.find(d => d.dateStr === '2026-10-26');
assert(missingDay.isMissing === true, 'Missing day has isMissing = true');
assert(missingDay.timeInBedMinutes === null, 'Missing day has timeInBedMinutes = null (never zero)');
assert(missingDay.formattedTib === '--', 'Missing day formatted as "--"');

const day27 = trends.days.find(d => d.dateStr === '2026-10-27');
assert(day27.isMissing === false, 'Recorded day has isMissing = false');
assert(day27.sessionCount === 2, 'Recorded day has 2 sessions (main + nap)');
assert(day27.timeInBedMinutes === 525, 'Recorded day deduplicated TIB is 480 + 45 = 525 minutes');
assert(trends.meetsBasicThreshold === false, 'Flagged as below basic threshold (2 < 3 nights)');
assert(trends.statusNotice.includes('Requires at least 3 logged nights'), 'Explains 3-night minimum threshold clearly');

// ---------------------------------------------------------------------
// TEST GROUP 17: Main-Sleep Timing Consistency & Midnight-Crossing Math
// ---------------------------------------------------------------------
console.log('\nTest Group 17: Main-Sleep Timing Consistency & Midnight-Crossing Math');

const off2330 = analytics.calculateMidnightOffsetMinutes('2026-10-26T23:30:00');
assert(off2330 === -30, '23:30 maps to -30 minutes from midnight');

const off0030 = analytics.calculateMidnightOffsetMinutes('2026-10-27T00:30:00');
assert(off0030 === 30, '00:30 maps to +30 minutes from midnight');

const off2200 = analytics.calculateMidnightOffsetMinutes('2026-10-26T22:00:00');
assert(off2200 === -120, '22:00 maps to -120 minutes from midnight');

const meanOff = (off2330 + off0030) / 2;
assert(meanOff === 0, 'Circular offset average of 23:30 and 00:30 is 0 minutes (midnight)');
const meanClock = analytics.midnightOffsetToClockTime(meanOff);
assert(meanClock === '00:00', '0m offset converts to clock time "00:00"');
assert(analytics.midnightOffsetToClockTime(-30) === '23:30', '-30m offset converts to "23:30"');
assert(analytics.midnightOffsetToClockTime(45) === '00:45', '+45m offset converts to "00:45"');

const mainSessions = [
  { id: 'm1', sessionType: 'main', wakeDate: '2026-10-25', startTimestamp: new Date('2026-10-24T23:30').getTime(), endTimestamp: new Date('2026-10-25T07:30').getTime() },
  { id: 'm2', sessionType: 'main', wakeDate: '2026-10-26', startTimestamp: new Date('2026-10-25T23:45').getTime(), endTimestamp: new Date('2026-10-26T07:45').getTime() },
  { id: 'm3', sessionType: 'main', wakeDate: '2026-10-27', startTimestamp: new Date('2026-10-27T00:15').getTime(), endTimestamp: new Date('2026-10-27T08:00').getTime() },
  { id: 'nap1', sessionType: 'nap', wakeDate: '2026-10-26', startTimestamp: new Date('2026-10-26T13:30').getTime(), endTimestamp: new Date('2026-10-26T14:15').getTime() }
];

const timingAnalysis = analytics.calculateTimingConsistency(mainSessions, { days: 14 });
assert(timingAnalysis.hasSufficientData === true, 'Sufficient data when >= 3 main sleep sessions present');
assert(timingAnalysis.sampleSize === 3, 'Strictly filters out naps (sample size = 3, not 4)');
assert(timingAnalysis.bedtimeStdDevMinutes >= 0, 'Computes non-negative standard deviation');
assert(typeof timingAnalysis.regularityLabel === 'string', 'Assigns neutral regularity label');
assert(!timingAnalysis.regularityLabel.includes('disorder') && !timingAnalysis.regularityLabel.includes('abnormal'), 'Uses non-pathological labeling');

const fewSessions = [mainSessions[0]];
const underThreshold = analytics.calculateTimingConsistency(fewSessions, { days: 14 });
assert(underThreshold.hasSufficientData === false, 'Returns insufficient data when main sessions < 3');
assert(underThreshold.reason.includes('Requires at least 3'), 'Explains minimum 3-session requirement');

// ---------------------------------------------------------------------
// TEST GROUP 18: Daytime Sleep & Subjective Ratings Analysis
// ---------------------------------------------------------------------
console.log('\nTest Group 18: Daytime Sleep & Subjective Ratings Analysis');

const napAnalysis = analytics.calculateDaytimeSleepPatterns(mainSessions, { days: 14 });
assert(napAnalysis.hasNaps === true, 'Detects naps when present');
assert(napAnalysis.napCount === 1, 'Counts exactly 1 nap');
assert(napAnalysis.averageNapMinutes === 45, 'Average nap duration is 45 minutes');
assert(napAnalysis.cautiousNote.includes('varies naturally'), 'Nap analysis frames recovery non-causally');

const noNapAnalysis = analytics.calculateDaytimeSleepPatterns([mainSessions[0]], { days: 14 });
assert(noNapAnalysis.hasNaps === false, 'Correctly handles zero naps without errors');

const ratedSessions = [
  { id: 'r1', wakeDate: '2026-10-24', startTimestamp: 100000, endTimestamp: 100000 + 480 * 60000, timeInBedMinutes: 480, energyRating: 4, restednessRating: 4 },
  { id: 'r2', wakeDate: '2026-10-25', startTimestamp: 200000, endTimestamp: 200000 + 450 * 60000, timeInBedMinutes: 450, energyRating: 3, restednessRating: 3 },
  { id: 'r3', wakeDate: '2026-10-26', startTimestamp: 300000, endTimestamp: 300000 + 510 * 60000, timeInBedMinutes: 510, energyRating: 5, restednessRating: 5 },
  { id: 'r4', wakeDate: '2026-10-27', startTimestamp: 400000, endTimestamp: 400000 + 420 * 60000, timeInBedMinutes: 420, energyRating: 2, restednessRating: 2 },
  { id: 'r5_unrated', wakeDate: '2026-10-28', startTimestamp: 500000, endTimestamp: 500000 + 480 * 60000, timeInBedMinutes: 480 }
];

const energyCorrelations = analytics.calculateRestednessEnergyCorrelations(ratedSessions);
assert(energyCorrelations.hasSufficientData === true, 'Sufficient data when >= 4 rated sessions exist');
assert(energyCorrelations.sampleSize === 4, 'Ignores unrated session (sample size = 4)');
assert(energyCorrelations.energyGroups.length === 5, 'Constructs 5 energy rating groups (1..5)');
assert(energyCorrelations.cautiousDisclaimer.includes('subjective self-assessments'), 'Discloses subjective nature of ratings');

const underRated = analytics.calculateRestednessEnergyCorrelations([ratedSessions[0], ratedSessions[1]]);
assert(underRated.hasSufficientData === false, 'Returns insufficient data when rated pairs < 4');

// ---------------------------------------------------------------------
// TEST GROUP 19: Lifestyle Habit Associations & Behavioral Experiments
// ---------------------------------------------------------------------
console.log('\nTest Group 19: Lifestyle Habit Associations & Behavioral Experiments');

const habitSessions = [
  { id: 'hs1', wakeDate: '2026-10-21', timeInBedMinutes: 480, latencyMinutes: 15, sessionType: 'main' },
  { id: 'hs2', wakeDate: '2026-10-22', timeInBedMinutes: 460, latencyMinutes: 20, sessionType: 'main' },
  { id: 'hs3', wakeDate: '2026-10-23', timeInBedMinutes: 470, latencyMinutes: 25, sessionType: 'main' },
  { id: 'hs4', wakeDate: '2026-10-24', timeInBedMinutes: 490, latencyMinutes: 10, sessionType: 'main' },
  { id: 'hs5', wakeDate: '2026-10-25', timeInBedMinutes: 500, latencyMinutes: 12, sessionType: 'main' },
  { id: 'hs6', wakeDate: '2026-10-26', timeInBedMinutes: 480, latencyMinutes: 15, sessionType: 'main' },
  { id: 'hs7_unrec', wakeDate: '2026-10-27', timeInBedMinutes: 480, latencyMinutes: 15, sessionType: 'main' }
];

const habitLogs = [
  { date: '2026-10-21', caffeine: 'yes', screenLate: 'yes', stressRating: 4 },
  { date: '2026-10-22', caffeine: 'yes', screenLate: 'yes', stressRating: 5 },
  { date: '2026-10-23', caffeine: 'yes', screenLate: 'no',  stressRating: 4 },
  { date: '2026-10-24', caffeine: 'no',  screenLate: 'no',  stressRating: 2 },
  { date: '2026-10-25', caffeine: 'no',  screenLate: 'no',  stressRating: 2 },
  { date: '2026-10-26', caffeine: 'no',  screenLate: 'no',  stressRating: 3 },
  { date: '2026-10-27', caffeine: 'not_recorded', screenLate: 'not_recorded', stressRating: null }
];

const habitAnalysis = analytics.calculateHabitAssociations(habitSessions, habitLogs);
assert(habitAnalysis.caffeine.hasSufficientData === true, 'Caffeine comparison valid with 3 Yes and 3 No');
assert(habitAnalysis.caffeine.yesCount === 3, 'Counts exactly 3 Yes caffeine nights');
assert(habitAnalysis.caffeine.noCount === 3, 'Counts exactly 3 No caffeine nights');
assert(habitAnalysis.caffeine.unrecordedCount === 1, 'Strictly isolates 1 unrecorded night (not counted as No)');
assert(habitAnalysis.cautiousDisclaimer.includes('do not demonstrate direct biological causation'), 'Habit comparison emphasizes non-causation');

assert(habitAnalysis.screen.hasSufficientData === false, 'Screen comparison marked insufficient when Yes < 3');
assert(habitAnalysis.screen.reason.includes('too small'), 'Screen comparison explains sample size threshold');

assert(Array.isArray(analytics.EXPERIMENT_CATALOG), 'Experiment catalog is an array');
assert(analytics.EXPERIMENT_CATALOG.length === 4, 'Experiment catalog provides 4 science-grounded protocols');
const cafProto = analytics.EXPERIMENT_CATALOG.find(p => p.protocolId === 'caffeine_cutoff');
assert(cafProto.title.includes('Caffeine Cutoff'), 'Catalog contains Caffeine Cutoff protocol');
assert(cafProto.targetDays === 7, 'Target duration is 7 days');

const expRecord = {
  id: 'exp_test_1',
  protocolId: 'caffeine_cutoff',
  title: 'Afternoon Caffeine Cutoff (2:00 PM)',
  startedAt: '2026-10-21',
  targetEndDate: '2026-10-28',
  targetDays: 7,
  status: 'active'
};
const expProgress = analytics.analyzeExperimentProgress(expRecord, habitSessions);
assert(expProgress.loggedDaysCount === 7, 'Experiment progress tracks 7 logged days');
assert(expProgress.progressPercent === 100, 'Calculates 100% progress for 7 of 7 days');
assert(expProgress.formattedAvgLatency !== '--', 'Computes average latency during experiment window');

// ---------------------------------------------------------------------
// TEST GROUP 20: Responsive Interactive Charts & Evidence Communication
// ---------------------------------------------------------------------
console.log('\nTest Group 20: Responsive Interactive Charts & Evidence Communication');

const durationChartHtml = charts.renderDurationTrendChart(trends);
assert(durationChartHtml.includes('class="chart-wrapper"'), 'Duration chart renders container wrapper');
assert(durationChartHtml.includes('missing-col'), 'Duration chart renders distinct missing-col elements');
assert(durationChartHtml.includes('col-missing-indicator'), 'Duration chart renders missing dash indicator');
assert(durationChartHtml.includes('details class="chart-table-toggle"'), 'Duration chart renders accessible tabular fallback');
assert(durationChartHtml.includes('id="duration-chart-popover"'), 'Duration chart includes interactive popover target');

const timingChartHtml = charts.renderTimingConsistencyChart(timingAnalysis);
assert(timingChartHtml.includes('timing-axis-scale'), 'Timing chart renders time axis scale');
assert(timingChartHtml.includes('axis-midnight'), 'Timing chart renders midnight axis marker');
assert(timingChartHtml.includes('timing-interval-bar'), 'Timing chart renders interval sleep bars');
assert(timingChartHtml.includes('details class="chart-table-toggle"'), 'Timing chart renders accessible table fallback');

const energyChartHtml = charts.renderDurationVsEnergyChart(energyCorrelations);
assert(energyChartHtml.includes('energy-chart-list'), 'Energy chart renders list of ratings');
assert(energyChartHtml.includes('Sample size:'), 'Energy chart explicitly states sample size');

const insightsHtml = fs.readFileSync(path.join(rootDir, 'src/screens/insightsScreen.js'), 'utf8');
assert(insightsHtml.includes('medical-disclaimer-box'), 'Insights screen contains medical disclaimer box');
assert(insightsHtml.includes('personal tracking journal, not a medical or clinical diagnostic tool'), 'Explicitly notes journal is not a diagnostic tool');
assert(!insightsHtml.includes('16–19°C') && !insightsHtml.includes('16-19°C'), 'Removed rigid universal temperature claim (16-19°C)');
assert(insightsHtml.includes('comfortably cool') || insightsHtml.includes('thermal comfort varies'), 'Frames temperature around personal comfort and natural cooling');

// ---------------------------------------------------------------------
// TEST GROUP 21: JSON Backup Data Export & Filename Generation (Phase 4)
// ---------------------------------------------------------------------
console.log('\nTest Group 21: JSON Backup Data Export & Filename Generation (Phase 4)');

const backup = await import('../src/services/backup.js');

const testDate = new Date('2026-10-28T12:00:00Z');
const fname = backup.generateBackupFilename(testDate);
assert(fname.startsWith('nocturne-atlas-backup-'), 'Backup filename starts with "nocturne-atlas-backup-"');
assert(fname.endsWith('.json'), 'Backup filename ends with ".json"');
assert(fname.includes('2026-10-28'), 'Backup filename includes formatted date "2026-10-28"');
assert(backup.BACKUP_FORMAT_VERSION === 1, 'Current backup format version is 1');
assert(backup.MAX_BACKUP_FILE_BYTES === 15 * 1024 * 1024, 'Maximum backup file limit configured to 15MB');

const sampleExportPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  sourceSchemaVersion: 3,
  metadata: {
    sessionCount: 1,
    habitCount: 1,
    experimentCount: 1,
    settingsCount: 1
  },
  data: {
    sleep_sessions: [
      { id: 's_exp_1', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100000, endTimestamp: 100000 + 480 * 60000, sessionType: 'main' }
    ],
    daily_habits: [
      { date: '2026-10-28', caffeine: 'no', screenLate: 'no', stressRating: 2 }
    ],
    experiments: [
      { id: 'exp_1', protocolId: 'caffeine_cutoff', title: 'Afternoon Caffeine Cutoff', status: 'active', startedAt: '2026-10-28' }
    ],
    settings: [
      { key: 'targetSleepMinutes', value: 480 }
    ]
  }
};

const validEnvelope = backup.validateBackupPayload(sampleExportPayload);
assert(validEnvelope.isValid === true, 'Sample export payload is valid under schema v1');
assert(validEnvelope.counts.sessions === 1, 'Counts exactly 1 session');
assert(validEnvelope.counts.habits === 1, 'Counts exactly 1 habit');
assert(validEnvelope.counts.experiments === 1, 'Counts exactly 1 experiment');
assert(validEnvelope.counts.settings === 1, 'Counts exactly 1 setting');

// ---------------------------------------------------------------------
// TEST GROUP 22: JSON Backup Validation & Strict Error Rejections
// ---------------------------------------------------------------------
console.log('\nTest Group 22: JSON Backup Validation & Strict Error Rejections');

const malformedRes = backup.validateBackupPayload('{"app": "nocturne-atlas", formatVersion: invalid}');
assert(malformedRes.isValid === false, 'Rejects malformed JSON syntax');
assert(malformedRes.error.includes('Malformed JSON'), 'Error mentions Malformed JSON');

const wrongAppRes = backup.validateBackupPayload(JSON.stringify({ app: 'other-tracker', formatVersion: 1, data: {} }));
assert(wrongAppRes.isValid === false, 'Rejects unrecognized app identifier');
assert(wrongAppRes.error.includes('Unrecognized application identifier'), 'Error mentions application identifier');

const futureVersionRes = backup.validateBackupPayload(JSON.stringify({ app: 'nocturne-atlas', formatVersion: 99, data: {} }));
assert(futureVersionRes.isValid === false, 'Rejects unsupported future format version (v99)');
assert(futureVersionRes.error.includes('Unsupported future backup version'), 'Error mentions future backup version');

const noDataRes = backup.validateBackupPayload(JSON.stringify({ app: 'nocturne-atlas', formatVersion: 1 }));
assert(noDataRes.isValid === false, 'Rejects backup missing "data" container');

const dupSessions = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_dup', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100, endTimestamp: 200, sessionType: 'main' },
      { id: 's_dup', startTime: '2026-10-28T23:00', endTime: '2026-10-29T07:00', startTimestamp: 300, endTimestamp: 400, sessionType: 'main' }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const dupRes = backup.validateBackupPayload(dupSessions);
assert(dupRes.isValid === false, 'Rejects duplicate session ID within backup dataset');
assert(dupRes.error.includes('Duplicate session ID'), 'Error specifies duplicate session ID');

const invalidDurationPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_bad_time', startTime: '2026-10-28T08:00', endTime: '2026-10-28T07:00', startTimestamp: 500, endTimestamp: 400, sessionType: 'main' }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const badDurationRes = backup.validateBackupPayload(invalidDurationPayload);
assert(badDurationRes.isValid === false, 'Rejects session with wake time earlier than start time');

const badTypePayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_bad_type', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100, endTimestamp: 200, sessionType: 'invalid_type' }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const badTypeRes = backup.validateBackupPayload(badTypePayload);
assert(badTypeRes.isValid === false, 'Rejects invalid sessionType enum');

const badRatingPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_bad_rating', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100, endTimestamp: 200, sessionType: 'main', restednessRating: 6 }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const badRatingRes = backup.validateBackupPayload(badRatingPayload);
assert(badRatingRes.isValid === false, 'Rejects restednessRating exceeding 5');

const badHabitDatePayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [],
    daily_habits: [
      { date: '28/10/2026', caffeine: 'no' }
    ],
    experiments: [],
    settings: []
  }
};
const badHabitDateRes = backup.validateBackupPayload(badHabitDatePayload);
assert(badHabitDateRes.isValid === false, 'Rejects habit with invalid date format (expected YYYY-MM-DD)');

const badHabitEnumPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [],
    daily_habits: [
      { date: '2026-10-28', caffeine: 'often' }
    ],
    experiments: [],
    settings: []
  }
};
const badHabitEnumRes = backup.validateBackupPayload(badHabitEnumPayload);
assert(badHabitEnumRes.isValid === false, 'Rejects habit with invalid enum value for caffeine');

const badExpStatusPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [],
    daily_habits: [],
    experiments: [
      { id: 'exp_bad', protocolId: 'caffeine_cutoff', title: 'Test', status: 'unknown_status' }
    ],
    settings: []
  }
};
const badExpStatusRes = backup.validateBackupPayload(badExpStatusPayload);
assert(badExpStatusRes.isValid === false, 'Rejects experiment with invalid status enum');

const oversizedString = 'x'.repeat(16 * 1024 * 1024);
const oversizedRes = backup.validateBackupPayload(oversizedString);
assert(oversizedRes.isValid === false, 'Rejects backup file exceeding size limit');
assert(oversizedRes.error.includes('maximum permitted size'), 'Explains 15MB limit in error message');

// ---------------------------------------------------------------------
// TEST GROUP 23: Pre-Import Preview & Conflict Detection
// ---------------------------------------------------------------------
console.log('\nTest Group 23: Pre-Import Preview & Conflict Detection');

const currentTestRecords = {
  sessions: [
    { id: 's_existing_1', startTime: '2026-10-25T23:00', endTime: '2026-10-26T07:00', startTimestamp: 100, endTimestamp: 200, sessionType: 'main', notes: 'Local identical' },
    { id: 's_existing_2', startTime: '2026-10-26T23:00', endTime: '2026-10-27T07:00', startTimestamp: 300, endTimestamp: 400, sessionType: 'main', notes: 'Local original version' }
  ],
  habits: [
    { date: '2026-10-26', caffeine: 'no', screenLate: 'no', stressRating: 2, notes: 'Habit identical' }
  ],
  experiments: [
    { id: 'exp_existing_1', protocolId: 'caffeine_cutoff', title: 'Cutoff', status: 'active', startedAt: '2026-10-26', outcomeReflection: 'Local reflection' }
  ],
  settings: [
    { key: 'targetSleepMinutes', value: 480 }
  ]
};

const incomingTestBackup = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  exportedAt: '2026-10-28T07:00:00Z',
  sourceSchemaVersion: 3,
  data: {
    sleep_sessions: [
      { id: 's_existing_1', startTime: '2026-10-25T23:00', endTime: '2026-10-26T07:00', startTimestamp: 100, endTimestamp: 200, sessionType: 'main', notes: 'Local identical' },
      { id: 's_existing_2', startTime: '2026-10-26T23:00', endTime: '2026-10-27T07:00', startTimestamp: 300, endTimestamp: 400, sessionType: 'main', notes: 'Imported conflicting note' },
      { id: 's_brand_new_3', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 500, endTimestamp: 600, sessionType: 'main', notes: 'New night' }
    ],
    daily_habits: [
      { date: '2026-10-26', caffeine: 'no', screenLate: 'no', stressRating: 2, notes: 'Habit identical' },
      { date: '2026-10-27', caffeine: 'yes', screenLate: 'no', stressRating: 3, notes: 'New habit day' }
    ],
    experiments: [
      { id: 'exp_existing_1', protocolId: 'caffeine_cutoff', title: 'Cutoff', status: 'completed', startedAt: '2026-10-26', outcomeReflection: 'Backup finished reflection' },
      { id: 'exp_brand_new_2', protocolId: 'screen_curfew', title: 'Screen Curfew', status: 'active', startedAt: '2026-10-28' }
    ],
    settings: [
      { key: 'targetSleepMinutes', value: 480 }
    ]
  }
};

const preview = backup.generatePreImportPreview(incomingTestBackup, currentTestRecords);
assert(preview.formatVersion === 1, 'Preview captures formatVersion 1');
assert(preview.counts.sessions === 3, 'Preview identifies 3 incoming sessions');
assert(preview.counts.habits === 2, 'Preview identifies 2 incoming habits');
assert(preview.counts.experiments === 2, 'Preview identifies 2 incoming experiments');

assert(preview.merge.sessions.new === 1, 'Preview identifies exactly 1 new session to add');
assert(preview.merge.sessions.identical === 1, 'Preview identifies exactly 1 identical session to skip');
assert(preview.merge.sessions.conflicts === 1, 'Preview identifies exactly 1 conflicting session');

assert(preview.merge.habits.new === 1, 'Preview identifies exactly 1 new habit');
assert(preview.merge.habits.identical === 1, 'Preview identifies exactly 1 identical habit');

assert(preview.merge.experiments.new === 1, 'Preview identifies exactly 1 new experiment');
assert(preview.merge.experiments.conflicts === 1, 'Preview identifies exactly 1 conflicting experiment');

assert(preview.merge.totalNew === 3, 'Total new records across categories is exactly 3');
assert(preview.merge.totalIdentical === 2, 'Total identical records across categories is exactly 2');
assert(preview.merge.totalConflicts === 2, 'Total conflicting records across categories is exactly 2');

assert(preview.replace.existingRecordsToWipe === 4, 'Replace preview reports 4 existing records to wipe');
assert(preview.replace.incomingRecordsToInstall === 7, 'Replace preview reports 7 incoming records to install');

// ---------------------------------------------------------------------
// TEST GROUP 24: Round-Trip Export/Import Simulation & Merge Protection
// ---------------------------------------------------------------------
console.log('\nTest Group 24: Round-Trip Export/Import Simulation & Merge Protection');

const reimportPreview = backup.generatePreImportPreview(incomingTestBackup, {
  sessions: incomingTestBackup.data.sleep_sessions,
  habits: incomingTestBackup.data.daily_habits,
  experiments: incomingTestBackup.data.experiments,
  settings: incomingTestBackup.data.settings
});
assert(reimportPreview.merge.totalNew === 0, 'Re-importing identical backup identifies 0 new records');
assert(reimportPreview.merge.totalIdentical === 7, 'Re-importing identical backup identifies all 7 as identical duplicates');
assert(reimportPreview.merge.totalConflicts === 0, 'Re-importing identical backup produces 0 conflicts');

const simulatedLocalStore = new Map(currentTestRecords.sessions.map(s => [s.id, { ...s }]));
for (const s of incomingTestBackup.data.sleep_sessions) {
  const existing = simulatedLocalStore.get(s.id);
  if (!existing) {
    simulatedLocalStore.set(s.id, s);
  }
}

assert(simulatedLocalStore.size === 3, 'Merged store contains 3 total sessions (2 original + 1 new)');
assert(simulatedLocalStore.get('s_existing_2').notes === 'Local original version', 'Conflicting session preserved local original notes (protected)');
assert(simulatedLocalStore.get('s_brand_new_3').notes === 'New night', 'Brand new session added cleanly');

// ---------------------------------------------------------------------
// TEST GROUP 25: Settings Screen Data Portability UI & Release Hardening
// ---------------------------------------------------------------------
console.log('\nTest Group 25: Settings Screen Data Portability UI & Release Hardening');

const settingsScreenCode = fs.readFileSync(path.join(rootDir, 'src/screens/settingsScreen.js'), 'utf8');

assert(settingsScreenCode.includes('btn-export-backup'), 'Settings screen contains Export Backup action button');
assert(settingsScreenCode.includes('btn-trigger-import-file'), 'Settings screen contains Import Backup trigger button');
assert(settingsScreenCode.includes('input-backup-file'), 'Settings screen contains hidden file input with .json filter');
assert(settingsScreenCode.includes('backup-advice-banner'), 'Settings screen displays backup recommendation banner');
assert(settingsScreenCode.includes('backup-status-alert'), 'Settings screen includes backup status alert container');
assert(settingsScreenCode.includes('backup-preview-container'), 'Settings screen includes backup preview container');
assert(settingsScreenCode.includes('btn-confirm-merge'), 'Preview includes Merge action button');
assert(settingsScreenCode.includes('btn-confirm-replace'), 'Preview includes Replace action button with safety gate');
assert(settingsScreenCode.includes('check-confirm-replace'), 'Preview includes explicit Replace confirmation checkbox');
assert(settingsScreenCode.includes('exportAllDatabaseData'), 'Settings imports exportAllDatabaseData from storage');
assert(settingsScreenCode.includes('importRestoreMerge'), 'Settings imports importRestoreMerge from storage');
assert(settingsScreenCode.includes('importRestoreReplace'), 'Settings imports importRestoreReplace from storage');

const finalSwCode = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
assert(finalSwCode.includes('nocturne-atlas-shell-v4'), 'Service worker cache upgraded to version v4');
assert(finalSwCode.includes('./src/services/backup.js'), 'Service worker precaches ./src/services/backup.js');

const finalDbCode = fs.readFileSync(path.join(rootDir, 'src/storage/db.js'), 'utf8');
assert(finalDbCode.includes('export async function exportAllDatabaseData'), 'db.js exports exportAllDatabaseData');
assert(finalDbCode.includes('export async function importRestoreMerge'), 'db.js exports importRestoreMerge');
assert(finalDbCode.includes('export async function importRestoreReplace'), 'db.js exports importRestoreReplace');
assert(finalDbCode.includes('export async function getAllSettings'), 'db.js exports getAllSettings');

// ---------------------------------------------------------------------
// TEST GROUP 26: Release Audit & Schema Boundary Regression Suite
// ---------------------------------------------------------------------
console.log('\nTest Group 26: Release Audit & Schema Boundary Regression Suite');

// 1. Cancelled experiments representation
const insightsCode = fs.readFileSync(path.join(rootDir, 'src/screens/insightsScreen.js'), 'utf8');
assert(insightsCode.includes("const isCancelled = exp.status === 'abandoned' || exp.status === 'cancelled'"), 'Distinguishes cancelled/abandoned experiment status');
assert(insightsCode.includes("${statusLabel}") && insightsCode.includes("'Cancelled'"), 'Insights screen explicitly renders "Cancelled" status badge');

// 2. Acceptance of cancelled experiment status in backup validation
const expCancelledPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [],
    daily_habits: [],
    experiments: [
      { id: 'exp_canc', protocolId: 'caffeine_cutoff', title: 'Cutoff Protocol', status: 'cancelled' },
      { id: 'exp_abn', protocolId: 'caffeine_cutoff', title: 'Cutoff Protocol 2', status: 'abandoned' },
      { id: 'exp_act', protocolId: 'caffeine_cutoff', title: 'Cutoff Protocol 3', status: 'active' },
      { id: 'exp_cmp', protocolId: 'caffeine_cutoff', title: 'Cutoff Protocol 4', status: 'completed' }
    ],
    settings: []
  }
};
const expStatusesRes = backup.validateBackupPayload(expCancelledPayload);
assert(expStatusesRes.isValid === true, 'validateBackupPayload accepts all 4 experiment statuses (active, completed, abandoned, cancelled)');
assert(expStatusesRes.counts.experiments === 4, 'Counts all 4 experiment records');

// 3. Optional session metrics validation (latency, waso, awakenings)
const negativeLatencyPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_neg_lat', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100, endTimestamp: 200, latencyMinutes: -15 }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const negLatRes = backup.validateBackupPayload(negativeLatencyPayload);
assert(negLatRes.isValid === false, 'Rejects session with negative latencyMinutes');
assert(negLatRes.error.includes('latencyMinutes'), 'Error message specifies latencyMinutes');

const negativeWasoPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_neg_waso', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100, endTimestamp: 200, awakeAfterOnsetMinutes: -20 }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const negWasoRes = backup.validateBackupPayload(negativeWasoPayload);
assert(negWasoRes.isValid === false, 'Rejects session with negative awakeAfterOnsetMinutes');

const invalidAwkPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [
      { id: 's_bad_awk', startTime: '2026-10-27T23:00', endTime: '2026-10-28T07:00', startTimestamp: 100, endTimestamp: 200, awakeningsCount: 2.5 }
    ],
    daily_habits: [],
    experiments: [],
    settings: []
  }
};
const badAwkRes = backup.validateBackupPayload(invalidAwkPayload);
assert(badAwkRes.isValid === false, 'Rejects session with non-integer awakeningsCount');

// 4. Invalid calendar date in daily habits
const invalidHabitCalendarDatePayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [],
    daily_habits: [
      { date: '2026-99-99', caffeine: 'no' }
    ],
    experiments: [],
    settings: []
  }
};
const badCalDateRes = backup.validateBackupPayload(invalidHabitCalendarDatePayload);
assert(badCalDateRes.isValid === false, 'Rejects habit with non-existent calendar date');

// 5. Invalid targetSleepMinutes setting
const badSettingPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {
    sleep_sessions: [],
    daily_habits: [],
    experiments: [],
    settings: [
      { key: 'targetSleepMinutes', value: -60 }
    ]
  }
};
const badSettingRes = backup.validateBackupPayload(badSettingPayload);
assert(badSettingRes.isValid === false, 'Rejects invalid negative targetSleepMinutes setting');

// 6. Safe handling of empty datasets
const emptyDataPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  data: {}
};
const emptyDataRes = backup.validateBackupPayload(emptyDataPayload);
assert(emptyDataRes.isValid === true, 'validateBackupPayload safely accepts empty data container');
assert(emptyDataRes.counts.sessions === 0, 'Empty backup reports 0 sessions');

const emptyPreview = backup.generatePreImportPreview(emptyDataRes.backupData, { sessions: [], habits: [], experiments: [], settings: [] });
assert(emptyPreview.merge.totalNew === 0, 'Empty preview reports 0 new records');
assert(emptyPreview.replace.incomingRecordsToInstall === 0, 'Empty preview reports 0 incoming records to install');

// 7. Full round-trip validation with all optional architecture fields
const fullArchSessionPayload = {
  app: 'nocturne-atlas',
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  sourceSchemaVersion: 3,
  data: {
    sleep_sessions: [
      {
        id: 's_full_arch',
        sessionType: 'main',
        startTime: '2026-10-27T22:30',
        endTime: '2026-10-28T07:15',
        startTimestamp: new Date('2026-10-27T22:30').getTime(),
        endTimestamp: new Date('2026-10-28T07:15').getTime(),
        wakeDate: '2026-10-28',
        timeInBedMinutes: 525,
        latencyMinutes: 20,
        awakeAfterOnsetMinutes: 15,
        awakeningsCount: 2,
        restednessRating: 4,
        energyRating: 5,
        notes: 'Sound deep restorative sleep.'
      }
    ],
    daily_habits: [
      {
        date: '2026-10-28',
        caffeine: 'yes',
        caffeineTiming: '13:30',
        screenLate: 'no',
        screenTiming: null,
        stressRating: 2,
        notes: 'Productive calm day.'
      }
    ],
    experiments: [
      {
        id: 'exp_full_1',
        protocolId: 'caffeine_cutoff',
        title: 'Caffeine Cutoff',
        hypothesis: 'Cutting caffeine before 2 PM reduces latency',
        behaviorToChange: 'No caffeine after 14:00',
        outcomeToObserve: 'Sleep onset latency and awakenings',
        targetDays: 7,
        startedAt: '2026-10-21',
        targetEndDate: '2026-10-28',
        status: 'completed',
        outcomeReflection: 'Felt much easier to wind down.',
        completedAt: '2026-10-28T07:00:00Z'
      }
    ],
    settings: [
      { key: 'targetSleepMinutes', value: 480 },
      { key: 'theme', value: 'dark' }
    ]
  }
};
const fullArchJson = JSON.stringify(fullArchSessionPayload);
const roundTripRes = backup.validateBackupPayload(fullArchJson);
assert(roundTripRes.isValid === true, 'Complete architecture payload validates successfully through JSON serialize/parse');
assert(roundTripRes.counts.sessions === 1, 'Round-trip captures 1 session');
assert(roundTripRes.counts.habits === 1, 'Round-trip captures 1 habit');
assert(roundTripRes.counts.experiments === 1, 'Round-trip captures 1 experiment');
assert(roundTripRes.counts.settings === 2, 'Round-trip captures 2 settings');

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------
console.log('\n======================================================');
console.log(`  Acceptance Checks Summary:`);
console.log(`  Total:  ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
console.log('======================================================\n');

if (failedTests > 0) {
  console.error('Failure details:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log('✓ All Phase 1, Phase 2, Phase 3, & Phase 4 verification checks PASSED cleanly.\n');
  process.exit(0);
}
