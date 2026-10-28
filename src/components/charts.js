// src/components/charts.js
// Nocturne Atlas — Interactive, Responsive, Lightweight Charts
// Zero external libraries. Pure semantic SVG & HTML/CSS.
// Touch-friendly, keyboard-accessible, with accessible tabular alternatives.

import { formatMinutes } from '../services/calculations.js';

/**
 * ---------------------------------------------------------------------
 * 1. SLEEP DURATION TREND CHART (BY WAKE-UP DATE)
 * ---------------------------------------------------------------------
 * Renders daily columns of Time in Bed and Estimated Sleep.
 * Strictly presents missing days as unrecorded / dashed, NEVER as zero.
 */
export function renderDurationTrendChart(trendData) {
  if (!trendData || !trendData.days || trendData.days.length === 0) {
    return `<p class="chart-empty-text">No trend observations available.</p>`;
  }

  const { days, averageTibMinutes, formattedAverageTib, statusNotice, windowDays } = trendData;
  const maxMinuteTarget = 660; // 11 hours max axis scale for headroom

  // Build columns
  const columnsHtml = days.map((day, index) => {
    if (day.isMissing) {
      return `
        <div class="trend-chart-col missing-col"
          tabindex="0"
          role="button"
          data-chart-point="duration"
          data-date="${escapeHtml(day.dateStr)}"
          data-tib="Unrecorded"
          data-est="Unrecorded"
          data-status="No sleep session logged"
          aria-label="${escapeHtml(day.dayMonth)}: No sleep recorded">
          <div class="col-track">
            <div class="col-missing-indicator" aria-hidden="true">
              <span class="missing-dash"></span>
            </div>
          </div>
          <span class="col-date-label">${escapeHtml(day.dayMonth)}</span>
          <span class="col-val-sub text-muted">No log</span>
        </div>
      `;
    }

    const tib = day.timeInBedMinutes || 0;
    const est = day.estimatedSleepMinutes;
    const tibHeightPct = Math.min(100, Math.max(10, Math.round((tib / maxMinuteTarget) * 100)));
    const estHeightPct = est ? Math.min(100, Math.max(6, Math.round((est / maxMinuteTarget) * 100))) : null;

    return `
      <div class="trend-chart-col active-col"
        tabindex="0"
        role="button"
        data-chart-point="duration"
        data-date="${escapeHtml(day.dateStr)}"
        data-tib="${escapeHtml(day.formattedTib)}"
        data-est="${escapeHtml(day.formattedEstimate)}"
        data-efficiency="${day.efficiencyPercent ? day.efficiencyPercent + '%' : 'Unavailable'}"
        data-overlap="${day.hasOverlap ? 'Yes (deduplicated)' : 'No'}"
        data-status="${day.sessions.length} session(s)"
        aria-label="${escapeHtml(day.dayMonth)}: Time in bed ${escapeHtml(day.formattedTib)}, Estimated sleep ${escapeHtml(day.formattedEstimate)}">
        <div class="col-track">
          <!-- TIB Bar -->
          <div class="col-bar-tib" style="height: ${tibHeightPct}%;" aria-hidden="true">
            ${estHeightPct ? `
              <!-- Overlay for Estimated Sleep -->
              <div class="col-bar-est" style="height: ${Math.round((est / tib) * 100)}%;"></div>
            ` : ''}
          </div>
        </div>
        <span class="col-date-label">${escapeHtml(day.dayMonth)}</span>
        <span class="col-val-sub font-mono">${escapeHtml(day.formattedTib)}</span>
      </div>
    `;
  }).join('');

  // Tabular accessible fallback for screen readers
  const tableRowsHtml = days.map(d => `
    <tr>
      <td>${escapeHtml(d.dateStr)}</td>
      <td>${d.isMissing ? 'Missing' : escapeHtml(d.formattedTib)}</td>
      <td>${d.isMissing ? 'Missing' : escapeHtml(d.formattedEstimate)}</td>
      <td>${d.efficiencyPercent ? d.efficiencyPercent + '%' : '--'}</td>
      <td>${d.hasOverlap ? 'Yes' : 'No'}</td>
    </tr>
  `).join('');

  return `
    <div class="chart-wrapper" aria-label="Sleep duration trend chart over past ${windowDays} days">
      <div class="chart-legend-row">
        <span class="chart-legend-item"><span class="legend-box tib-box"></span> Time in Bed (TIB)</span>
        <span class="chart-legend-item"><span class="legend-box est-box"></span> Est. Sleep Duration</span>
        <span class="chart-legend-item"><span class="legend-box missing-box"></span> Missing (No Log)</span>
      </div>

      <!-- Scrollable Chart Canvas -->
      <div class="trend-chart-scrollbox">
        <div class="trend-chart-grid">
          ${columnsHtml}
        </div>
      </div>

      <!-- Detail Card / Popover for Mobile Tap & Desktop Click -->
      <div class="chart-interactive-popover" id="duration-chart-popover" aria-live="polite">
        <span class="popover-tip">Tap or click any bar above to inspect night details</span>
      </div>

      <!-- Accessible Data Table Alternative -->
      <details class="chart-table-toggle">
        <summary>View ${windowDays}-Day Data Table (Screen Reader Accessible)</summary>
        <div class="chart-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Wake Date</th>
                <th scope="col">Time in Bed</th>
                <th scope="col">Est. Sleep</th>
                <th scope="col">Efficiency</th>
                <th scope="col">Overlap Dedup</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------
 * 2. MAIN-SLEEP TIMING CONSISTENCY CHART
 * ---------------------------------------------------------------------
 * Displays bedtime and wake times around midnight.
 */
export function renderTimingConsistencyChart(timingData) {
  if (!timingData || !timingData.hasSufficientData) {
    return `
      <div class="chart-insufficient-box">
        <span class="insufficient-icon" aria-hidden="true">⏱️</span>
        <p class="insufficient-text">${escapeHtml(timingData ? timingData.reason : 'Not enough main sleep records to calculate onset consistency.')}</p>
      </div>
    `;
  }

  const { observations, meanBedtime, meanWakeTime, bedtimeStdDevMinutes, bedtimeWindow, regularityLabel, regularityBadge } = timingData;

  // Visual strip: 20:00 (-240m) to 12:00 (+720m) = 960 total span
  const minOffset = -240; // 20:00
  const maxOffset = 720;  // 12:00
  const span = maxOffset - minOffset;

  const getPercent = (offset) => {
    const clamped = Math.max(minOffset, Math.min(maxOffset, offset));
    return Math.round(((clamped - minOffset) / span) * 100);
  };

  const rowsHtml = observations.map(obs => {
    const leftPct = getPercent(obs.bedOffset);
    const rightPct = getPercent(obs.wakeOffset);
    const widthPct = Math.max(2, rightPct - leftPct);

    return `
      <div class="timing-row"
        tabindex="0"
        role="button"
        data-chart-point="timing"
        data-date="${escapeHtml(obs.wakeDate)}"
        data-start="${escapeHtml(obs.startFormatted)}"
        data-end="${escapeHtml(obs.endFormatted)}"
        data-tib="${formatMinutes(obs.timeInBedMinutes)}"
        aria-label="Wake Date ${escapeHtml(obs.wakeDate)}: Bedtime ${escapeHtml(obs.startFormatted)}, Wake ${escapeHtml(obs.endFormatted)}">
        <span class="timing-row-label font-mono">${escapeHtml(obs.wakeDate.slice(5))}</span>
        <div class="timing-track">
          <!-- Midnight Axis Marker at 00:00 -->
          <div class="midnight-axis-line" style="left: ${getPercent(0)}%;" aria-hidden="true"></div>
          <!-- Sleep Interval Bar -->
          <div class="timing-interval-bar" style="left: ${leftPct}%; width: ${widthPct}%;" aria-hidden="true">
            <span class="timing-point bed-point"></span>
            <span class="timing-point wake-point"></span>
          </div>
        </div>
        <span class="timing-row-times font-mono">${escapeHtml(obs.startFormatted)} → ${escapeHtml(obs.endFormatted)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-wrapper" aria-label="Main sleep timing consistency chart">
      <div class="timing-summary-header">
        <div>
          <span class="timing-metric-title">Average Bedtime: <strong>${escapeHtml(meanBedtime)}</strong></span>
          <span class="timing-metric-sub">Typical Window: <strong>${escapeHtml(bedtimeWindow)}</strong></span>
        </div>
        <span class="badge ${regularityBadge}">${escapeHtml(regularityLabel)}</span>
      </div>

      <!-- Time Axis Scale -->
      <div class="timing-axis-scale font-mono" aria-hidden="true">
        <span style="left: ${getPercent(-240)}%;">20:00</span>
        <span style="left: ${getPercent(-120)}%;">22:00</span>
        <span style="left: ${getPercent(0)}%;" class="axis-midnight">00:00</span>
        <span style="left: ${getPercent(180)}%;">03:00</span>
        <span style="left: ${getPercent(360)}%;">06:00</span>
        <span style="left: ${getPercent(540)}%;">09:00</span>
      </div>

      <div class="timing-chart-list">
        ${rowsHtml}
      </div>

      <div class="chart-interactive-popover" id="timing-chart-popover" aria-live="polite">
        <span class="popover-tip">Tap any row to view night interval and duration</span>
      </div>

      <!-- Accessible Data Table Alternative -->
      <details class="chart-table-toggle">
        <summary>View Timing Data Table</summary>
        <div class="chart-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Wake Date</th>
                <th scope="col">Bedtime</th>
                <th scope="col">Wake Time</th>
                <th scope="col">Time in Bed</th>
              </tr>
            </thead>
            <tbody>
              ${observations.map(o => `
                <tr>
                  <td>${escapeHtml(o.wakeDate)}</td>
                  <td>${escapeHtml(o.startFormatted)}</td>
                  <td>${escapeHtml(o.endFormatted)}</td>
                  <td>${formatMinutes(o.timeInBedMinutes)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------
 * 3. SLEEP DURATION VS REPORTED WAKING ENERGY
 * ---------------------------------------------------------------------
 */
export function renderDurationVsEnergyChart(correlationData) {
  if (!correlationData || !correlationData.hasSufficientData) {
    return `
      <div class="chart-insufficient-box">
        <span class="insufficient-icon" aria-hidden="true">📊</span>
        <p class="insufficient-text">${escapeHtml(correlationData ? correlationData.reason : 'Not enough rated sessions to explore energy patterns.')}</p>
      </div>
    `;
  }

  const { energyGroups, sampleSize, cautiousDisclaimer } = correlationData;

  const groupsHtml = energyGroups.map(g => {
    const maxMins = 540; // 9h scale
    const barWidthPct = g.averageTibMinutes ? Math.min(100, Math.round((g.averageTibMinutes / maxMins) * 100)) : 0;

    return `
      <div class="energy-row"
        tabindex="0"
        role="button"
        data-chart-point="energy"
        data-rating="${g.rating}"
        data-count="${g.count}"
        data-avg="${g.formattedAverageTib}"
        aria-label="Energy Rating ${g.rating} of 5: ${g.count} session(s), Average time in bed ${g.formattedAverageTib}">
        <div class="energy-label-col">
          <span class="energy-stars font-mono">Rating ${g.rating}/5</span>
          <span class="energy-count-sub text-muted">${g.count} session${g.count === 1 ? '' : 's'}</span>
        </div>
        <div class="energy-bar-col">
          <div class="energy-bar-track">
            ${g.count > 0 ? `
              <div class="energy-bar-fill" style="width: ${barWidthPct}%;"></div>
            ` : `
              <span class="no-data-tag font-mono">No sessions</span>
            `}
          </div>
        </div>
        <div class="energy-val-col font-mono">
          ${g.formattedAverageTib}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-wrapper" aria-label="Sleep duration vs reported waking energy chart">
      <div class="chart-sample-badge">Sample size: <strong>N = ${sampleSize} rated sessions</strong></div>
      <div class="energy-chart-list">
        ${groupsHtml}
      </div>
      <p class="chart-footnote">${escapeHtml(cautiousDisclaimer)}</p>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------
 * 4. LIFESTYLE HABIT COMPARISON CHART
 * ---------------------------------------------------------------------
 */
export function renderHabitComparisonChart(habitData) {
  if (!habitData) return '';

  const { caffeine, screen, stress, cautiousDisclaimer } = habitData;

  const renderBinaryCard = (title, data) => {
    if (!data.hasSufficientData) {
      return `
        <div class="habit-comparison-card">
          <h4 class="habit-card-title">${escapeHtml(title)}</h4>
          <div class="insufficient-card-body">
            <span class="insufficient-icon" aria-hidden="true">☕</span>
            <p class="insufficient-text">${escapeHtml(data.reason)}</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="habit-comparison-card">
        <h4 class="habit-card-title">${escapeHtml(title)}</h4>
        <div class="habit-split-grid">
          <!-- Yes Group -->
          <div class="habit-group-box yes-group">
            <span class="group-badge yes-badge">${escapeHtml(data.labelYes)} (${data.yesCount} nights)</span>
            <div class="group-metric-row">
              <span class="metric-key">Avg Time in Bed:</span>
              <span class="metric-val font-mono">${escapeHtml(data.yesStats.formattedTib)}</span>
            </div>
            <div class="group-metric-row">
              <span class="metric-key">Avg Latency:</span>
              <span class="metric-val font-mono">${escapeHtml(data.yesStats.formattedLatency)}</span>
            </div>
          </div>

          <!-- No Group -->
          <div class="habit-group-box no-group">
            <span class="group-badge no-badge">${escapeHtml(data.labelNo)} (${data.noCount} nights)</span>
            <div class="group-metric-row">
              <span class="metric-key">Avg Time in Bed:</span>
              <span class="metric-val font-mono">${escapeHtml(data.noStats.formattedTib)}</span>
            </div>
            <div class="group-metric-row">
              <span class="metric-key">Avg Latency:</span>
              <span class="metric-val font-mono">${escapeHtml(data.noStats.formattedLatency)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  return `
    <div class="habits-chart-wrapper" aria-label="Lifestyle habit comparisons">
      <div class="habit-cards-grid">
        ${renderBinaryCard('Caffeine Timing Comparison', caffeine)}
        ${renderBinaryCard('Late Screen Use Comparison', screen)}
      </div>
      <p class="chart-footnote">${escapeHtml(cautiousDisclaimer)}</p>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------
 * 5. MAIN SLEEP VS NAPS BREAKDOWN CHART
 * ---------------------------------------------------------------------
 */
export function renderDayVsNapChart(napData) {
  if (!napData || !napData.hasNaps) {
    return `
      <div class="chart-insufficient-box">
        <span class="insufficient-icon" aria-hidden="true">☀️</span>
        <p class="insufficient-text">${escapeHtml(napData ? napData.summaryText : 'No daylight naps recorded.')}</p>
      </div>
    `;
  }

  const { napCount, averageNapMinutes, formattedAverage, shortestNapMinutes, longestNapMinutes, summaryText, cautiousNote } = napData;

  return `
    <div class="nap-summary-card">
      <div class="nap-metric-chips-row">
        <div class="nap-chip">
          <span class="chip-val font-mono">${napCount}</span>
          <span class="chip-label">Recorded Naps</span>
        </div>
        <div class="nap-chip">
          <span class="chip-val font-mono">${formattedAverage}</span>
          <span class="chip-label">Average Duration</span>
        </div>
        <div class="nap-chip">
          <span class="chip-val font-mono">${formatMinutes(shortestNapMinutes)} – ${formatMinutes(longestNapMinutes)}</span>
          <span class="chip-label">Duration Range</span>
        </div>
      </div>
      <p class="nap-summary-description">${escapeHtml(summaryText)}</p>
      <p class="chart-footnote">${escapeHtml(cautiousNote)}</p>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------
 * 6. INTERACTIVE BINDINGS & POPOVER CONTROLS
 * ---------------------------------------------------------------------
 * Attaches touch, pointer, and keyboard event handlers.
 */
export function bindChartInteractions(container) {
  if (!container) return;

  // Duration Chart Interactivity
  const durationPopover = container.querySelector('#duration-chart-popover');
  container.querySelectorAll('[data-chart-point="duration"]').forEach((col) => {
    const showDetails = () => {
      container.querySelectorAll('[data-chart-point="duration"]').forEach(c => c.classList.remove('selected'));
      col.classList.add('selected');
      if (durationPopover) {
        const date = col.getAttribute('data-date');
        const tib = col.getAttribute('data-tib');
        const est = col.getAttribute('data-est');
        const eff = col.getAttribute('data-efficiency') || '--';
        const overlap = col.getAttribute('data-overlap') || 'No';
        const status = col.getAttribute('data-status');

        durationPopover.innerHTML = `
          <div class="popover-content">
            <span class="popover-date font-mono"><strong>Wake Date:</strong> ${escapeHtml(date)}</span>
            <div class="popover-grid">
              <span>Time in Bed: <strong>${escapeHtml(tib)}</strong></span>
              <span>Est. Sleep: <strong>${escapeHtml(est)}</strong></span>
              <span>Efficiency: <strong>${escapeHtml(eff)}</strong></span>
              <span>Overlaps: <strong>${escapeHtml(overlap)}</strong></span>
            </div>
            <span class="popover-status">${escapeHtml(status)}</span>
          </div>
        `;
      }
    };

    col.addEventListener('click', showDetails);
    col.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showDetails();
      }
    });
  });

  // Timing Consistency Chart Interactivity
  const timingPopover = container.querySelector('#timing-chart-popover');
  container.querySelectorAll('[data-chart-point="timing"]').forEach((row) => {
    const showDetails = () => {
      container.querySelectorAll('[data-chart-point="timing"]').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      if (timingPopover) {
        const date = row.getAttribute('data-date');
        const start = row.getAttribute('data-start');
        const end = row.getAttribute('data-end');
        const tib = row.getAttribute('data-tib');

        timingPopover.innerHTML = `
          <div class="popover-content">
            <span class="popover-date font-mono"><strong>Night for Wake Date:</strong> ${escapeHtml(date)}</span>
            <div class="popover-grid">
              <span>Bedtime: <strong>${escapeHtml(start)}</strong></span>
              <span>Wake Time: <strong>${escapeHtml(end)}</strong></span>
              <span>Duration in Bed: <strong>${escapeHtml(tib)}</strong></span>
            </div>
          </div>
        `;
      }
    };

    row.addEventListener('click', showDetails);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showDetails();
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
