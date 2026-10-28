// src/screens/insightsScreen.js
// Nocturne Atlas — Sleep Insights & Analytical Charts (Phase 3)
// Fully local analysis, rule-based interpretations, interactive charts, and weekly behavioural experiments.

import {
  getAllSessions,
  getAllHabits,
  getActiveExperiment,
  getAllExperiments,
  saveExperiment,
  completeExperiment,
  abandonExperiment
} from '../storage/db.js';
import {
  calculateDurationTrends,
  calculateTimingConsistency,
  calculateDaytimeSleepPatterns,
  calculateRestednessEnergyCorrelations,
  calculateHabitAssociations,
  analyzeExperimentProgress,
  EXPERIMENT_CATALOG
} from '../services/analytics.js';
import {
  renderDurationTrendChart,
  renderTimingConsistencyChart,
  renderDurationVsEnergyChart,
  renderHabitComparisonChart,
  renderDayVsNapChart,
  bindChartInteractions
} from '../components/charts.js';
import { renderEmptyState } from '../components/emptyState.js';
import { formatLocalDate } from '../services/calculations.js';

let activeTrendsWindow = 7; // 7 | 14 | 30 days

export async function renderInsightsScreen() {
  const container = document.getElementById('screen-insights');
  if (!container) return;

  const [sessions, habits, activeExp, pastExperiments] = await Promise.all([
    getAllSessions(),
    getAllHabits(),
    getActiveExperiment(),
    getAllExperiments()
  ]);

  // Count unique logged wake dates
  const uniqueWakeDates = new Set(sessions.map(s => s.wakeDate));
  const nightCount = uniqueWakeDates.size;
  const hasData = sessions.length > 0;

  // Run analytical calculations
  const trendData = calculateDurationTrends(sessions, { days: activeTrendsWindow });
  const timingData = calculateTimingConsistency(sessions, { days: 14 });
  const napData = calculateDaytimeSleepPatterns(sessions, { days: 14 });
  const correlationData = calculateRestednessEnergyCorrelations(sessions);
  const habitData = calculateHabitAssociations(sessions, habits);
  const activeExpAnalysis = activeExp ? analyzeExperimentProgress(activeExp, sessions) : null;

  // Filter out the currently active experiment from past experiments list
  const archivedExperiments = pastExperiments.filter(e => e.status !== 'active');

  container.innerHTML = `
    <div class="screen-content">
      <!-- Screen Header -->
      <header class="screen-header">
        <div>
          <span class="subheading-accent">Analysis &amp; Science</span>
          <h1 class="screen-title">Sleep Insights</h1>
        </div>
      </header>

      <!-- 1. Baseline Data & Threshold Notice -->
      <section class="card baseline-banner-card" aria-labelledby="baseline-status-title">
        <div class="baseline-banner-body">
          <div class="baseline-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20v-6M6 20V10M18 20V4"></path>
            </svg>
          </div>
          <div class="baseline-text-group">
            <h2 id="baseline-status-title" class="baseline-title">
              ${nightCount >= 7 ? 'Baseline Window Established' : 'Acquiring Baseline Data'}
            </h2>
            <p class="baseline-desc">
              ${nightCount >= 7
                ? `You have logged ${nightCount} unique nights. Rolling averages and onset regularity are derived from your real entries.`
                : `Sleep observations require at least 7 nights of consistent logs to establish a reliable baseline. Currently ${nightCount} of 7 nights recorded.`
              }
            </p>
          </div>
          <span class="badge ${nightCount >= 7 ? 'badge-mint' : 'badge-subtle'}">
            ${nightCount} of 7 nights
          </span>
        </div>
      </section>

      ${!hasData ? `
        <!-- Honest Empty State for Brand New Users -->
        <section class="section-container">
          ${renderEmptyState({
            title: 'No sleep records available for analysis',
            description: 'Log your sleep sessions in the journal to view duration trends, circadian timing consistency, and habit associations.',
            badge: 'Awaiting data',
            actionLabel: '+ Log First Session',
            actionId: 'btn-insights-log-sleep',
            icon: `
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            `
          })}
        </section>
      ` : `
        <!-- A. Sleep Duration Trends -->
        <section class="card section-card" aria-labelledby="section-trends-title">
          <div class="section-card-header">
            <div>
              <h2 id="section-trends-title" class="section-title">Longitudinal Trends &amp; Sleep Duration</h2>
              <p class="section-subtitle">Deduplicated time in bed and estimated sleep duration by wake date.</p>
            </div>
            <!-- Window Selector Pills -->
            <div class="filter-pills-row" role="tablist" aria-label="Trend window duration">
              <button type="button" class="filter-pill ${activeTrendsWindow === 7 ? 'active' : ''}" data-window="7" role="tab" aria-selected="${activeTrendsWindow === 7}">7 Days</button>
              <button type="button" class="filter-pill ${activeTrendsWindow === 14 ? 'active' : ''}" data-window="14" role="tab" aria-selected="${activeTrendsWindow === 14}">14 Days</button>
              <button type="button" class="filter-pill ${activeTrendsWindow === 30 ? 'active' : ''}" data-window="30" role="tab" aria-selected="${activeTrendsWindow === 30}">30 Days</button>
            </div>
          </div>

          <!-- Trend Metrics Row -->
          <div class="trend-summary-row">
            <div class="trend-stat-chip">
              <span class="chip-label">Avg Time in Bed</span>
              <span class="chip-value font-mono">${trendData.formattedAverageTib}</span>
              <span class="chip-sub text-muted">${trendData.recordedDaysCount} logged of ${trendData.windowDays}d</span>
            </div>
            <div class="trend-stat-chip">
              <span class="chip-label">Avg Est. Sleep</span>
              <span class="chip-value font-mono">${trendData.formattedAverageEstimate}</span>
              <span class="chip-sub text-muted">${trendData.daysWithCompleteEstimateCount} complete estimates</span>
            </div>
            <div class="trend-stat-chip">
              <span class="chip-label">Missing Days</span>
              <span class="chip-value font-mono">${trendData.missingDaysCount}</span>
              <span class="chip-sub text-muted">${trendData.missingDaysCount > 0 ? 'Rendered as unrecorded' : 'Full coverage'}</span>
            </div>
          </div>

          <!-- Interactive Duration Chart -->
          ${renderDurationTrendChart(trendData)}
          <p class="chart-footnote">${escapeHtml(trendData.statusNotice)}</p>
        </section>

        <!-- B. Main-Sleep Timing Consistency -->
        <section class="card section-card" aria-labelledby="section-timing-title">
          <div class="section-card-header">
            <div>
              <h2 id="section-timing-title" class="section-title">Main-Sleep Timing Consistency</h2>
              <p class="section-subtitle">Circadian bedtime and wake windows around midnight (excluding daytime naps).</p>
            </div>
            <span class="badge badge-lilac">Onset Regularity</span>
          </div>

          ${renderTimingConsistencyChart(timingData)}
          ${timingData.hasSufficientData ? `
            <p class="chart-footnote">${escapeHtml(timingData.variabilityExplanation)} Regularity supports endogenous melatonin cycles.</p>
          ` : ''}
        </section>

        <!-- C. Daytime Sleep & Naps -->
        <section class="card section-card" aria-labelledby="section-naps-title">
          <div class="section-card-header">
            <div>
              <h2 id="section-naps-title" class="section-title">Daytime Sleep &amp; Naps</h2>
              <p class="section-subtitle">Frequency and duration of daylight rest periods.</p>
            </div>
            <span class="badge badge-mint">Day Rest</span>
          </div>

          ${renderDayVsNapChart(napData)}
        </section>

        <!-- D. Restedness and Waking Energy -->
        <section class="card section-card" aria-labelledby="section-energy-title">
          <div class="section-card-header">
            <div>
              <h2 id="section-energy-title" class="section-title">Restedness &amp; Waking Energy</h2>
              <p class="section-subtitle">Observed relationship between sleep duration and reported morning energy.</p>
            </div>
            <span class="badge badge-mint">Subjective Ratings</span>
          </div>

          ${renderDurationVsEnergyChart(correlationData)}
        </section>

        <!-- E. Lifestyle Habit Associations -->
        <section class="card section-card" aria-labelledby="section-habits-title">
          <div class="section-card-header">
            <div>
              <h2 id="section-habits-title" class="section-title">Lifestyle Habit Associations</h2>
              <p class="section-subtitle">Recorded comparisons for caffeine, late screens, and daytime stress.</p>
            </div>
            <span class="badge badge-lilac">Habit Journal</span>
          </div>

          ${renderHabitComparisonChart(habitData)}
        </section>
      `}

      <!-- F. Weekly Behavioural Experiment -->
      <section class="card section-card" aria-labelledby="section-experiment-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-experiment-title" class="section-title">Weekly Habit &amp; Behavioural Experiment</h2>
            <p class="section-subtitle">Single-variable empirical tests to observe individual sleep responsiveness.</p>
          </div>
          <span class="badge ${activeExp ? 'badge-mint' : 'badge-subtle'}">
            ${activeExp ? 'Active Protocol' : 'Choose Protocol'}
          </span>
        </div>

        ${activeExp ? renderActiveExperimentCard(activeExp, activeExpAnalysis) : renderExperimentSelector()}

        ${archivedExperiments.length > 0 ? renderArchivedExperiments(archivedExperiments) : ''}
      </section>

      <!-- G. Evidence-Based Sleep Science Principles (Qualified & Balanced) -->
      <section class="card section-card" aria-labelledby="section-science-title">
        <div class="section-card-header">
          <div>
            <h2 id="section-science-title" class="section-title">Evidence-Based Sleep Principles</h2>
            <p class="section-subtitle">Core physiological mechanisms observed in circadian chronobiology.</p>
          </div>
          <span class="badge badge-lilac">Educational Context</span>
        </div>

        <div class="science-cards-list">
          <article class="science-item">
            <div class="science-item-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="science-item-body">
              <h3 class="science-item-title">Circadian Regularity</h3>
              <p class="science-item-text">
                The timing of sleep onset and wake-up anchors the suprachiasmatic nucleus. Maintaining relatively consistent sleep timing strengthens natural circadian cues and restorative slow-wave sleep.
              </p>
            </div>
          </article>

          <article class="science-item">
            <div class="science-item-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
              </svg>
            </div>
            <div class="science-item-body">
              <h3 class="science-item-title">Adenosine &amp; Sleep Pressure</h3>
              <p class="science-item-text">
                Homeostatic sleep pressure accumulates through waking adenosine buildup. While chronic sleep deficits cannot be erased overnight, regular, adequate sleep duration supports cognitive restoration and emotional resilience.
              </p>
            </div>
          </article>

          <article class="science-item">
            <div class="science-item-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="science-item-body">
              <h3 class="science-item-title">Thermoregulation &amp; Environment</h3>
              <p class="science-item-text">
                Core body temperature naturally dips during sleep onset. While cooler bedroom environments generally facilitate peripheral heat dissipation, individual thermal comfort varies widely; comfortable bedding and good ventilation are key.
              </p>
            </div>
          </article>
        </div>

        <div class="medical-disclaimer-box" role="note">
          <strong>Personal Sleep Journal Notice:</strong>
          <span>Nocturne Atlas is a personal tracking journal, not a medical or clinical diagnostic tool. The patterns, correlations, and observations presented here reflect your manual records and do not constitute medical diagnoses or prescriptive clinical advice.</span>
        </div>
      </section>
    </div>
  `;

  // Bind chart and screen event listeners
  bindChartInteractions(container);
  bindInsightsScreenActions(container);
}

