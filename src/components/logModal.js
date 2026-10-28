// src/components/logModal.js
// Nocturne Atlas - Dedicated Log Sleep Journal Dialog (Phase 2 Real Sleep Logging)
// Handles creation, editing, deletion with undo, overlap warnings, and habit logging.

import {
  addSession,
  updateSession,
  deleteSession,
  getAllSessions,
  getHabit,
  saveHabit
} from '../storage/db.js';
import {
  calculateTimeInBedMinutes,
  calculateEstimatedSleepDuration,
  validateSessionData,
  findOverlappingSessions,
  formatLocalDate,
  formatMinutes
} from '../services/calculations.js';

let activeEditingId = null;
let isFormDirty = false;
let recentlyDeletedSession = null;
let undoTimeoutId = null;

export function initLogSleepModal() {
  const dialog = document.getElementById('log-sleep-dialog');
  if (!dialog) return;

  const form = dialog.querySelector('#log-sleep-form');
  const openTriggers = document.querySelectorAll('[data-action="open-log-modal"]');
  const closeTriggers = dialog.querySelectorAll('[data-action="close-log-modal"]');
  const deleteBtn = dialog.querySelector('#log-btn-delete');

  // Open modal in Create mode
  openTriggers.forEach((btn) => {
    btn.addEventListener('click', () => {
      openLogModalForCreate();
    });
  });

  // Close triggers with unsaved changes guard
  closeTriggers.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleCloseRequest(dialog);
    });
  });

  // Native cancel event (Escape key) guard
  dialog.addEventListener('cancel', (e) => {
    if (isFormDirty) {
      e.preventDefault();
      handleCloseRequest(dialog);
    }
  });

  // Backdrop click guard
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      handleCloseRequest(dialog);
    }
  });

  // Mark form as dirty when user edits any field
  form.addEventListener('input', () => {
    isFormDirty = true;
    updateLivePreviewAndOverlaps(dialog);
  });

  // Form submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit(dialog);
  });

  // Delete button in edit mode
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!activeEditingId) return;
      const confirmed = window.confirm(
        'Are you sure you want to delete this sleep session? You can undo this action immediately after deletion.'
      );
      if (confirmed) {
        await executeDelete(activeEditingId, dialog);
      }
    });
  }
}

/**
 * Open modal in Create mode
 */
export function openLogModalForCreate(targetDate) {
  const dialog = document.getElementById('log-sleep-dialog');
  if (!dialog) return;

  activeEditingId = null;
  isFormDirty = false;

  // Update modal header & buttons
  const title = dialog.querySelector('#dialog-log-sleep-title');
  const badge = dialog.querySelector('#dialog-log-sleep-badge');
  const submitBtn = dialog.querySelector('#log-btn-submit');
  const deleteBtn = dialog.querySelector('#log-btn-delete');
  const idInput = dialog.querySelector('#log-session-id');

  if (title) title.textContent = 'Log Sleep Session';
  if (badge) badge.textContent = 'Sleep Journal';
  if (submitBtn) submitBtn.textContent = 'Save Session';
  if (deleteBtn) deleteBtn.hidden = true;
  if (idInput) idInput.value = '';

  // Clear errors & alerts
  clearFormAlerts(dialog);

  // Populate sensible default times
  populateDefaultTimes(targetDate);

  // Reset ratings & habits
  resetFormFields(dialog);

  // Update preview
  updateLivePreviewAndOverlaps(dialog);

  openDialog(dialog);
}

/**
 * Open modal in Edit mode
 */
