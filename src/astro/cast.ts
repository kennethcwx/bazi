/**
 * One birth in → one natal chart out, from the shape the pages POST:
 * { date: 'YYYY-MM-DD', time: 'HH:MM', timeKnown, placeIndex }.
 * Shared by /api/natal and /api/synastry so two charts are cast identically.
 */

import { computeNatal, type NatalChart } from './natal';
import { wallClockToInstant } from '../engine/moment';
import { PLACES } from '../places';

export interface BirthInput {
  date?: unknown; time?: unknown; timeKnown?: unknown; placeIndex?: unknown;
}

export function castBirth(body: BirthInput): { chart: NatalChart; timeKnown: boolean } | null {
  const m = typeof body.date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.date) : null;
  const place = typeof body.placeIndex === 'number' ? PLACES[body.placeIndex] : undefined;
  if (!m || !place) return null;
  const timeKnown = body.timeKnown !== false && typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time);
  // Without a time, noon: the Moon moves ~13° a day, so this keeps it within
  // about a sign's fifth of the truth, and everything else barely moves.
  const [hour, minute] = timeKnown ? (body.time as string).split(':').map(Number) : [12, 0];
  const { instantMs } = wallClockToInstant(
    { year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: hour!, minute: minute! },
    place.tz,
  );
  return { chart: computeNatal({ instantMs, lat: place.lat, lon: place.lon, timeKnown }), timeKnown };
}
