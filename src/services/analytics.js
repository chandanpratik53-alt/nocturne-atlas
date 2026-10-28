// src/services/analytics.js
// Nocturne Atlas — Sleep Insights Analytical Engine
// Pure, deterministic, zero-dependency analytical calculations.
// Adheres strictly to chronobiological rules, minimum data thresholds, and non-causal evidence framing.

import {
  calculateTimeInBedMinutes,
  calculateEstimatedSleepDuration,
  calculateSleepEfficiency,
  calculateIntervalUnionMinutes,
  formatMinutes,
  formatLocalTime,
  formatLocalDate
} from './calculations.js';

/**
 * ---------------------------------------------------------------------
 * 1. SLEEP DURATION TRENDS & ROLLING SUMMARIES
 * ---------------------------------------------------------------------
 */

/**
 * Calculate sleep duration trends for a specified rolling day window.
 * Explicitly identifies missing days rather than treating them as zero sleep.
 * Discloses overlap deduplication and missing latency estimates.
 *
 * @param {Array} sessions - All stored sleep sessions
 * @param {Object} options - { days: 7 | 14 | 30, endDateStr: 'YYYY-MM-DD' }
 * @returns {Object} Comprehensive trend summary & daily records
 */
export function calculateDurationTrends(sessions = [], options = {}) {
  const daysCount = Number(options.days) || 7;
  const endDate = options.endDateStr ? new Date(options.endDateStr) : new Date();

  // Generate rolling date array from oldest to newest (wake dates)
  const days = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = formatLocalDate(d);
    const dayName = d.toLocaleDateString('default', { weekday: 'short' });
    const dayMonth = `${d.getDate()} ${d.toLocaleDateString('default', { month: 'short' })}`;

    // Find sessions attributed to this wake date
    const daySessions = sessions.filter(s => s.wakeDate === dateStr);
    const hasSleep = daySessions.length > 0;

    if (!hasSleep) {
      days.push({
        dateStr,
        dayName,
        dayMonth,
        hasSleep: false,
        isMissing: true,
        sessionCount: 0,
        mainCount: 0,
        napCount: 0,
        timeInBedMinutes: null,
        formattedTib: '--',
        estimatedSleepMinutes: null,
        formattedEstimate: '--',
        estimateStatus: 'missing',
        efficiencyPercent: null,
        hasOverlap: false,
        note: 'No sleep session logged for this wake date.'
      });
      continue;
    }

    // Sessions present: calculate interval union (deduplicated TIB)
    const rawTibSum = daySessions.reduce((acc, s) => {
      const tib = s.timeInBedMinutes || calculateTimeInBedMinutes(s.startTimestamp, s.endTimestamp);
      return acc + tib;
    }, 0);
    const dedupTib = calculateIntervalUnionMinutes(daySessions);
    const hasOverlap = rawTibSum > dedupTib;

    const mainSessions = daySessions.filter(s => s.sessionType === 'main');
    const napSessions = daySessions.filter(s => s.sessionType === 'nap');

    // Calculate estimated sleep duration:
    // If ANY session in the day lacks latency, estimated sleep cannot be fully computed.
    let totalEstimatedMinutes = 0;
    let allSessionsHaveEstimate = true;
    let anySessionHasEstimate = false;

    for (const s of daySessions) {
      const est = calculateEstimatedSleepDuration(s);
      if (est.hasEstimate && est.estimatedMinutes !== null) {
        totalEstimatedMinutes += est.estimatedMinutes;
        anySessionHasEstimate = true;
      } else {
        allSessionsHaveEstimate = false;
      }
    }

    let estimatedSleepMinutes = null;
    let estimateStatus = 'unavailable';
    let formattedEstimate = '--';

    if (allSessionsHaveEstimate && daySessions.length > 0) {
      estimatedSleepMinutes = totalEstimatedMinutes;
      estimateStatus = 'complete';
      formattedEstimate = formatMinutes(estimatedSleepMinutes);
    } else if (anySessionHasEstimate) {
      estimatedSleepMinutes = totalEstimatedMinutes;
      estimateStatus = 'partial';
      formattedEstimate = `~${formatMinutes(estimatedSleepMinutes)}`;
    }

    const eff = calculateSleepEfficiency(dedupTib, estimatedSleepMinutes);

    days.push({
      dateStr,
      dayName,
      dayMonth,
      hasSleep: true,
      isMissing: false,
      sessionCount: daySessions.length,
      mainCount: mainSessions.length,
      napCount: napSessions.length,
      timeInBedMinutes: dedupTib,
      rawTibSum,
      formattedTib: formatMinutes(dedupTib),
      estimatedSleepMinutes,
      formattedEstimate,
      estimateStatus,
      efficiencyPercent: eff.efficiencyPercent,
      hasOverlap,
      sessions: daySessions
    });
  }

  // Window Aggregates
  const recordedDays = days.filter(d => d.hasSleep);
  const recordedCount = recordedDays.length;
  const missingCount = daysCount - recordedCount;

  // Average TIB (only across recorded days)
  const averageTibMinutes = recordedCount > 0
    ? Math.round(recordedDays.reduce((acc, d) => acc + d.timeInBedMinutes, 0) / recordedCount)
    : null;

  // Average Estimated Sleep (only across days with complete estimates)
  const daysWithCompleteEst = recordedDays.filter(d => d.estimateStatus === 'complete');
  const averageEstimatedSleepMinutes = daysWithCompleteEst.length > 0
    ? Math.round(daysWithCompleteEst.reduce((acc, d) => acc + d.estimatedSleepMinutes, 0) / daysWithCompleteEst.length)
    : null;

  // Days with detected and deduplicated overlaps
  const overlapDaysCount = recordedDays.filter(d => d.hasOverlap).length;

  // Minimum data thresholds:
  // - Minimum 3 nights for basic trend direction
  // - Minimum 7 nights for baseline average
  const meetsBasicThreshold = recordedCount >= 3;
  const meetsBaselineThreshold = recordedCount >= 7;

  return {
    windowDays: daysCount,
    startDateStr: days[0].dateStr,
    endDateStr: days[days.length - 1].dateStr,
    days,
    recordedDaysCount: recordedCount,
    missingDaysCount: missingCount,
    averageTibMinutes,
    formattedAverageTib: formatMinutes(averageTibMinutes),
    averageEstimatedSleepMinutes,
    formattedAverageEstimate: formatMinutes(averageEstimatedSleepMinutes),
    daysWithCompleteEstimateCount: daysWithCompleteEst.length,
    overlapDaysCount,
    meetsBasicThreshold,
    meetsBaselineThreshold,
    statusNotice: !meetsBasicThreshold
      ? `Requires at least 3 logged nights in the past ${daysCount} days to calculate reliable averages. Currently ${recordedCount} logged.`
      : !meetsBaselineThreshold
        ? `Preliminary trend based on ${recordedCount} of ${daysCount} nights. A 7-night baseline is recommended for robust comparisons.`
        : `Stable ${recordedCount}-night observation window.`
  };
}