export async function openLogModalForEdit(session) {
  const dialog = document.getElementById('log-sleep-dialog');
  if (!dialog || !session) return;

  activeEditingId = session.id;
  isFormDirty = false;

  // Update modal header & buttons
  const title = dialog.querySelector('#dialog-log-sleep-title');
  const badge = dialog.querySelector('#dialog-log-sleep-badge');
  const submitBtn = dialog.querySelector('#log-btn-submit');
  const deleteBtn = dialog.querySelector('#log-btn-delete');
  const idInput = dialog.querySelector('#log-session-id');

  if (title) title.textContent = 'Edit Sleep Session';
  if (badge) badge.textContent = 'Editing Record';
  if (submitBtn) submitBtn.textContent = 'Update Session';
  if (deleteBtn) deleteBtn.hidden = false;
  if (idInput) idInput.value = session.id;

  clearFormAlerts(dialog);

  // Populate session fields
  const typeSelect = dialog.querySelector('#log-session-type');
  const startInput = dialog.querySelector('#log-start-time');
  const endInput = dialog.querySelector('#log-end-time');
  const latencyInput = dialog.querySelector('#log-latency');
  const wasoInput = dialog.querySelector('#log-waso');
  const awkInput = dialog.querySelector('#log-awakenings');
  const notesInput = dialog.querySelector('#log-notes');

  if (typeSelect) typeSelect.value = session.sessionType || 'main';
  if (startInput) startInput.value = formatDateTimeLocal(session.startTime);
  if (endInput) endInput.value = formatDateTimeLocal(session.endTime);
  if (latencyInput) latencyInput.value = session.latencyMinutes !== null && session.latencyMinutes !== undefined ? session.latencyMinutes : '';
  if (wasoInput) wasoInput.value = session.awakeAfterOnsetMinutes !== null && session.awakeAfterOnsetMinutes !== undefined ? session.awakeAfterOnsetMinutes : '';
  if (awkInput) awkInput.value = session.awakeningsCount !== null && session.awakeningsCount !== undefined ? session.awakeningsCount : '';
  if (notesInput) notesInput.value = session.notes || '';

  // Restedness radio
  const restednessRadio = dialog.querySelector(`input[name="log-restedness"][value="${session.restednessRating}"]`);
  if (restednessRadio) restednessRadio.checked = true;
  else dialog.querySelectorAll('input[name="log-restedness"]').forEach(r => r.checked = false);

  // Energy radio
  const energyRadio = dialog.querySelector(`input[name="log-energy"][value="${session.energyRating}"]`);
  if (energyRadio) energyRadio.checked = true;
  else dialog.querySelectorAll('input[name="log-energy"]').forEach(r => r.checked = false);

  // Load associated habits for this session's wakeDate
  const wakeDate = session.wakeDate || formatLocalDate(new Date(session.endTime));
  try {
    const habit = await getHabit(wakeDate);
    populateHabitFields(dialog, habit);
  } catch (err) {
    console.warn('[LogModal] Failed to load habit for date:', err);
  }

  updateLivePreviewAndOverlaps(dialog);
  openDialog(dialog);
}

/**
 * Handle form submission
 */
