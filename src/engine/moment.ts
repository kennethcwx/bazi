/**
 * Birth-moment resolution: a human's claim about when they were born, turned
 * into the instant that should actually be charted.
 *
 * This module exists because almost every "wrong chart" complaint traces back
 * here rather than to the calendar maths. Four things go wrong in practice:
 *
 *  1. Historical UTC offsets. Singapore ran on +07:30 until 1981-12-31 and
 *     moved to +08:00 on 1982-01-01; China observed DST from 1986-1991. A naive
 *     fixed +08:00 puts a chunk of the parent generation half an hour out, which
 *     is enough to move the hour pillar a whole 时辰.
 *  2. Sub-minute offsets. Before standard time reached a place it kept local
 *     mean time to the second — Singapore was GMT+06:55:25 until 1901. Offsets
 *     are therefore tracked in seconds, not minutes.
 *  3. 真太阳时. Civil time is a political fiction; the pillars follow the sun.
 *  4. Unknown birth time, silently defaulted to noon. We refuse to guess.
 *
 * Historical offsets come from the platform ICU tz database via Intl, so there
 * is no dependency to keep current.
 */

import type { CivilTime, MomentNote, ResolvedMoment } from './types';

/**
 * Parse the offset that `timeZoneName: 'longOffset'` reports, in seconds.
 *
 * The seconds component is not decoration: pre-standard-time zones really do
 * report values like "GMT+06:55:25", and dropping the field silently shifts
 * such a birth by up to a minute.
 */
function offsetSecondsAt(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(instantMs));

  const raw = parts.find((p) => p.type === 'timeZoneName')?.value;
  if (!raw) throw new Error(`Cannot resolve offset for time zone "${timeZone}"`);

  const m = /^GMT([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) {
    if (raw === 'GMT') return 0;
    throw new Error(`Unrecognised offset "${raw}" for time zone "${timeZone}"`);
  }
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] ?? 0));
}

/**
 * Convert a local wall clock reading to a UTC instant.
 *
 * Inverting a tz lookup needs iteration: the offset depends on the instant, and
 * the instant depends on the offset. Two passes settle every real case
 * including DST transitions; the second pass is what catches a wall clock that
 * lands near a jump.
 *
 * Ambiguous wall clocks (the repeated hour when clocks go back) resolve to the
 * earlier, standard-time instant, which is the convention civil records use.
 */
export function wallClockToInstant(civil: CivilTime, timeZone: string): {
  instantMs: number;
  offsetSeconds: number;
} {
  const asIfUtc = Date.UTC(
    civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, 0,
  );

  let offsetSeconds = offsetSecondsAt(asIfUtc, timeZone);
  for (let i = 0; i < 2; i++) {
    const candidate = asIfUtc - offsetSeconds * 1000;
    const refined = offsetSecondsAt(candidate, timeZone);
    if (refined === offsetSeconds) break;
    offsetSeconds = refined;
  }

  return { instantMs: asIfUtc - offsetSeconds * 1000, offsetSeconds };
}

/** The zone's offset today, used only to tell the user when history differs. */
function presentDayOffsetSeconds(timeZone: string): number {
  return offsetSecondsAt(Date.now(), timeZone);
}

/**
 * Equation of time, in minutes (NOAA's approximation, good to ~0.1 min).
 *
 * The sun runs ahead of or behind mean clock time by up to ~16 minutes over the
 * year, because Earth's orbit is elliptical and its axis is tilted.
 */
function equationOfTimeMinutes(instantMs: number): number {
  const d = new Date(instantMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((instantMs - start) / 86_400_000);
  const hourUtc = d.getUTCHours() + d.getUTCMinutes() / 60;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear + (hourUtc - 12) / 24);
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  );
}

/**
 * Minutes to add to civil time to reach 真太阳时.
 *
 * Local mean time is longitude x 4 minutes from UTC, so the civil-time gap is
 * that minus the zone's actual offset — deriving it from the real offset rather
 * than a hardcoded meridian is what makes this correct across the 1982 change,
 * and what makes it fall to nearly zero for pre-1901 births that were already
 * recorded in local mean time.
 *
 * The magnitude surprises people: Singapore at 103.8E on a 120E zone is about
 * -65 minutes today, and about -35 minutes pre-1982 when the zone was +07:30.
 * That is more than a 时辰 for births near a boundary, not a rounding detail.
 */
export function trueSolarCorrectionMinutes(
  instantMs: number,
  longitude: number,
  utcOffsetMinutes: number,
): number {
  const longitudeMinutes = longitude * 4;
  return longitudeMinutes - utcOffsetMinutes + equationOfTimeMinutes(instantMs);
}

function toCivil(instantMs: number, offsetSeconds: number): CivilTime {
  const shifted = new Date(instantMs + offsetSeconds * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function fmtOffset(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '+';
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return `${sign}${pad(h)}:${pad(m)}${s ? `:${pad(s)}` : ''}`;
}

export interface ResolveOptions {
  readonly timeZone: string;
  readonly longitude?: number | undefined;
  readonly useTrueSolarTime?: boolean | undefined;
}

/**
 * Resolve a birth claim into the moment to chart, with a full audit trail.
 *
 * When the birth time is unknown the caller passes noon and marks the hour
 * pillar unknown: the three knowable pillars come out right, and we never
 * present a guessed hour pillar as real.
 */
export function resolveMoment(
  civilInput: CivilTime,
  opts: ResolveOptions,
): ResolvedMoment {
  const { timeZone } = opts;
  const useTrueSolar = opts.useTrueSolarTime ?? true;
  const longitude = opts.longitude ?? null;
  const notes: MomentNote[] = [];

  const { instantMs, offsetSeconds } = wallClockToInstant(civilInput, timeZone);
  const offsetMinutes = offsetSeconds / 60;

  const presentOffset = presentDayOffsetSeconds(timeZone);
  const isHistorical = offsetSeconds !== presentOffset;
  if (isHistorical) {
    notes.push({
      code: 'historical-offset',
      timeZone,
      actualOffset: fmtOffset(offsetSeconds),
      presentOffset: fmtOffset(presentOffset),
    });
  }

  let correction = 0;
  if (useTrueSolar) {
    if (longitude === null) {
      notes.push({ code: 'true-solar-no-longitude' });
    } else {
      correction = trueSolarCorrectionMinutes(instantMs, longitude, offsetMinutes);
      notes.push({
        code: 'true-solar-applied',
        minutes: Math.round(correction * 10) / 10,
        longitude,
      });
    }
  } else {
    notes.push({ code: 'true-solar-disabled' });
  }

  const chartedInstant = instantMs + Math.round(correction) * 60_000;

  return {
    input:
      `${civilInput.year}-${pad(civilInput.month)}-${pad(civilInput.day)} ` +
      `${pad(civilInput.hour)}:${pad(civilInput.minute)}`,
    timeZone,
    utcOffsetMinutes: offsetMinutes,
    isHistoricalOffset: isHistorical,
    trueSolarCorrectionMinutes: Math.round(correction * 10) / 10,
    longitude,
    civil: toCivil(instantMs, offsetSeconds),
    charted: toCivil(chartedInstant, offsetSeconds),
    notes,
  };
}