/**
 * ---------------------------------------------------------------------
 * EXPERIMENT VIEW COMPONENTS
 * ---------------------------------------------------------------------
 */

function renderActiveExperimentCard(experiment, analysis) {
  const percent = analysis ? analysis.progressPercent : 0;
  const elapsed = analysis ? analysis.elapsedDays : 1;
  const target = experiment.targetDays || 7;

  return `
    <div class="experiment-active-container">
      <div class="experiment-active-header">
        <div>
          <span class="subheading-accent">Active Protocol</span>
          <h3 class="experiment-active-title">${escapeHtml(experiment.title)}</h3>
        </div>
        <span class="badge badge-mint">Day ${elapsed} of ${target}</span>
      </div>

      <p class="experiment-hypothesis-text">
        <strong>Hypothesis:</strong> ${escapeHtml(experiment.hypothesis)}
      </p>

      <div class="experiment-details-grid">
        <div class="exp-detail-box">
          <span class="exp-box-label">Behavioural Change</span>
          <span class="exp-box-val">${escapeHtml(experiment.behaviorToChange)}</span>
        </div>
        <div class="exp-detail-box">
          <span class="exp-box-label">Observed Metric</span>
          <span class="exp-box-val">${escapeHtml(experiment.outcomeToObserve)}</span>
        </div>
      </div>

      <!-- Progress Track -->
      <div class="exp-progress-wrapper">
        <div class="exp-progress-label font-mono">
          <span>Observation Progress: ${analysis ? analysis.loggedDaysCount : 0} / ${target} nights logged</span>
          <span>${percent}%</span>
        </div>
        <div class="exp-progress-bar">
          <div class="exp-progress-fill" style="width: ${percent}%;"></div>
        </div>
      </div>

      ${analysis && analysis.hasObservations ? `
        <div class="exp-metrics-chip-row">
          <span class="metric-pill">Avg Latency: <strong>${escapeHtml(analysis.formattedAvgLatency)}</strong></span>
          ${analysis.avgEnergyDuringExp ? `<span class="metric-pill">Avg Energy: <strong>${analysis.avgEnergyDuringExp}/5</strong></span>` : ''}
        </div>
      ` : `
        <p class="chart-footnote">Log sleep sessions during this week to automatically record observations for this protocol.</p>
      `}

      <!-- Completion Reflection Form -->
      <div class="experiment-action-block">
        <label for="exp-reflection-input" class="form-label">Personal Reflection Notes (Optional)</label>
        <textarea id="exp-reflection-input" class="form-textarea" rows="2" placeholder="Record what you observed or felt during this experiment...">${escapeHtml(experiment.outcomeReflection || experiment.notes || '')}</textarea>

        <div class="exp-btn-row">
          <button type="button" class="btn btn-primary btn-sm" id="btn-complete-experiment" data-id="${escapeHtml(experiment.id)}">
            Complete Experiment
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-abandon-experiment" data-id="${escapeHtml(experiment.id)}">
            Cancel Protocol
          </button>
        </div>
      </div>
      <p class="chart-footnote">Results are personal observations, not proof of causation.</p>
    </div>
  `;
}