async function handleFormSubmit(dialog) {
  const form = dialog.querySelector('#log-sleep-form');
  const submitBtn = dialog.querySelector('#log-btn-submit');
  const errorBanner = dialog.querySelector('#log-form-error-summary');
  const errorList = dialog.querySelector('#log-error-list');

  // Collect form inputs
  const rawData = {
    sessionType: form.querySelector('#log-session-type').value,
    startTime: form.querySelector('#log-start-time').value,
    endTime: form.querySelector('#log-end-time').value,
    latencyMinutes: form.querySelector('#log-latency').value,
    awakeAfterOnsetMinutes: form.querySelector('#log-waso').value,
    awakeningsCount: form.querySelector('#log-awakenings').value,
    notes: form.querySelector('#log-notes').value,
    restednessRating: form.querySelector('input[name="log-restedness"]:checked')?.value || null,
    energyRating: form.querySelector('input[name="log-energy"]:checked')?.value || null
  };

  // 1. Validate inputs
  const validation = validateSessionData(rawData);
  clearFieldErrors(dialog);

  if (!validation.isValid) {
    errorBanner.hidden = false;
    errorList.innerHTML = Object.values(validation.errors).map(msg => `<li>${escapeHtml(msg)}</li>`).join('');
    // Highlight first error field
    const firstFieldKey = Object.keys(validation.errors)[0];
    const fieldInput = form.querySelector(`#log-${firstFieldKey}`) || form.querySelector(`[name="log-${firstFieldKey}"]`);
    if (fieldInput) fieldInput.focus();
    return;
  }

  // 2. Overlap Verification
  const candidateSession = {
    id: activeEditingId,
    startTimestamp: validation.sanitized.startTimestamp,
    endTimestamp: validation.sanitized.endTimestamp
  };

  const allSessions = await getAllSessions();
  const overlaps = findOverlappingSessions(candidateSession, allSessions);
  const overlapConfirmCheckbox = dialog.querySelector('#log-overlap-confirm-checkbox');

  if (overlaps.length > 0 && !overlapConfirmCheckbox.checked) {
    const overlapAlert = dialog.querySelector('#log-form-overlap-alert');
    const overlapDesc = dialog.querySelector('#log-overlap-description');
    overlapAlert.hidden = false;

    const conflict = overlaps[0];
    const sType = conflict.session.sessionType || 'session';
    overlapDesc.innerHTML = `This record overlaps with an existing <strong>${escapeHtml(sType)}</strong> (${conflict.overlapStartFormatted} – ${conflict.overlapEndFormatted}, overlap: <strong>${conflict.overlapMinutes} min</strong>). Check the confirmation box below to save anyway.`;
    overlapConfirmCheckbox.focus();
    return;
  }

  // 3. Save Session
  submitBtn.disabled = true;
  try {
    let savedSession = null;
    if (activeEditingId) {
      savedSession = await updateSession({
        ...validation.sanitized,
        id: activeEditingId
      });
      showToast('Sleep session updated successfully.');
    } else {
      savedSession = await addSession(validation.sanitized);
      showToast('Sleep session recorded successfully.');
    }

    // 4. Save Habit Record for the wakeDate
    const habitData = {
      date: savedSession.wakeDate,
      caffeine: form.querySelector('input[name="habit-caffeine"]:checked')?.value || 'not_recorded',
      caffeineTiming: form.querySelector('#habit-caffeine-time')?.value || null,
      screenLate: form.querySelector('input[name="habit-screen"]:checked')?.value || 'not_recorded',
      screenTiming: form.querySelector('#habit-screen-timing')?.value ? Number(form.querySelector('#habit-screen-timing').value) : null,
      stressRating: form.querySelector('input[name="habit-stress"]:checked')?.value !== 'not_recorded'
        ? Number(form.querySelector('input[name="habit-stress"]:checked')?.value)
        : null
    };
    await saveHabit(habitData);

    // Reset dirty flag and close
    isFormDirty = false;
    closeDialog(dialog);

    // Dispatch global data change event so screens update reactively
    window.dispatchEvent(new CustomEvent('nocturne-data-changed', {
      detail: { action: activeEditingId ? 'update' : 'create', sessionId: savedSession.id }
    }));
  } catch (err) {
    console.error('[LogModal] Save error:', err);
    errorBanner.hidden = false;
    errorList.innerHTML = `<li>Failed to save record: ${escapeHtml(err.message)}</li>`;
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Execute session deletion with Undo capability
 */
export async function executeDelete(sessionId, dialog) {
  try {
    const sessionToDelete = await import('../storage/db.js').then(m => m.getSessionById(sessionId));
    await deleteSession(sessionId);

    isFormDirty = false;
    if (dialog) closeDialog(dialog);

    // Notify screens
    window.dispatchEvent(new CustomEvent('nocturne-data-changed', {
      detail: { action: 'delete', sessionId }
    }));

    // Offer undo toast
    if (sessionToDelete) {
      recentlyDeletedSession = sessionToDelete;
      showToastWithUndo('Sleep session deleted.', async () => {
        try {
          await addSession(recentlyDeletedSession);
          recentlyDeletedSession = null;
          showToast('Session restored.');
          window.dispatchEvent(new CustomEvent('nocturne-data-changed', {
            detail: { action: 'restore', sessionId }
          }));
        } catch (err) {
          showToast('Could not restore session: ' + err.message);
        }
      });
    }
  } catch (err) {
    console.error('[LogModal] Delete failed:', err);
    alert('Failed to delete session: ' + err.message);
  }
}

/**
 * Dynamic live duration preview & overlap indicator
 */
async function updateLivePreviewAndOverlaps(dialog) {
  const startVal = dialog.querySelector('#log-start-time')?.value;
  const endVal = dialog.querySelector('#log-end-time')?.value;
  const latencyVal = dialog.querySelector('#log-latency')?.value;
  const wasoVal = dialog.querySelector('#log-waso')?.value;

  const wakeDateEl = dialog.querySelector('#preview-wake-date');
  const tibEl = dialog.querySelector('#preview-tib');
  const estSleepEl = dialog.querySelector('#preview-est-sleep');
  const overlapAlert = dialog.querySelector('#log-form-overlap-alert');
  const overlapDesc = dialog.querySelector('#log-overlap-description');

  if (!startVal || !endVal) {
    if (wakeDateEl) wakeDateEl.textContent = '--';
    if (tibEl) tibEl.textContent = '--';
    if (estSleepEl) estSleepEl.textContent = '--';
    return;
  }

  const startMs = new Date(startVal).getTime();
  const endMs = new Date(endVal).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    if (wakeDateEl) wakeDateEl.textContent = 'Invalid times';
    if (tibEl) tibEl.textContent = '--';
    if (estSleepEl) estSleepEl.textContent = '--';
    return;
  }

  const wakeDate = formatLocalDate(new Date(endMs));
  const tibMin = calculateTimeInBedMinutes(startMs, endMs);
  const sleepCalc = calculateEstimatedSleepDuration({
    timeInBedMinutes: tibMin,
    latencyMinutes: latencyVal,
    awakeAfterOnsetMinutes: wasoVal
  });

  if (wakeDateEl) wakeDateEl.textContent = wakeDate;
  if (tibEl) tibEl.textContent = formatMinutes(tibMin);
  if (estSleepEl) estSleepEl.textContent = sleepCalc.formatted;

  // Check overlaps live
  try {
    const all = await getAllSessions();
    const overlaps = findOverlappingSessions({
      id: activeEditingId,
      startTimestamp: startMs,
      endTimestamp: endMs
    }, all);

    if (overlaps.length > 0) {
      overlapAlert.hidden = false;
      const conflict = overlaps[0];
      const sType = conflict.session.sessionType || 'session';
      overlapDesc.innerHTML = `This record overlaps with an existing <strong>${escapeHtml(sType)}</strong> (${conflict.overlapStartFormatted} – ${conflict.overlapEndFormatted}, overlap: <strong>${conflict.overlapMinutes} min</strong>).`;
    } else {
      overlapAlert.hidden = true;
    }
  } catch (e) {
    console.warn('[LogModal] Overlap check error:', e);
  }
}

function handleCloseRequest(dialog) {
  if (isFormDirty) {
    const discard = window.confirm('Discard unsaved changes in this session form?');
    if (!discard) return;
  }
  isFormDirty = false;
  closeDialog(dialog);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  const firstInput = dialog.querySelector('#log-start-time');
  if (firstInput) firstInput.focus();
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function clearFormAlerts(dialog) {
  const errBanner = dialog.querySelector('#log-form-error-summary');
  const overlapAlert = dialog.querySelector('#log-form-overlap-alert');
  const overlapCheckbox = dialog.querySelector('#log-overlap-confirm-checkbox');

  if (errBanner) errBanner.hidden = true;
  if (overlapAlert) overlapAlert.hidden = true;
  if (overlapCheckbox) overlapCheckbox.checked = false;
}

function clearFieldErrors(dialog) {
  dialog.querySelectorAll('.field-error-msg').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });
}

