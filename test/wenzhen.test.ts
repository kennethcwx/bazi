/**
 * Agreement with 问真八字.
 *
 * Every fixture in test/fixtures/wenzhen.json that has been transcribed becomes
 * a permanent regression test here. Untranscribed ones are skipped rather than
 * failing — the file starts empty, and a red suite you cannot fix teaches
 * nothing.
 *
 * This is the check the whole project rests on. Invariant sweeps prove the
 * engine is self-consistent; only this proves it agrees with the tool
 * practitioners already use.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildChart } from '../src/engine/chart';
import type { BirthInput, Chart } from '../src/engine/types';

interface Case {
  label: string;
  birth: BirthInput;
  wenzhen: {
    pillars: string;
    luckStartYears: number;
    luckStartMonths: number;
    firstLuck: string;
    firstLuckAge?: number | null;
  } | null;
}

const cases: Case[] = JSON.parse(
  readFileSync(new URL('./fixtures/wenzhen.json', import.meta.url), 'utf8'),
).cases;

const pillarsOf = (c: Chart): string =>
  [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour]
    .map((p) => p?.ganZhi ?? '--').join(' ');

const transcribed = cases.filter((c) => c.wenzhen !== null);

describe('问真八字 agreement', () => {
  it('has a fixture set worth checking', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    // Every fixture must be runnable even before it is transcribed.
    for (const c of cases) expect(() => buildChart(c.birth), c.label).not.toThrow();
  });

  it.skipIf(transcribed.length === 0)(
    'agrees on every transcribed chart',
    () => {
      const failures: string[] = [];
      for (const c of transcribed) {
        const chart = buildChart(c.birth);
        const ours = pillarsOf(chart);
        const w = c.wenzhen!;
        if (ours !== w.pillars.trim()) {
          failures.push(`${c.label}: pillars ours "${ours}" vs 问真 "${w.pillars}"`);
        }
        // 起运 is an elapsed span; the age on a 大运 is 虚岁 in the year it is
        // entered. Comparing one to the other reports mismatches that are only
        // a difference of units.
        if (chart.luckStart.years !== w.luckStartYears
            || chart.luckStart.months !== w.luckStartMonths) {
          failures.push(
            `${c.label}: 起运 ours ${chart.luckStart.years}年${chart.luckStart.months}个月 ` +
            `vs 问真 ${w.luckStartYears}年${w.luckStartMonths}个月`,
          );
        }
        if (w.firstLuckAge != null) {
          const startAge = chart.decades[0]?.startAge ?? 0;
          if (startAge !== w.firstLuckAge) {
            failures.push(
              `${c.label}: 大运首步虚岁 ours ${startAge} vs 问真 ${w.firstLuckAge}`,
            );
          }
        }
        const first = chart.decades[0]?.ganZhi ?? '';
        if (first !== w.firstLuck) {
          failures.push(`${c.label}: first 大运 ours "${first}" vs 问真 "${w.firstLuck}"`);
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
    },
  );
});
