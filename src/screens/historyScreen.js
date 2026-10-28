// src/screens/historyScreen.js
// Nocturne Atlas - History Screen (Phase 2 Real Sleep Logging Integration)
// Connects to IndexedDB: displays real dynamic calendar matrix with sleep intensity and chronological sessions list.

import { getAllSessions, getAllHabits, getHabit } from '../storage/db.js';
import {
  calculateTimeInBedMinutes,
  calculateEstimatedSleepDuration,
  calculateIntervalUnionMinutes,
  formatMinutes,
  formatLocalTime,
  formatLocalDate
} from '../services/calculations.js';
import { renderEmptyState } from '../components/emptyState.js';
import { openLogModalForEdit, executeDelete, openLogModalForCreate } from '../components/logModal.js';

let viewDate = new Date();
let selectedFilterDate = null;
let activeTypeFilter = 'all'; // 'all' | 'main' | 'nap'

/**
 * Calculates calendar grid metrics for a given year and month (0-indexed).
 * Week starts on Monday (Monday = 0, Sunday = 6).
 */
export function getCalendarGridData(year, month) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDayDow = new Date(year, month, 1).getDay();
  const leadingBlanks = (firstDayDow === 0) ? 6 : firstDayDow - 1;
  const remainder = (leadingBlanks + totalDays) % 7;
  const trailingBlanks = remainder === 0 ? 0 : 7 - remainder;

  return {
    year,
    month,
    totalDays,
    leadingBlanks,
    trailingBlanks,
    totalCells: leadingBlanks + totalDays + trailingBlanks
  };
}

export function setCalendarViewDate(newDate) {
  viewDate = new Date(newDate);
}

