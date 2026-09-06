/**
 * Remembered birth details.
 *
 * This is the one place the app keeps anything about a person, so it gets
 * tested properly: that both records round-trip, that they stay separate, that
 * Forget really forgets, and — most importantly — that a corrupt or
 * older-format value degrades to "nothing saved" rather than crashing the page
 * or feeding a malformed birth into the engine.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  loadSelf, saveSelf, loadPartner, savePartner, forgetAll, hasSaved,
  type SavedBirth,
} from '../src/storage';

/**
 * A minimal localStorage. The module runs in the browser; the tests do not,
 * and the point of the exercise is the parsing and validation logic.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const store = new MemoryStorage();
const originalWindow = (globalThis as { window?: unknown }).window;
(globalThis as { window?: unknown }).window = { localStorage: store };

afterAll(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
});

beforeEach(() => store.clear());

const me: SavedBirth = {
  date: '1990-06-15', time: '14:30', gender: 'male',
  placeIndex: 0, timeKnown: true, useTrueSolarTime: true,
};
const them: SavedBirth = {
  date: '1992-11-03', time: '09:00', gender: 'female',
  placeIndex: 46, timeKnown: true, useTrueSolarTime: true, label: 'Karin',
};

describe('remembering a birth', () => {
  it('starts with nothing saved', () => {
    expect(loadSelf()).toBeNull();
    expect(loadPartner()).toBeNull();
    expect(hasSaved()).toBe(false);
  });

  it('round-trips your own details', () => {
    saveSelf(me);
    expect(loadSelf()).toEqual(me);
    expect(hasSaved()).toBe(true);
  });

  it("round-trips a partner's details, including the label", () => {
    savePartner(them);
    const back = loadPartner();
    expect(back).toEqual(them);
    expect(back!.label).toBe('Karin');
    expect(back!.placeIndex).toBe(46);
  });

  it('keeps the two records separate', () => {
    saveSelf(me);
    savePartner(them);
    expect(loadSelf()!.date).toBe('1990-06-15');
    expect(loadPartner()!.date).toBe('1992-11-03');
    expect(loadSelf()!.label).toBeUndefined();
  });

  it('overwrites rather than accumulating', () => {
    savePartner(them);
    savePartner({ ...them, date: '1993-01-01', label: 'someone else' });
    expect(loadPartner()!.date).toBe('1993-01-01');
    expect(loadPartner()!.label).toBe('someone else');
  });

  it('forgets both records', () => {
    saveSelf(me);
    savePartner(them);
    forgetAll();
    expect(loadSelf()).toBeNull();
    expect(loadPartner()).toBeNull();
    expect(hasSaved()).toBe(false);
  });

  it('reports hasSaved when only one side is stored', () => {
    savePartner(them);
    expect(hasSaved()).toBe(true);
    forgetAll();
    saveSelf(me);
    expect(hasSaved()).toBe(true);
  });
});

describe('surviving bad stored data', () => {
  // A stored value can be from an older version of the app, hand-edited, or
  // truncated. None of those may reach the engine as a birth input.
  const bad: readonly [string, string][] = [
    ['not json at all', '{{{'],
    ['an empty object', '{}'],
    ['a missing date', JSON.stringify({ gender: 'male' })],
    ['a malformed date', JSON.stringify({ date: '15/06/1990', gender: 'male' })],
    ['a bogus gender', JSON.stringify({ date: '1990-06-15', gender: 'other' })],
    ['a null', 'null'],
    ['an array', '[]'],
  ];

  for (const [label, raw] of bad) {
    it(`treats ${label} as nothing saved`, () => {
      store.setItem('bazi_partner', raw);
      expect(() => loadPartner()).not.toThrow();
      expect(loadPartner()).toBeNull();
    });
  }

  it('fills in sensible defaults for missing optional fields', () => {
    store.setItem('bazi_self', JSON.stringify({ date: '1990-06-15', gender: 'female' }));
    const back = loadSelf()!;
    expect(back.time).toBe('');
    expect(back.placeIndex).toBe(0);
    // Absent booleans mean "not explicitly disabled", so both default on.
    expect(back.timeKnown).toBe(true);
    expect(back.useTrueSolarTime).toBe(true);
  });

  it('honours an explicitly false flag rather than defaulting it on', () => {
    store.setItem('bazi_self', JSON.stringify({
      date: '1990-06-15', gender: 'male', timeKnown: false, useTrueSolarTime: false,
    }));
    const back = loadSelf()!;
    expect(back.timeKnown).toBe(false);
    expect(back.useTrueSolarTime).toBe(false);
  });

  it('rejects a non-integer place index rather than passing it through', () => {
    store.setItem('bazi_self', JSON.stringify({
      date: '1990-06-15', gender: 'male', placeIndex: 'nope',
    }));
    expect(loadSelf()!.placeIndex).toBe(0);
  });
});
