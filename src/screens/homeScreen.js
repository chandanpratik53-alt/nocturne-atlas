// src/screens/homeScreen.js
// Nocturne Atlas - Home Screen (Phase 2 Real Sleep Logging Integration)
// Connects to IndexedDB: displays real 24h sleep map, metrics, 7-day preview, and recent sessions.

import { getAllSessions, getTargetSleepMinutes } from '../storage/db.js';
import {
  calculateTimeInBedMinutes,
  calculateEstimatedSleepDuration,
  calculateSleepEfficiency,
  calculateIntervalUnionMinutes,
  aggregateWakeDateSessions,
  formatMinutes,
  formatLocalTime,
  formatLocalDate
} from '../services/calculations.js';
import { renderEmptyState } from '../components/emptyState.js';
import { openLogModalForEdit, executeDelete, openLogModalForCreate } from '../components/logModal.js';

export async function renderHomeScreen() {
  const container = document.getElementById('screen-home');
  if (!container) return;

  const [sessions, targetSleepMinutes] = await Promise.all([
    getAllSessions(),
    getTargetSleepMinutes()
  ]);

  const hasSessions = sessions.length > 0;
  const latestSession = hasSessions ? sessions[0] : null;

  // Compute metrics for the latest session if available
  let latestTibMin = 0;
  let latestEst = { hasEstimate: false, formatted: '--', assumption: 'No session logged.' };
  let latestEff = { hasEfficiency: false, formatted: '--%', label: 'Unavailable' };
  let latestWakeDateSummary = null;

  if (latestSession) {
    latestTibMin = latestSession.timeInBedMinutes || calculateTimeInBedMinutes(latestSession.startTimestamp, latestSession.endTimestamp);
    latestEst = calculateEstimatedSleepDuration(latestSession);
    latestEff = calculateSleepEfficiency(latestTibMin, latestEst.estimatedMinutes);
    latestWakeDateSummary = aggregateWakeDateSessions(sessions, latestSession.wakeDate);
  }

  // 7-day rolling window dates (past 6 days + today)
  const today = new Date();
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = formatLocalDate(d);
    const dayName = d.toLocaleDateString('default', { weekday: 'short' });
    const dayDedupMinutes = calculateIntervalUnionMinutes(sessions.filter(s => s.wakeDate === dateStr));
    weekDays.push({
      dateStr,
      dayName,
      minutes: dayDedupMinutes,
      formatted: dayDedupMinutes > 0 ? formatMinutes(dayDedupMinutes) : '--',
      hasSleep: dayDedupMinutes > 0
    });
  }

  // 24-Hour Map Sessions for latest wake date
  const dialSessions = latestSession
    ? sessions.filter(s => s.wakeDate === latestSession.wakeDate)
    : [];

  container.innerHTML = `
    <div class="screen-content">
      <!-- Screen Header -->
      <header class="screen-header">
        <div>
          <span class="subheading-accent">Daily Sleep Overview</span>
          <h1 class="screen-title">Sleep Map &amp; Rhythm</h1>
        </div>
        <button type="button" class="btn btn-primary btn-sm header-action-btn" data-action="open-log-modal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Log Sleep</span>
        </button>
      </header>

      <!-- 1. 24-Hour Sleep Map -->
      <section class="card section-card" aria-labelledby="section-sleep-map-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-sleep-map-title" class="section-title">24-Hour Sleep Map</h2>
            <p class="section-subtitle">
              ${latestSession ? `Circadian positioning for wake date: ${latestSession.wakeDate}` : 'Visual circadian positioning of sleep, naps, and wake windows.'}
            </p>
          </div>
          <span class="badge ${hasSessions ? 'badge-mint' : 'badge-subtle'}">
            ${hasSessions ? `${dialSessions.length} Session${dialSessions.length > 1 ? 's' : ''}` : 'Circadian Dial'}
          </span>
        </div>

        <div class="sleep-map-placeholder" role="img" aria-label="24-hour circular sleep map dial">
          <div class="dial-visual">
            <div class="dial-ring"></div>
            ${renderDialSvg(dialSessions)}
            <div class="dial-center-label">
              <span class="dial-time-indicator">${hasSessions ? formatMinutes(latestWakeDateSummary.deduplicatedMinutes) : '24h Cycle'}</span>
              <span class="dial-subtext">${hasSessions ? 'Attributed Sleep' : 'No session recorded'}</span>
            </div>
            <!-- 24-hour markers -->
            <span class="dial-marker marker-0">00:00</span>
            <span class="dial-marker marker-6">06:00</span>
            <span class="dial-marker marker-12">12:00</span>
            <span class="dial-marker marker-18">18:00</span>
          </div>
          <div class="dial-legend">
            <span class="legend-item"><span class="legend-swatch swatch-night"></span> Main Sleep</span>
            <span class="legend-item"><span class="legend-swatch swatch-nap"></span> Daylight Nap</span>
            <span class="legend-item"><span class="legend-swatch swatch-wake"></span> Wake Window</span>
          </div>
        </div>
      </section>

      <!-- 2. Key Metrics -->
      <section class="section-container" aria-labelledby="section-metrics-title">
        <div class="section-heading-row">
          <h2 id="section-metrics-title" class="section-title">Key Sleep Indicators</h2>
          <span class="section-meta">Latest logged record</span>
        </div>

        <div class="metrics-grid">
          <!-- Metric 1: Time in Bed -->
          <div class="metric-card">
            <div class="metric-label">Time in Bed (TIB)</div>
            <div class="metric-value">${hasSessions ? formatMinutes(latestTibMin) : '--'}</div>
            <div class="metric-footing" title="${escapeHtml(latestEst.assumption)}">
              ${latestEst.hasEstimate ? `Est. Sleep: ${latestEst.formatted}` : 'Est: unmeasured (no latency)'}
            </div>
          </div>

          <!-- Metric 2: Sleep Efficiency -->
          <div class="metric-card">
            <div class="metric-label">Sleep Efficiency</div>
            <div class="metric-value">${latestEff.formatted}</div>
            <div class="metric-footing">
              ${latestEff.hasEfficiency ? 'Est. Time Asleep vs Bed' : 'Requires latency input'}
            </div>
          </div>

          <!-- Metric 3: Wake-Date Total (Deduplicated) -->
          <div class="metric-card">
            <div class="metric-label">Day Total (Dedup)</div>
            <div class="metric-value">${hasSessions ? formatMinutes(latestWakeDateSummary.deduplicatedMinutes) : '--'}</div>
            <div class="metric-footing">
              ${latestWakeDateSummary && latestWakeDateSummary.hasOverlap ? '⚠️ Overlap deduplicated' : 'Interval-union total'}
            </div>
          </div>

          <!-- Metric 4: Configurable Target Preference -->
          <div class="metric-card">
            <div class="metric-label">Sleep Target</div>
            <div class="metric-value">${formatMinutes(targetSleepMinutes)}</div>
            <div class="metric-footing">Personal user preference</div>
          </div>
        </div>
      </section>

      <!-- 3. 7-Day Rhythm Preview -->
      <section class="card section-card" aria-labelledby="section-weekly-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-weekly-title" class="section-title">7-Day Rhythm Preview</h2>
            <p class="section-subtitle">Rolling 7-day sleep duration and onset regularity.</p>
          </div>
          <span class="badge badge-subtle">7-Day Window</span>
        </div>

        <div class="weekly-bars-placeholder" aria-label="7-day sleep duration chart">
          ${weekDays.map((day) => {
            const fillHeightPct = day.hasSleep ? Math.min(100, Math.max(12, Math.round((day.minutes / (targetSleepMinutes || 480)) * 100))) : 0;
            return `
              <div class="weekly-bar-col ${day.hasSleep ? 'has-record' : 'is-missing'}"
                title="${escapeHtml(day.dateStr)}: ${day.hasSleep ? escapeHtml(day.formatted) : 'No sleep logged (missing record)'}">
                <div class="weekly-bar-track ${day.hasSleep ? '' : 'missing-track'}">
                  ${day.hasSleep ? `
                    <div class="weekly-bar-fill filled" style="height: ${fillHeightPct}%;"></div>
                  ` : `
                    <div class="weekly-bar-missing" aria-hidden="true"></div>
                  `}
                </div>
                <span class="bar-day-label">${escapeHtml(day.dayName)}</span>
                <span class="bar-time-sub ${day.hasSleep ? '' : 'text-muted'}">${day.hasSleep ? escapeHtml(day.formatted) : 'No log'}</span>
              </div>
            `;
          }).join('')}
        </div>
        <p class="chart-footnote">Durations are deduplicated by wake-up date using interval unions. Missing days are unrecorded, not zero.</p>
      </section>

      <!-- 4. Recent Sessions -->
      <section class="section-container" aria-labelledby="section-recent-title">
        <div class="section-heading-row">
          <h2 id="section-recent-title" class="section-title">Recent Sleep Sessions</h2>
          <span class="section-meta">${sessions.length} total logged</span>
        </div>

        ${!hasSessions ? renderEmptyState({
          title: 'No sleep sessions recorded yet',
          description: 'Your logged sleep entries and night-to-night observations will appear here once recorded.',
          badge: 'Awaiting first entry',
          actionLabel: '+ Log Sleep Session',
          actionId: 'btn-empty-log-sleep',
          icon: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          `
        }) : `
          <div class="sessions-list-container">
            ${sessions.slice(0, 5).map(session => renderSessionCard(session)).join('')}
          </div>
        `}
      </section>
    </div>
  `;

  // Bind interaction buttons on rendered session cards
  bindSessionCardActions(container);
}

/**
 * Render individual session card with Edit and Delete capabilities
 */
function renderSessionCard(session) {
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
        <span class="metric-tag">
          <strong>Est. Sleep:</strong> ${est.hasEstimate ? est.formatted : 'Unmeasured (no latency)'}
        </span>
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
      </div>

      ${session.notes ? `
        <p class="session-notes-snippet">"${escapeHtml(session.notes)}"</p>
      ` : ''}
    </article>
  `;
}

