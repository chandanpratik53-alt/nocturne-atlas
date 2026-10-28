// src/services/calculations.js
// Nocturne Atlas — Sleep Calculations, Interval Unions, & Validation
// Pure, deterministic, zero-dependency functions.

/**
 * Format a Date object or timestamp as local YYYY-MM-DD string
 * Uses local time components to avoid UTC shift errors.
 */
export function formatLocalDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format minutes into human-readable "Xh Ym" or "Ym"
 */
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes) || minutes < 0) {
    return '--';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/**
 * Format 24-hour time "HH:mm" from a Date or timestamp string in local time
 */
export function formatLocalTime(dateInput) {
  if (!dateInput) return '--:--';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '--:--';
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hrs}:${mins}`;
}

/**
 * Calculate Time In Bed (TIB) in integer minutes
 */
export function calculateTimeInBedMinutes(startTimestamp, endTimestamp) {
  const start = Number(startTimestamp);
  const end = Number(endTimestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.round((end - start) / 60000);
}

/**
 * Calculate Estimated Sleep Duration according to strict chronobiology rules:
 * - If latency is missing: unavailable (never invent latency).
 * - If latency is present: TIB - latency - (awakeAfterOnset || 0).
 * - If awakeAfterOnset is missing: explicit partial estimate.
 * - Never infer awake duration from awakening count.
 * - Negative resulting estimate is invalid.
 */
export function calculateEstimatedSleepDuration({
  timeInBedMinutes,
  latencyMinutes,
  awakeAfterOnsetMinutes
}) {
  const tib = Number(timeInBedMinutes);
  if (!Number.isFinite(tib) || tib <= 0) {
    return {
      estimatedMinutes: null,
      formatted: '--',
      hasEstimate: false,
      status: 'invalid',
      assumption: 'Invalid time in bed.'
    };
  }

  // Latency is required to estimate sleep duration
  const hasLatency = latencyMinutes !== null && latencyMinutes !== undefined && latencyMinutes !== '';
  if (!hasLatency) {
    return {
      estimatedMinutes: null,
      formatted: '--',
      hasEstimate: false,
      status: 'unavailable',
      assumption: 'Estimated sleep duration is unavailable because sleep latency (time to fall asleep) was not recorded.'
    };
  }

  const latNum = Number(latencyMinutes);
  if (!Number.isFinite(latNum) || latNum < 0) {
    return {
      estimatedMinutes: null,
      formatted: '--',
      hasEstimate: false,
      status: 'invalid',
      assumption: 'Latency must be a non-negative number.'
    };
  }

  const hasWasos = awakeAfterOnsetMinutes !== null && awakeAfterOnsetMinutes !== undefined && awakeAfterOnsetMinutes !== '';
  const wasoNum = hasWasos ? Number(awakeAfterOnsetMinutes) : 0;
  if (hasWasos && (!Number.isFinite(wasoNum) || wasoNum < 0)) {
    return {
      estimatedMinutes: null,
      formatted: '--',
      hasEstimate: false,
      status: 'invalid',
      assumption: 'Awake time after onset must be a non-negative number.'
    };
  }

  const totalAwakeKnown = latNum + wasoNum;
  if (totalAwakeKnown > tib) {
    return {
      estimatedMinutes: null,
      formatted: '--',
      hasEstimate: false,
      status: 'invalid',
      assumption: `Combined awake time (${totalAwakeKnown}m) exceeds time in bed (${tib}m).`
    };
  }

  const estimatedMinutes = tib - totalAwakeKnown;

  if (hasWasos) {
    return {
      estimatedMinutes,
      formatted: formatMinutes(estimatedMinutes),
      hasEstimate: true,
      status: 'complete_estimate',
      assumption: `Accounts for ${latNum}m sleep latency and ${wasoNum}m awake after onset.`
    };
  }

  return {
    estimatedMinutes,
    formatted: formatMinutes(estimatedMinutes),
    hasEstimate: true,
    status: 'partial_estimate',
    assumption: `Accounts for ${latNum}m sleep latency; does not account for unmeasured awake periods after falling asleep.`
  };
}

/**
 * Calculate Sleep Efficiency (%)
 * Only calculated when estimated sleep duration is present.
 */
export function calculateSleepEfficiency(timeInBedMinutes, estimatedSleepMinutes) {
  const tib = Number(timeInBedMinutes);
  const sleep = Number(estimatedSleepMinutes);
  if (!Number.isFinite(tib) || tib <= 0 || !Number.isFinite(sleep) || sleep <= 0 || sleep > tib) {
    return {
      efficiencyPercent: null,
      formatted: '--%',
      hasEfficiency: false,
      label: 'Unavailable'
    };
  }
  const pct = Math.round((sleep / tib) * 100);
  return {
    efficiencyPercent: pct,
    formatted: `${pct}%`,
    hasEfficiency: true,
    label: 'Estimated Efficiency'
  };
}

/**
 * Validate session data before saving.
 * Returns { isValid, errors, warnings, sanitized }
 */
export function validateSessionData(data) {
  const errors = {};
  const warnings = [];

  // Required start and wake timestamps
  if (!data.startTime) {
    errors.startTime = 'Start date and time is required.';
  }
  if (!data.endTime) {
    errors.endTime = 'Wake-up date and time is required.';
  }

  const startTimestamp = data.startTime ? new Date(data.startTime).getTime() : NaN;
  const endTimestamp = data.endTime ? new Date(data.endTime).getTime() : NaN;

  if (Number.isNaN(startTimestamp)) {
    errors.startTime = 'Invalid start date/time format.';
  }
  if (Number.isNaN(endTimestamp)) {
    errors.endTime = 'Invalid wake-up date/time format.';
  }

  let timeInBedMinutes = 0;
  if (!Number.isNaN(startTimestamp) && !Number.isNaN(endTimestamp)) {
    if (endTimestamp <= startTimestamp) {
      errors.endTime = 'Wake-up time must be strictly later than start time.';
    } else {
      timeInBedMinutes = calculateTimeInBedMinutes(startTimestamp, endTimestamp);
      if (timeInBedMinutes < 10) {
        warnings.push(`Session duration is very brief (${timeInBedMinutes} minutes).`);
      } else if (timeInBedMinutes > 14 * 60) {
        warnings.push(`Unusually long session: ${formatMinutes(timeInBedMinutes)} in bed.`);
      }
    }
  }

  // Session Type
  const validTypes = ['main', 'nap', 'other'];
  const sessionType = validTypes.includes(data.sessionType) ? data.sessionType : 'main';

  // Optional numeric fields (do not convert empty/blank to 0)
  let latencyMinutes = null;
  if (data.latencyMinutes !== null && data.latencyMinutes !== undefined && data.latencyMinutes !== '') {
    const lat = Number(data.latencyMinutes);
    if (!Number.isFinite(lat) || lat < 0) {
      errors.latencyMinutes = 'Latency must be 0 or a positive number of minutes.';
    } else {
      latencyMinutes = Math.round(lat);
    }
  }

  let awakeAfterOnsetMinutes = null;
  if (data.awakeAfterOnsetMinutes !== null && data.awakeAfterOnsetMinutes !== undefined && data.awakeAfterOnsetMinutes !== '') {
    const waso = Number(data.awakeAfterOnsetMinutes);
    if (!Number.isFinite(waso) || waso < 0) {
      errors.awakeAfterOnsetMinutes = 'Awake time must be 0 or a positive number of minutes.';
    } else {
      awakeAfterOnsetMinutes = Math.round(waso);
    }
  }

  let awakeningsCount = null;
  if (data.awakeningsCount !== null && data.awakeningsCount !== undefined && data.awakeningsCount !== '') {
    const awk = Number(data.awakeningsCount);
    if (!Number.isFinite(awk) || awk < 0 || !Number.isInteger(awk)) {
      errors.awakeningsCount = 'Awakenings count must be an integer 0 or greater.';
    } else {
      awakeningsCount = awk;
    }
  }

  // Ratings 1-5 integer
  let restednessRating = null;
  if (data.restednessRating !== null && data.restednessRating !== undefined && data.restednessRating !== '') {
    const r = Number(data.restednessRating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      errors.restednessRating = 'Restedness rating must be an integer between 1 and 5.';
    } else {
      restednessRating = r;
    }
  }

  let energyRating = null;
  if (data.energyRating !== null && data.energyRating !== undefined && data.energyRating !== '') {
    const e = Number(data.energyRating);
    if (!Number.isInteger(e) || e < 1 || e > 5) {
      errors.energyRating = 'Energy rating must be an integer between 1 and 5.';
    } else {
      energyRating = e;
    }
  }

  // Cross-field: Awake + Latency <= TIB
  if (timeInBedMinutes > 0) {
    const knownAwake = (latencyMinutes || 0) + (awakeAfterOnsetMinutes || 0);
    if (knownAwake > timeInBedMinutes) {
      errors.awakeAfterOnsetMinutes = `Total awake time (${knownAwake}m) cannot exceed time in bed (${timeInBedMinutes}m).`;
    }
  }

  // Attribution date is local wake-up date
  const wakeDate = endTimestamp ? formatLocalDate(new Date(endTimestamp)) : '';

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
    sanitized: {
      sessionType,
      startTime: data.startTime,
      endTime: data.endTime,
      startTimestamp,
      endTimestamp,
      wakeDate,
      timeInBedMinutes,
      latencyMinutes,
      awakeAfterOnsetMinutes,
      awakeningsCount,
      restednessRating,
      energyRating,
      notes: typeof data.notes === 'string' ? data.notes.trim() : ''
    }
  };
}

/**
 * Determine if two intervals overlap
 * Overlaps if max(start1, start2) < min(end1, end2)
 */
export function doIntervalsOverlap(start1, end1, start2, end2) {
  return Math.max(Number(start1), Number(start2)) < Math.min(Number(end1), Number(end2));
}

/**
 * Find all existing sessions that overlap with the candidate session
 */
export function findOverlappingSessions(candidate, existingSessions) {
  if (!candidate || !existingSessions || !Array.isArray(existingSessions)) return [];
  const candStart = Number(candidate.startTimestamp || new Date(candidate.startTime).getTime());
  const candEnd = Number(candidate.endTimestamp || new Date(candidate.endTime).getTime());

  if (!Number.isFinite(candStart) || !Number.isFinite(candEnd) || candEnd <= candStart) {
    return [];
  }

  const overlaps = [];
  for (const session of existingSessions) {
    // Skip if it's the same record being edited
    if (candidate.id && session.id === candidate.id) continue;

    const sStart = Number(session.startTimestamp || new Date(session.startTime).getTime());
    const sEnd = Number(session.endTimestamp || new Date(session.endTime).getTime());

    if (doIntervalsOverlap(candStart, candEnd, sStart, sEnd)) {
      const overlapStart = Math.max(candStart, sStart);
      const overlapEnd = Math.min(candEnd, sEnd);
      const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

      overlaps.push({
        session,
        overlapStart,
        overlapEnd,
        overlapMinutes,
        overlapStartFormatted: formatLocalTime(new Date(overlapStart)),
        overlapEndFormatted: formatLocalTime(new Date(overlapEnd))
      });
    }
  }

  return overlaps;
}

/**
 * Interval-Union Deduplication:
 * Calculates total non-overlapping elapsed minutes across an array of time intervals.
 * Never counts the same real-world interval twice.
 */
export function calculateIntervalUnionMinutes(intervals) {
  if (!intervals || !Array.isArray(intervals) || intervals.length === 0) {
    return 0;
  }

  const validIntervals = intervals
    .map((item) => {
      const start = Number(item.start ?? item.startTimestamp ?? (item.startTime ? new Date(item.startTime).getTime() : NaN));
      const end = Number(item.end ?? item.endTimestamp ?? (item.endTime ? new Date(item.endTime).getTime() : NaN));
      return [start, end];
    })
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);

  if (validIntervals.length === 0) return 0;

  // Merge overlapping and contiguous intervals
  const merged = [validIntervals[0]];
  for (let i = 1; i < validIntervals.length; i++) {
    const current = validIntervals[i];
    const last = merged[merged.length - 1];

    if (current[0] <= last[1]) {
      // Overlapping or touching: extend the end of the previous interval
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  // Sum total non-overlapping milliseconds
  const totalMs = merged.reduce((acc, [s, e]) => acc + (e - s), 0);
  return Math.round(totalMs / 60000);
}

/**
 * Aggregate daily sleep summary for a given wake-up date
 */
export function aggregateWakeDateSessions(sessions, targetWakeDate) {
  if (!sessions || !Array.isArray(sessions)) {
    return {
      wakeDate: targetWakeDate,
      sessions: [],
      mainSleepCount: 0,
      napCount: 0,
      rawSumMinutes: 0,
      deduplicatedMinutes: 0,
      hasOverlap: false
    };
  }

  const matchingSessions = sessions.filter((s) => s.wakeDate === targetWakeDate);
  const mainSleepCount = matchingSessions.filter((s) => s.sessionType === 'main').length;
  const napCount = matchingSessions.filter((s) => s.sessionType === 'nap').length;

  const rawSumMinutes = matchingSessions.reduce((sum, s) => sum + (s.timeInBedMinutes || 0), 0);
  const deduplicatedMinutes = calculateIntervalUnionMinutes(matchingSessions);

  return {
    wakeDate: targetWakeDate,
    sessions: matchingSessions,
    mainSleepCount,
    napCount,
    rawSumMinutes,
    deduplicatedMinutes,
    hasOverlap: rawSumMinutes > deduplicatedMinutes
  };
}