export async function renderHistoryScreen() {
  const container = document.getElementById('screen-history');
  if (!container) return;

  const [sessions, habits] = await Promise.all([
    getAllSessions(),
    getAllHabits()
  ]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const gridData = getCalendarGridData(currentYear, currentMonth);

  const today = new Date();
  const isCurrentMonthToday = (
    today.getFullYear() === currentYear &&
    today.getMonth() === currentMonth
  );
  const todayDateNum = today.getDate();

  // Index sessions by wakeDate
  const sessionsByWakeDate = new Map();
  sessions.forEach((s) => {
    const list = sessionsByWakeDate.get(s.wakeDate) || [];
    list.push(s);
    sessionsByWakeDate.set(s.wakeDate, list);
  });

  // Index habits by date
  const habitsByDate = new Map();
  habits.forEach((h) => {
    habitsByDate.set(h.date, h);
  });

  // Build leading blank cells
  const leadingCellsHtml = Array.from({ length: gridData.leadingBlanks }, () => `
    <div class="calendar-day-cell blank-day" role="presentation" aria-hidden="true"></div>
  `).join('');

  // Build real day cells with sleep intensity dots
  const dayCellsHtml = Array.from({ length: gridData.totalDays }, (_, i) => {
    const day = i + 1;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const daySessions = sessionsByWakeDate.get(dateStr) || [];
    const hasSleep = daySessions.length > 0;
    const isToday = isCurrentMonthToday && day === todayDateNum;
    const isSelected = selectedFilterDate === dateStr;

    let dotClass = 'cell-indicator-empty';
    let durationLabel = 'No sleep logged';

    if (hasSleep) {
      const dedupMin = calculateIntervalUnionMinutes(daySessions);
      durationLabel = `${formatMinutes(dedupMin)} sleep`;
      if (dedupMin < 360) {
        dotClass = 'cell-indicator-dot dot-1'; // < 6h
      } else if (dedupMin < 420) {
        dotClass = 'cell-indicator-dot dot-2'; // 6-7h
      } else if (dedupMin <= 480) {
        dotClass = 'cell-indicator-dot dot-3'; // 7-8h (optimal)
      } else {
        dotClass = 'cell-indicator-dot dot-4'; // 8h+
      }
    }

    return `
      <button type="button" class="calendar-day-cell ${hasSleep ? 'has-sleep' : 'empty-day'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}"
        role="gridcell"
        data-date="${dateStr}"
        aria-label="${monthName} ${day}, ${currentYear}: ${durationLabel}">
        <span class="cell-day-num">${day}</span>
        <span class="${dotClass}" aria-hidden="true"></span>
      </button>
    `;
  }).join('');

  // Build trailing blank cells
  const trailingCellsHtml = Array.from({ length: gridData.trailingBlanks }, () => `
    <div class="calendar-day-cell blank-day" role="presentation" aria-hidden="true"></div>
  `).join('');

  // Filter sessions for display list
  let displayedSessions = sessions;
  if (selectedFilterDate) {
    displayedSessions = displayedSessions.filter(s => s.wakeDate === selectedFilterDate);
  }
  if (activeTypeFilter !== 'all') {
    displayedSessions = displayedSessions.filter(s => s.sessionType === activeTypeFilter);
  }

  // Selected date habit information
  const selectedHabit = selectedFilterDate ? habitsByDate.get(selectedFilterDate) : null;

  container.innerHTML = `
    <div class="screen-content">
      <!-- Screen Header -->
      <header class="screen-header">
        <div>
          <span class="subheading-accent">Archives &amp; Records</span>
          <h1 class="screen-title">Sleep History</h1>
        </div>
      </header>

      <!-- 1. Real Dynamic Calendar Matrix -->
      <section class="card section-card" aria-labelledby="section-calendar-title">
        <div class="section-card-header calendar-header-row">
          <div>
            <h2 id="section-calendar-title" class="section-title">Calendar Matrix</h2>
            <p class="section-subtitle">${monthName} ${currentYear} — Tap any date to view recorded sessions.</p>
          </div>
          <div class="calendar-nav-toolbar" role="toolbar" aria-label="Calendar month navigation">
            <button type="button" class="btn btn-secondary btn-sm" id="cal-prev-month" aria-label="Previous month" title="Previous month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="cal-today-btn" aria-label="Go to current month" title="Current month">
              Today
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="cal-next-month" aria-label="Next month" title="Next month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <div class="calendar-heatmap-container" role="grid" aria-label="${monthName} ${currentYear} sleep calendar matrix">
          <div class="calendar-weekday-headers" role="row">
            <span role="columnheader" aria-label="Monday">Mon</span>
            <span role="columnheader" aria-label="Tuesday">Tue</span>
            <span role="columnheader" aria-label="Wednesday">Wed</span>
            <span role="columnheader" aria-label="Thursday">Thu</span>
            <span role="columnheader" aria-label="Friday">Fri</span>
            <span role="columnheader" aria-label="Saturday">Sat</span>
            <span role="columnheader" aria-label="Sunday">Sun</span>
          </div>
          <div class="calendar-days-grid" role="presentation">
            ${leadingCellsHtml}
            ${dayCellsHtml}
            ${trailingCellsHtml}
          </div>
        </div>

        <div class="heatmap-legend">
          <span class="legend-scale-title">Intensity:</span>
          <span class="scale-dot dot-0" title="No entry"></span>
          <span class="scale-dot dot-1" title="&lt; 6 hours"></span>
          <span class="scale-dot dot-2" title="6–7 hours"></span>
          <span class="scale-dot dot-3" title="7–8 hours (Optimal)"></span>
          <span class="scale-dot dot-4" title="8+ hours"></span>
        </div>
      </section>

      <!-- Selected Date Habits Card (if date filtered) -->
      ${selectedFilterDate && selectedHabit ? `
        <section class="card section-card selected-habit-card">
          <div class="section-card-header">
            <div>
              <h3 class="section-title">Habits for ${selectedFilterDate}</h3>
              <p class="section-subtitle">Observed daytime factors and conditions</p>
            </div>
            <span class="badge badge-mint">Habit Record</span>
          </div>
          <div class="habit-chips-row">
            <span class="habit-chip">☕ Caffeine: <strong>${selectedHabit.caffeine}</strong> ${selectedHabit.caffeineTiming ? `(${selectedHabit.caffeineTiming})` : ''}</span>
            <span class="habit-chip">📱 Late Screen: <strong>${selectedHabit.screenLate}</strong> ${selectedHabit.screenTiming ? `(${selectedHabit.screenTiming}m)` : ''}</span>
            <span class="habit-chip">⚡ Stress: <strong>${selectedHabit.stressRating ? selectedHabit.stressRating + '/5' : 'Not recorded'}</strong></span>
          </div>
        </section>
      ` : ''}

      <!-- 2. Real Chronological Session List Section -->
      <section class="section-container" aria-labelledby="section-sessions-title">
        <div class="section-heading-row history-controls-row">
          <div>
            <h2 id="section-sessions-title" class="section-title">All Sleep Sessions</h2>
            ${selectedFilterDate ? `
              <span class="filter-indicator-badge">
                Filtering by date: ${selectedFilterDate}
                <button type="button" class="btn-clear-filter" id="btn-clear-date-filter" aria-label="Clear date filter">×</button>
              </span>
            ` : `
              <span class="section-meta">${sessions.length} total records in database</span>
            `}
          </div>

          <div class="history-type-filter-group" role="group" aria-label="Filter sessions by type">
            <button type="button" class="filter-pill ${activeTypeFilter === 'all' ? 'active' : ''}" data-type="all">All</button>
            <button type="button" class="filter-pill ${activeTypeFilter === 'main' ? 'active' : ''}" data-type="main">Main Sleep</button>
            <button type="button" class="filter-pill ${activeTypeFilter === 'nap' ? 'active' : ''}" data-type="nap">Naps</button>
          </div>
        </div>

        ${displayedSessions.length === 0 ? renderEmptyState({
          title: selectedFilterDate ? `No sessions on ${selectedFilterDate}` : 'No historical records found',
          description: selectedFilterDate ? 'No sleep entries are attributed to this wake-up date.' : 'Every night you log will be stored safely in your device’s local IndexedDB and listed here with duration, quality rating, and notes.',
          badge: selectedFilterDate ? 'Filter active' : 'Local storage empty',
          actionLabel: '+ Log Sleep Session',
          actionId: 'btn-history-log-sleep',
          icon: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          `
        }) : `
          <div class="sessions-list-container">
            ${displayedSessions.map(session => renderHistorySessionCard(session)).join('')}
          </div>
        `}
      </section>
    </div>
  `;

  // Bind History interactions
  bindHistoryInteractions(container);
}

function renderHistorySessionCard(session) {
  const startStr = formatLocalTime(session.startTimestamp || session.startTime);
  const endStr = formatLocalTime(session.endTimestamp || session.endTime);
  const tibFormatted = formatMinutes(session.timeInBedMinutes || calculateTimeInBedMinutes(session.startTimestamp, session.endTimestamp));
  const est = calculateEstimatedSleepDuration(session);
  const typeLabel = session.sessionType === 'nap' ? 'Daylight Nap' : session.sessionType === 'other' ? 'Other Sleep' : 'Main Sleep';
  const typeBadgeClass = session.sessionType === 'nap' ? 'badge-mint' : 'badge-lilac';

  return `
    <article class="session-card" data-session-id="${escapeHtml(session.id)}">
      <div class="session-card-header">
        <div class="session-type-group">
          <span class="badge ${typeBadgeClass}">${escapeHtml(typeLabel)}</span>
          <span class="session-wake-date font-mono">Wake Date: ${escapeHtml(session.wakeDate)}</span>
        </div>
        <div class="session-actions-menu">
          <button type="button" class="btn btn-secondary btn-sm btn-edit-session" data-action="edit" data-id="${escapeHtml(session.id)}">
            Edit
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-delete-session" data-action="delete" data-id="${escapeHtml(session.id)}" aria-label="Delete session">
            Delete
          </button>
        </div>
      </div>

      <div class="session-time-row">
        <span class="session-time-interval font-mono">${startStr} → ${endStr}</span>
        <span class="session-tib-pill">${tibFormatted} in bed</span>
      </div>

      <div class="session-metrics-line">
        <span class="metric-tag"><strong>Est. Sleep:</strong> ${est.hasEstimate ? est.formatted : 'Unmeasured (no latency)'}</span>
        ${session.latencyMinutes !== null && session.latencyMinutes !== undefined ? `
          <span class="metric-tag"><strong>Latency:</strong> ${session.latencyMinutes}m</span>
        ` : ''}
        ${session.awakeAfterOnsetMinutes !== null && session.awakeAfterOnsetMinutes !== undefined ? `
          <span class="metric-tag"><strong>WASO:</strong> ${session.awakeAfterOnsetMinutes}m</span>
        ` : ''}
        ${session.awakeningsCount !== null && session.awakeningsCount !== undefined ? `
          <span class="metric-tag"><strong>Awakenings:</strong> ${session.awakeningsCount}</span>
        ` : ''}
        ${session.restednessRating ? `
          <span class="metric-tag"><strong>Rested:</strong> ${session.restednessRating}/5</span>
        ` : ''}
        ${session.energyRating ? `
          <span class="metric-tag"><strong>Energy:</strong> ${session.energyRating}/5</span>
        ` : ''}
      </div>

      ${session.notes ? `
        <p class="session-notes-snippet">"${escapeHtml(session.notes)}"</p>
      ` : ''}
    </article>
  `;
}

function bindHistoryInteractions(container) {
  // Calendar month navigation
  const prevBtn = container.querySelector('#cal-prev-month');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      renderHistoryScreen();
    });
  }

  const nextBtn = container.querySelector('#cal-next-month');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      renderHistoryScreen();
    });
  }

  const todayBtn = container.querySelector('#cal-today-btn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      viewDate = new Date();
      selectedFilterDate = null;
      renderHistoryScreen();
    });
  }

  // Day cell clicks to filter by date
  container.querySelectorAll('.calendar-day-cell[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const clickedDate = btn.getAttribute('data-date');
      selectedFilterDate = selectedFilterDate === clickedDate ? null : clickedDate;
      renderHistoryScreen();
    });
  });

  // Clear date filter button
  const clearFilterBtn = container.querySelector('#btn-clear-date-filter');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      selectedFilterDate = null;
      renderHistoryScreen();
    });
  }

  // Type filter pills
  container.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      activeTypeFilter = pill.getAttribute('data-type');
      renderHistoryScreen();
    });
  });

  // Empty state button
  const emptyLogBtn = container.querySelector('#btn-history-log-sleep');
  if (emptyLogBtn) {
    emptyLogBtn.addEventListener('click', () => {
      openLogModalForCreate(selectedFilterDate);
    });
  }

  // Edit buttons
  container.querySelectorAll('.btn-edit-session').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const session = await import('../storage/db.js').then(m => m.getSessionById(id));
      if (session) {
        openLogModalForEdit(session);
      }
    });
  });

  // Delete buttons
  container.querySelectorAll('.btn-delete-session').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const confirmed = window.confirm('Are you sure you want to delete this sleep session?');
      if (confirmed) {
        await executeDelete(id, null);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