function populateDefaultTimes(targetDate) {
  const startInput = document.getElementById('log-start-time');
  const endInput = document.getElementById('log-end-time');
  if (!startInput || !endInput) return;

  const baseDate = targetDate ? new Date(targetDate) : new Date();
  const baseDateStr = formatLocalDate(baseDate);

  // Default: End time is 07:00 on base date
  endInput.value = `${baseDateStr}T07:00`;

  // Default: Start time is 23:00 previous day
  const previousDay = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
  const prevStr = formatLocalDate(previousDay);
  startInput.value = `${prevStr}T23:00`;
}

function resetFormFields(dialog) {
  const typeSelect = dialog.querySelector('#log-session-type');
  const latencyInput = dialog.querySelector('#log-latency');
  const wasoInput = dialog.querySelector('#log-waso');
  const awkInput = dialog.querySelector('#log-awakenings');
  const notesInput = dialog.querySelector('#log-notes');

  if (typeSelect) typeSelect.value = 'main';
  if (latencyInput) latencyInput.value = '';
  if (wasoInput) wasoInput.value = '';
  if (awkInput) awkInput.value = '';
  if (notesInput) notesInput.value = '';

  dialog.querySelectorAll('input[name="log-restedness"]').forEach(r => r.checked = false);
  dialog.querySelectorAll('input[name="log-energy"]').forEach(r => r.checked = false);

  // Habits reset
  dialog.querySelectorAll('input[name="habit-caffeine"][value="not_recorded"]').forEach(r => r.checked = true);
  const cafTime = dialog.querySelector('#habit-caffeine-time');
  if (cafTime) cafTime.value = '';

  dialog.querySelectorAll('input[name="habit-screen"][value="not_recorded"]').forEach(r => r.checked = true);
  const scrTiming = dialog.querySelector('#habit-screen-timing');
  if (scrTiming) scrTiming.value = '';

  dialog.querySelectorAll('input[name="habit-stress"][value="not_recorded"]').forEach(r => r.checked = true);
}