/**
 * Bind Edit and Delete handlers
 */
function bindSessionCardActions(container) {
  // Empty state button
  const emptyLogBtn = container.querySelector('#btn-empty-log-sleep');
  if (emptyLogBtn) {
    emptyLogBtn.addEventListener('click', () => {
      openLogModalForCreate();
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

/**
 * Render 24-hour circular dial arcs in SVG
 */
function renderDialSvg(sessions) {
  if (!sessions || sessions.length === 0) {
    return '';
  }

  // Circle dimensions
  const size = 220;
  const cx = 110;
  const cy = 110;
  const r = 95;

  // Render SVG arcs for each session on the 24h dial
  const paths = sessions.map((session) => {
    const startD = new Date(session.startTimestamp || session.startTime);
    const endD = new Date(session.endTimestamp || session.endTime);

    const startHour24 = startD.getHours() + startD.getMinutes() / 60;
    const endHour24 = endD.getHours() + endD.getMinutes() / 60;

    // 00:00 is top (-90 degrees), 360 degrees = 24 hours (15 degrees per hour)
    const startAngle = (startHour24 / 24) * 360 - 90;
    let endAngle = (endHour24 / 24) * 360 - 90;
    if (endAngle <= startAngle) {
      endAngle += 360;
    }

    const strokeColor = session.sessionType === 'nap'
      ? '#8ADBD0'
      : session.sessionType === 'other'
        ? '#FF947F'
        : '#AAA0FF';
    const arcPath = describeArc(cx, cy, r, startAngle, endAngle);

    return `
      <path d="${arcPath}" fill="none" stroke="${strokeColor}" stroke-width="12" stroke-linecap="round" stroke-opacity="0.9" />
    `;
  }).join('');

  return `
    <svg class="dial-svg-overlay" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      ${paths}
    </svg>
  `;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, arcSweep, 0, end.x, end.y
  ].join(' ');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