function renderExperimentSelector() {
  return `
    <div class="experiment-catalog-wrapper">
      <p class="catalog-intro-text">
        Select a 7-day single-variable behavioral experiment to observe how small adjustments align with your sleep patterns:
      </p>

      <div class="catalog-cards-grid">
        ${EXPERIMENT_CATALOG.map((proto) => `
          <article class="protocol-card" data-protocol-id="${escapeHtml(proto.protocolId)}">
            <div class="protocol-header">
              <h3 class="protocol-title">${escapeHtml(proto.title)}</h3>
              <span class="protocol-days-badge font-mono">${proto.targetDays} Days</span>
            </div>
            <p class="protocol-hypothesis">${escapeHtml(proto.hypothesis)}</p>
            <div class="protocol-rules">
              <span class="protocol-rule-tag"><strong>Action:</strong> ${escapeHtml(proto.behaviorToChange)}</span>
              <span class="protocol-rule-tag"><strong>Observe:</strong> ${escapeHtml(proto.outcomeToObserve)}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-start-protocol"
              data-protocol="${escapeHtml(proto.protocolId)}">
              Start 7-Day Experiment
            </button>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderArchivedExperiments(experiments) {
  return `
    <div class="archived-experiments-block">
      <h3 class="archived-heading">Past Experiment History</h3>
      <div class="archived-list">
        ${experiments.map((exp) => {
          const isCompleted = exp.status === 'completed';
          const isCancelled = exp.status === 'abandoned' || exp.status === 'cancelled';
          const statusLabel = isCompleted ? 'Completed' : isCancelled ? 'Cancelled' : 'Archived';
          return `
            <div class="archived-item ${isCompleted ? 'completed' : isCancelled ? 'cancelled' : 'abandoned'}">
              <div class="archived-item-header">
                <div>
                  <h4 class="archived-item-title">${escapeHtml(exp.title)}</h4>
                  <span class="archived-dates font-mono">${escapeHtml(exp.startedAt)} → ${exp.completedAt ? escapeHtml(exp.completedAt.slice(0, 10)) : escapeHtml(exp.targetEndDate)}</span>
                </div>
                <span class="badge ${isCompleted ? 'badge-mint' : 'badge-subtle'}">
                  ${statusLabel}
                </span>
              </div>
              ${exp.outcomeReflection ? `
                <p class="archived-reflection">"${escapeHtml(exp.outcomeReflection)}"</p>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------
 * BIND ACTIONS
 * ---------------------------------------------------------------------
 */
function bindInsightsScreenActions(container) {
  // Empty state button
  const emptyLogBtn = container.querySelector('#btn-insights-log-sleep');
  if (emptyLogBtn) {
    emptyLogBtn.addEventListener('click', async () => {
      const { openLogModalForCreate } = await import('../components/logModal.js');
      openLogModalForCreate();
    });
  }

  // Trend window tabs (7 / 14 / 30)
  container.querySelectorAll('[data-window]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = Number(btn.getAttribute('data-window'));
      if (w && w !== activeTrendsWindow) {
        activeTrendsWindow = w;
        renderInsightsScreen();
      }
    });
  });

  // Start protocol buttons
  container.querySelectorAll('.btn-start-protocol').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const protocolId = btn.getAttribute('data-protocol');
      const proto = EXPERIMENT_CATALOG.find(p => p.protocolId === protocolId);
      if (!proto) return;

      const confirmed = window.confirm(`Start the "${proto.title}" 7-day experiment starting today?`);
      if (confirmed) {
        const todayStr = formatLocalDate(new Date());
        const endDateStr = formatLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

        await saveExperiment({
          protocolId: proto.protocolId,
          title: proto.title,
          hypothesis: proto.hypothesis,
          behaviorToChange: proto.behaviorToChange,
          outcomeToObserve: proto.outcomeToObserve,
          targetDays: proto.targetDays,
          startedAt: todayStr,
          targetEndDate: endDateStr,
          status: 'active'
        });

        document.dispatchEvent(new CustomEvent('nocturne-data-changed'));
      }
    });
  });

  // Complete experiment button
  const completeBtn = container.querySelector('#btn-complete-experiment');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      const id = completeBtn.getAttribute('data-id');
      const reflectionText = container.querySelector('#exp-reflection-input')?.value || '';
      await completeExperiment(id, reflectionText);
      document.dispatchEvent(new CustomEvent('nocturne-data-changed'));
    });
  }

  // Abandon experiment button
  const abandonBtn = container.querySelector('#btn-abandon-experiment');
  if (abandonBtn) {
    abandonBtn.addEventListener('click', async () => {
      const id = abandonBtn.getAttribute('data-id');
      const confirmed = window.confirm('Cancel this active experiment? Your notes will be preserved in your experiment history.');
      if (confirmed) {
        const reflectionText = container.querySelector('#exp-reflection-input')?.value || 'Cancelled early';
        await abandonExperiment(id, reflectionText);
        document.dispatchEvent(new CustomEvent('nocturne-data-changed'));
      }
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
