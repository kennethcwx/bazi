/**
 * Remembering birth details, on the device only.
 *
 * Deliberately localStorage rather than a server record. Birth data is the
 * whole of what this app knows about someone, and there is no feature here
 * that needs it to leave their phone — an account system would be storing
 * other people's dates of birth for no benefit to them.
 *
 * Consequences worth stating plainly, because they are the honest trade:
 * this does not sync between devices, and clearing site data loses it. Both
 * are acceptable; silently building a profile database would not be.
 */

const SELF_KEY = 'bazi_self';
const PARTNER_KEY = 'bazi_partner';

export interface SavedBirth {
  readonly date: string;          // YYYY-MM-DD
  readonly time: string;          // HH:MM, empty when unknown
  readonly gender: 'male' | 'female';
  readonly placeIndex: number;
  readonly timeKnown: boolean;
  readonly useTrueSolarTime: boolean;
  /** Optional label, used for the partner card. */
  readonly label?: string;
}

/**
 * Every access is wrapped: storage throws outright in some privacy modes and
 * in embedded webviews. Losing a remembered birthday is a small annoyance;
 * a blank page because a getter threw is not.
 */
function read(key: string): SavedBirth | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedBirth>;
    // Validate rather than trust: this survives a format change without
    // crashing on whatever an older version wrote.
    if (typeof parsed.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return null;
    if (parsed.gender !== 'male' && parsed.gender !== 'female') return null;
    return {
      date: parsed.date,
      time: typeof parsed.time === 'string' ? parsed.time : '',
      gender: parsed.gender,
      placeIndex: Number.isInteger(parsed.placeIndex) ? parsed.placeIndex as number : 0,
      timeKnown: parsed.timeKnown !== false,
      useTrueSolarTime: parsed.useTrueSolarTime !== false,
      ...(typeof parsed.label === 'string' ? { label: parsed.label } : {}),
    };
  } catch {
    return null;
  }
}

function write(key: string, value: SavedBirth | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full. The app works without it.
  }
}

export const loadSelf = (): SavedBirth | null => read(SELF_KEY);
export const saveSelf = (v: SavedBirth): void => write(SELF_KEY, v);

export const loadPartner = (): SavedBirth | null => read(PARTNER_KEY);
export const savePartner = (v: SavedBirth): void => write(PARTNER_KEY, v);

/** Forget everything. Offered in the UI so the promise above is keepable. */
export function forgetAll(): void {
  write(SELF_KEY, null);
  write(PARTNER_KEY, null);
}

export const hasSaved = (): boolean => loadSelf() !== null || loadPartner() !== null;