/**
 * ---------------------------------------------------------------------
 * 2. MAIN-SLEEP TIMING CONSISTENCY & CIRCULAR MIDNIGHT ARITHMETIC
 * ---------------------------------------------------------------------
 */

/**
 * Calculate continuous signed minutes relative to midnight (-720 to +720).
 * Handles bedtime transitions smoothly across midnight without circular distortion:
 * e.g., 23:30 is -30m, 00:30 is +30m. Average of (-30, +30) is 0m (00:00 midnight),
 * whereas naive arithmetic (1410, 30) would incorrectly produce 720m (12:00 noon).
 *
 * @param {Date|number|string} dateInput
 * @returns {number} Offset in minutes from midnight [-720, +720]
 */
export function calculateMidnightOffsetMinutes(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return 0;
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Evening times (12:00 PM to 23:59 PM) map to negative offsets (-720 to -1)
  if (hours >= 12) {
    return totalMinutes - 1440;
  }
  // Morning times (00:00 AM to 11:59 AM) map to positive offsets (0 to +719)
  return totalMinutes;
}

/**
 * Convert a signed midnight offset back into formatted 24h clock string "HH:mm"
 * e.g. -30 -> "23:30", +45 -> "00:45", 0 -> "00:00"
 */
export function midnightOffsetToClockTime(offsetMinutes) {
  if (!Number.isFinite(offsetMinutes)) return '--:--';
  let totalMinutes = Math.round(offsetMinutes);
  if (totalMinutes < 0) {
    totalMinutes += 1440;
  }
  totalMinutes = (totalMinutes % 1440 + 1440) % 1440;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Analyze timing consistency of sessions classified strictly as 'main' sleep.
 * Excludes naps and daytime sessions.
 *
 * @param {Array} sessions - Sleep sessions
 * @param {Object} options - { days: 14 }
 * @returns {Object} Bedtime / wake-up timing variability and windows
 */
export function calculateTimingConsistency(sessions = [], options = {}) {
  const daysCount = Number(options.days) || 14;
  const cutoffMs = Date.now() - daysCount * 24 * 60 * 60 * 1000;

  // Filter strictly for main sleep sessions within the analysis window
  const mainSessions = sessions.filter(s => {
    if (s.sessionType !== 'main') return false;
    const startMs = s.startTimestamp || new Date(s.startTime).getTime();
    return Number.isFinite(startMs) && startMs >= cutoffMs;
  });

  const sampleSize = mainSessions.length;
  const thresholdRequired = 3;

  if (sampleSize < thresholdRequired) {
    return {
      hasSufficientData: false,
      sampleSize,
      thresholdRequired,
      reason: `Requires at least ${thresholdRequired} main sleep sessions in the last ${daysCount} days to calculate onset variability without noise (currently ${sampleSize} recorded).`,
      observations: []
    };
  }

  // Extract bedtime and wake offsets
  const observations = mainSessions.map(s => {
    const startMs = s.startTimestamp || new Date(s.startTime).getTime();
    const endMs = s.endTimestamp || new Date(s.endTime).getTime();
    const bedOffset = calculateMidnightOffsetMinutes(startMs);
    const wakeOffset = calculateMidnightOffsetMinutes(endMs);

    return {
      id: s.id,
      wakeDate: s.wakeDate,
      startFormatted: formatLocalTime(startMs),
      endFormatted: formatLocalTime(endMs),
      bedOffset,
      wakeOffset,
      timeInBedMinutes: s.timeInBedMinutes || calculateTimeInBedMinutes(startMs, endMs)
    };
  });

  // Calculate mean bedtime offset and standard deviation
  const sumBedOffsets = observations.reduce((acc, o) => acc + o.bedOffset, 0);
  const meanBedOffset = sumBedOffsets / sampleSize;

  const bedVariance = observations.reduce((acc, o) => acc + Math.pow(o.bedOffset - meanBedOffset, 2), 0) / sampleSize;
  const bedtimeStdDevMinutes = Math.round(Math.sqrt(bedVariance));

  // Calculate mean wake offset and standard deviation
  const sumWakeOffsets = observations.reduce((acc, o) => acc + o.wakeOffset, 0);
  const meanWakeOffset = sumWakeOffsets / sampleSize;

  const wakeVariance = observations.reduce((acc, o) => acc + Math.pow(o.wakeOffset - meanWakeOffset, 2), 0) / sampleSize;
  const wakeStdDevMinutes = Math.round(Math.sqrt(wakeVariance));

  // Bedtime window (mean ± stdDev)
  const windowStartOffset = meanBedOffset - bedtimeStdDevMinutes;
  const windowEndOffset = meanBedOffset + bedtimeStdDevMinutes;

  // Neutral, non-judgmental variability category
  let regularityLabel = 'Consistent window';
  let regularityBadge = 'badge-mint';
  if (bedtimeStdDevMinutes > 60) {
    regularityLabel = 'Wide timing variability';
    regularityBadge = 'badge-afterglow';
  } else if (bedtimeStdDevMinutes > 30) {
    regularityLabel = 'Moderate variability';
    regularityBadge = 'badge-lilac';
  }

  return {
    hasSufficientData: true,
    sampleSize,
    meanBedtime: midnightOffsetToClockTime(meanBedOffset),
    meanWakeTime: midnightOffsetToClockTime(meanWakeOffset),
    bedtimeStdDevMinutes,
    wakeStdDevMinutes,
    bedtimeWindow: `${midnightOffsetToClockTime(windowStartOffset)} – ${midnightOffsetToClockTime(windowEndOffset)}`,
    regularityLabel,
    regularityBadge,
    variabilityExplanation: `Bedtimes varied by approximately ±${bedtimeStdDevMinutes} minutes across ${sampleSize} recorded main sleep sessions.`,
    observations
  };
}

/**
 * ---------------------------------------------------------------------
 * 3. DAYTIME SLEEP & NAP PATTERNS
 * ---------------------------------------------------------------------
 */

/**
 * Summarize nap frequency, duration distribution, and timing.
 * Kept strictly separate from main nighttime sleep.
 *
 * @param {Array} sessions
 * @param {Object} options - { days: 14 }
 */
export function calculateDaytimeSleepPatterns(sessions = [], options = {}) {
  const daysCount = Number(options.days) || 14;
  const cutoffMs = Date.now() - daysCount * 24 * 60 * 60 * 1000;

  const windowSessions = sessions.filter(s => {
    const startMs = s.startTimestamp || new Date(s.startTime).getTime();
    return Number.isFinite(startMs) && startMs >= cutoffMs;
  });

  const napSessions = windowSessions.filter(s => s.sessionType === 'nap');
  const mainSessions = windowSessions.filter(s => s.sessionType === 'main');

  const napCount = napSessions.length;
  const mainCount = mainSessions.length;

  if (napCount === 0) {
    return {
      hasNaps: false,
      napCount: 0,
      mainCount,
      summaryText: `No daytime naps recorded in the past ${daysCount} days (${mainCount} main sleep sessions recorded).`,
      averageNapMinutes: null,
      shortestNapMinutes: null,
      longestNapMinutes: null,
      totalNapMinutes: 0,
      napDaysCount: 0
    };
  }

  const napDurations = napSessions.map(s => s.timeInBedMinutes || calculateTimeInBedMinutes(s.startTimestamp, s.endTimestamp));
  const totalNapMinutes = napDurations.reduce((a, b) => a + b, 0);
  const averageNapMinutes = Math.round(totalNapMinutes / napCount);
  const shortestNapMinutes = Math.min(...napDurations);
  const longestNapMinutes = Math.max(...napDurations);

  const uniqueNapDates = new Set(napSessions.map(s => s.wakeDate));

  return {
    hasNaps: true,
    napCount,
    mainCount,
    napDaysCount: uniqueNapDates.size,
    totalNapMinutes,
    averageNapMinutes,
    formattedAverage: formatMinutes(averageNapMinutes),
    shortestNapMinutes,
    longestNapMinutes,
    summaryText: `${napCount} daytime nap${napCount > 1 ? 's' : ''} recorded across ${uniqueNapDates.size} days, averaging ${formatMinutes(averageNapMinutes)}.`,
    cautiousNote: 'Daytime naps provide supplementary rest. Individual response to nap timing and duration varies naturally.'
  };
}

/**
 * ---------------------------------------------------------------------
 * 4. RESTEDNESS & WAKING ENERGY RELATIONSHIPS
 * ---------------------------------------------------------------------
 */

/**
 * Pairwise comparison of recorded sleep duration vs reported waking energy and restedness.
 * Only compares compatible observations where numeric ratings exist.
 *
 * @param {Array} sessions
 * @returns {Object} Valid observation pairs, distribution, and cautious framing
 */
export function calculateRestednessEnergyCorrelations(sessions = []) {
  // Only valid pairs with at least one rating (energy or restedness) and valid TIB
  const validPairs = [];

  for (const s of sessions) {
    const tib = s.timeInBedMinutes || calculateTimeInBedMinutes(s.startTimestamp, s.endTimestamp);
    if (!tib || tib <= 0) continue;

    const hasEnergy = Number.isInteger(s.energyRating) && s.energyRating >= 1 && s.energyRating <= 5;
    const hasRested = Number.isInteger(s.restednessRating) && s.restednessRating >= 1 && s.restednessRating <= 5;

    if (hasEnergy || hasRested) {
      const est = calculateEstimatedSleepDuration(s);
      validPairs.push({
        id: s.id,
        wakeDate: s.wakeDate,
        sessionType: s.sessionType,
        timeInBedMinutes: tib,
        estimatedSleepMinutes: est.hasEstimate ? est.estimatedMinutes : null,
        energyRating: hasEnergy ? s.energyRating : null,
        restednessRating: hasRested ? s.restednessRating : null
      });
    }
  }

  const sampleSize = validPairs.length;
  const thresholdRequired = 4;

  if (sampleSize < thresholdRequired) {
    return {
      hasSufficientData: false,
      sampleSize,
      thresholdRequired,
      reason: `Requires at least ${thresholdRequired} recorded sessions with energy or restedness ratings to identify distributions (currently ${sampleSize} recorded).`,
      energyGroups: [],
      pairs: []
    };
  }

  // Group by energy rating (1 to 5)
  const energyGroups = [];
  for (let rating = 1; rating <= 5; rating++) {
    const matching = validPairs.filter(p => p.energyRating === rating);
    const count = matching.length;
    let avgTib = null;
    if (count > 0) {
      avgTib = Math.round(matching.reduce((acc, p) => acc + p.timeInBedMinutes, 0) / count);
    }
    energyGroups.push({
      rating,
      count,
      averageTibMinutes: avgTib,
      formattedAverageTib: formatMinutes(avgTib)
    });
  }

  return {
    hasSufficientData: true,
    sampleSize,
    energyGroups,
    pairs: validPairs,
    cautiousDisclaimer: `Observed across ${sampleSize} recorded sessions. Restedness and energy are subjective self-assessments influenced by daytime activity, nutrition, and stress in addition to sleep duration.`
  };
}

/**
 * ---------------------------------------------------------------------
 * 5. LIFESTYLE HABIT ASSOCIATIONS
 * ---------------------------------------------------------------------
 */

/**
 * Compare sleep outcomes across recorded lifestyle habits (caffeine, late screen, daytime stress).
 * Strictly distinguishes 'not_recorded' from 'no'.
 * Requires at least 3 records in both compared groups before presenting comparison.
 *
 * @param {Array} sessions
 * @param {Array} habits
 * @returns {Object} Habit comparative breakdowns
 */
export function calculateHabitAssociations(sessions = [], habits = []) {
  // Index habits by date
  const habitsMap = new Map();
  for (const h of habits) {
    habitsMap.set(h.date, h);
  }

  // Group main sessions by habit on that wakeDate
  const mainSessions = sessions.filter(s => s.sessionType === 'main');

  // 1. Caffeine Comparison
  const caffeineComparison = analyzeBinaryHabit({
    sessions: mainSessions,
    habitsMap,
    habitKey: 'caffeine',
    labelYes: 'Caffeine past cutoff',
    labelNo: 'No caffeine past cutoff',
    metricExtractor: (session) => ({
      tib: session.timeInBedMinutes || calculateTimeInBedMinutes(session.startTimestamp, session.endTimestamp),
      latency: session.latencyMinutes !== null && session.latencyMinutes !== undefined ? Number(session.latencyMinutes) : null,
      awakenings: session.awakeningsCount !== null && session.awakeningsCount !== undefined ? Number(session.awakeningsCount) : null
    })
  });

  // 2. Late Screen Use Comparison
  const screenComparison = analyzeBinaryHabit({
    sessions: mainSessions,
    habitsMap,
    habitKey: 'screenLate',
    labelYes: 'Screen use < 1h of bed',
    labelNo: 'No late screen use',
    metricExtractor: (session) => ({
      tib: session.timeInBedMinutes || calculateTimeInBedMinutes(session.startTimestamp, session.endTimestamp),
      latency: session.latencyMinutes !== null && session.latencyMinutes !== undefined ? Number(session.latencyMinutes) : null,
      awakenings: session.awakeningsCount !== null && session.awakeningsCount !== undefined ? Number(session.awakeningsCount) : null
    })
  });

  // 3. Daytime Stress Comparison (High: rating 4-5 vs Moderate/Low: rating 1-3)
  const stressComparison = analyzeStressHabit({
    sessions: mainSessions,
    habitsMap
  });

  return {
    caffeine: caffeineComparison,
    screen: screenComparison,
    stress: stressComparison,
    cautiousDisclaimer: 'Habit comparisons reflect personal recorded observations in these specific sessions. They do not demonstrate direct biological causation.'
  };
}

/**
 * Helper to analyze 3-state binary habit ('yes', 'no', 'not_recorded')
 */
function analyzeBinaryHabit({ sessions, habitsMap, habitKey, labelYes, labelNo, metricExtractor }) {
  const yesList = [];
  const noList = [];
  let unrecordedCount = 0;

  for (const s of sessions) {
    const habit = habitsMap.get(s.wakeDate);
    if (!habit || !habit[habitKey] || habit[habitKey] === 'not_recorded') {
      unrecordedCount++;
      continue;
    }
    const metrics = metricExtractor(s);
    if (habit[habitKey] === 'yes') {
      yesList.push(metrics);
    } else if (habit[habitKey] === 'no') {
      noList.push(metrics);
    }
  }

  const yesCount = yesList.length;
  const noCount = noList.length;
  const minRequired = 3;
  const hasSufficientData = yesCount >= minRequired && noCount >= minRequired;

  const computeGroupStats = (list) => {
    if (list.length === 0) return null;
    const avgTib = Math.round(list.reduce((acc, m) => acc + m.tib, 0) / list.length);
    const validLatencies = list.map(m => m.latency).filter(lat => lat !== null && Number.isFinite(lat));
    const avgLatency = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : null;
    const validAwk = list.map(m => m.awakenings).filter(a => a !== null && Number.isFinite(a));
    const avgAwk = validAwk.length > 0
      ? Number((validAwk.reduce((a, b) => a + b, 0) / validAwk.length).toFixed(1))
      : null;

    return {
      count: list.length,
      avgTib,
      formattedTib: formatMinutes(avgTib),
      avgLatency,
      formattedLatency: avgLatency !== null ? `${avgLatency}m` : '--',
      avgAwakenings: avgAwk
    };
  };

  const yesStats = computeGroupStats(yesList);
  const noStats = computeGroupStats(noList);

  return {
    habitKey,
    labelYes,
    labelNo,
    yesCount,
    noCount,
    unrecordedCount,
    minRequired,
    hasSufficientData,
    reason: !hasSufficientData
      ? `Sample size is too small for a meaningful comparison (${yesCount} 'Yes' vs ${noCount} 'No' recorded; requires at least ${minRequired} nights in each group).`
      : null,
    yesStats,
    noStats
  };
}

/**
 * Helper to analyze stress rating (High 4-5 vs Low/Moderate 1-3)
 */
function analyzeStressHabit({ sessions, habitsMap }) {
  const highStress = [];
  const lowStress = [];
  let unrecordedCount = 0;

  for (const s of sessions) {
    const habit = habitsMap.get(s.wakeDate);
    if (!habit || habit.stressRating === null || habit.stressRating === undefined) {
      unrecordedCount++;
      continue;
    }
    const tib = s.timeInBedMinutes || calculateTimeInBedMinutes(s.startTimestamp, s.endTimestamp);
    const latency = s.latencyMinutes !== null && s.latencyMinutes !== undefined ? Number(s.latencyMinutes) : null;
    const metrics = { tib, latency };

    if (habit.stressRating >= 4) {
      highStress.push(metrics);
    } else {
      lowStress.push(metrics);
    }
  }

  const highCount = highStress.length;
  const lowCount = lowStress.length;
  const minRequired = 3;
  const hasSufficientData = highCount >= minRequired && lowCount >= minRequired;

  const computeAvg = (list) => {
    if (list.length === 0) return null;
    const avgTib = Math.round(list.reduce((acc, m) => acc + m.tib, 0) / list.length);
    const validLatencies = list.map(m => m.latency).filter(lat => lat !== null && Number.isFinite(lat));
    const avgLatency = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : null;
    return {
      count: list.length,
      avgTib,
      formattedTib: formatMinutes(avgTib),
      avgLatency,
      formattedLatency: avgLatency !== null ? `${avgLatency}m` : '--'
    };
  };

  return {
    labelHigh: 'High stress (Rating 4–5)',
    labelLow: 'Low/Moderate stress (Rating 1–3)',
    highCount,
    lowCount,
    unrecordedCount,
    minRequired,
    hasSufficientData,
    reason: !hasSufficientData
      ? `Sample size is too small for comparison (${highCount} high vs ${lowCount} low/moderate recorded; requires at least ${minRequired} nights in each group).`
      : null,
    highStats: computeAvg(highStress),
    lowStats: computeAvg(lowStress)
  };
}

/**
 * ---------------------------------------------------------------------
 * 6. BEHAVIOURAL EXPERIMENT PROGRESS & OBSERVATIONS
 * ---------------------------------------------------------------------
 */

/**
 * Pre-configured science-grounded behavioral experiment catalog
 */
export const EXPERIMENT_CATALOG = [
  {
    protocolId: 'caffeine_cutoff',
    title: 'Afternoon Caffeine Cutoff (2:00 PM)',
    hypothesis: 'Limiting caffeine intake after 14:00 may shorten sleep onset latency and reduce nighttime awakenings due to the 5–7 hour half-life of caffeine.',
    behaviorToChange: 'Avoid coffee, tea, energy drinks, and caffeinated sodas after 2:00 PM for 7 days.',
    outcomeToObserve: 'Sleep latency (minutes to fall asleep) and awakenings count.',
    targetDays: 7
  },
  {
    protocolId: 'screen_curfew',
    title: 'Screen-Free Wind-Down (45 min)',
    hypothesis: 'Replacing backlit electronic screens with low-stimulation activities 45 minutes before bedtime reduces light-induced melatonin suppression.',
    behaviorToChange: 'No smartphones, laptops, or bright tablets within 45 minutes of getting into bed for 7 days.',
    outcomeToObserve: 'Sleep onset latency and subjective restedness rating.',
    targetDays: 7
  },
  {
    protocolId: 'consistent_wake',
    title: 'Consistent Wake-Up Window (±20 min)',
    hypothesis: 'Waking at the same clock time every morning regardless of bedtime strengthens circadian rhythm stability.',
    behaviorToChange: 'Anchor wake-up alarm to the exact same 20-minute window for 7 consecutive mornings.',
    outcomeToObserve: 'Morning waking energy rating and natural evening sleepiness onset.',
    targetDays: 7
  },
  {
    protocolId: 'cool_environment',
    title: 'Comfortably Cool Sleep Space',
    hypothesis: 'Sleeping in a comfortably cool, well-ventilated room facilitates the physiological 1°C drop in core body temperature required for sleep initiation.',
    behaviorToChange: 'Lower bedroom temperature slightly or adjust ventilation and bedding for 7 consecutive nights.',
    outcomeToObserve: 'Frequency of middle-of-the-night awakenings and restedness.',
    targetDays: 7
  }
];

/**
 * Analyze an active or completed experiment against real logged sleep sessions
 */
export function analyzeExperimentProgress(experiment, sessions = []) {
  if (!experiment) return null;

  const startDate = experiment.startedAt;
  const targetDays = experiment.targetDays || 7;
  const todayStr = formatLocalDate(new Date());

  // Sessions logged during the experiment's observation period
  const expSessions = sessions.filter(s => {
    return s.wakeDate >= startDate && (experiment.targetEndDate ? s.wakeDate <= experiment.targetEndDate : true);
  });

  const uniqueLoggedDays = new Set(expSessions.map(s => s.wakeDate));
  const loggedDaysCount = uniqueLoggedDays.size;

  // Calculate elapsed days
  const startMs = new Date(startDate).getTime();
  const nowMs = new Date(todayStr).getTime();
  const elapsedDays = Math.max(1, Math.min(targetDays, Math.round((nowMs - startMs) / (24 * 60 * 60 * 1000)) + 1));

  // Average metrics during experiment
  const latencies = expSessions.map(s => s.latencyMinutes).filter(l => l !== null && Number.isFinite(l));
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

  const energyRatings = expSessions.map(s => s.energyRating).filter(e => e !== null && Number.isFinite(e));
  const avgEnergy = energyRatings.length > 0 ? Number((energyRatings.reduce((a, b) => a + b, 0) / energyRatings.length).toFixed(1)) : null;

  return {
    protocolId: experiment.protocolId,
    title: experiment.title,
    status: experiment.status,
    startDate,
    targetEndDate: experiment.targetEndDate,
    targetDays,
    elapsedDays,
    loggedDaysCount,
    progressPercent: Math.min(100, Math.round((loggedDaysCount / targetDays) * 100)),
    avgLatencyDuringExp: avgLatency,
    formattedAvgLatency: avgLatency !== null ? `${avgLatency}m` : '--',
    avgEnergyDuringExp: avgEnergy,
    hasObservations: expSessions.length > 0
  };
}