function populateHabitFields(dialog, habit) {
  if (!habit) {
    resetHabitFieldsOnly(dialog);
    return;
  }
  const cafVal = habit.caffeine || 'not_recorded';
  const cafRadio = dialog.querySelector(`input[name="habit-caffeine"][value="${cafVal}"]`);
  if (cafRadio) cafRadio.checked = true;
  const cafTime = dialog.querySelector('#habit-caffeine-time');
  if (cafTime) cafTime.value = habit.caffeineTiming || '';

  const scrVal = habit.screenLate || 'not_recorded';
  const scrRadio = dialog.querySelector(`input[name="habit-screen"][value="${scrVal}"]`);
  if (scrRadio) scrRadio.checked = true;
  const scrTiming = dialog.querySelector('#habit-screen-timing');
  if (scrTiming) scrTiming.value = habit.screenTiming !== null && habit.screenTiming !== undefined ? habit.screenTiming : '';

  const stressVal = habit.stressRating !== null && habit.stressRating !== undefined ? String(habit.stressRating) : 'not_recorded';
  const stressRadio = dialog.querySelector(`input[name="habit-stress"][value="${stressVal}"]`);
  if (stressRadio) stressRadio.checked = true;
}

function resetHabitFieldsOnly(dialog) {
  dialog.querySelectorAll('input[name="habit-caffeine"][value="not_recorded"]').forEach(r => r.checked = true);
  dialog.querySelectorAll('input[name="habit-screen"][value="not_recorded"]').forEach(r => r.checked = true);
  dialog.querySelectorAll('input[name="habit-stress"][value="not_recorded"]').forEach(r => r.checked = true);
  const cafTime = dialog.querySelector('#habit-caffeine-time');
  if (cafTime) cafTime.value = '';
  const scrTiming = dialog.querySelector('#habit-screen-timing');
  if (scrTiming) scrTiming.value = '';
}

function formatDateTimeLocal(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

export function showToastWithUndo(message, onUndo) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (undoTimeoutId) clearTimeout(undoTimeoutId);

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" class="toast-btn-undo" id="btn-toast-undo">Undo</button>
  `;
  container.appendChild(toast);

  const undoBtn = toast.querySelector('#btn-toast-undo');
  undoBtn.addEventListener('click', () => {
    toast.remove();
    if (onUndo) onUndo();
  });

  undoTimeoutId = setTimeout(() => {
    toast.remove();
  }, 8000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
