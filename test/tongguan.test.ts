/**
 * 通关 — a 中和 chart with two heavy, near-equal families that control each
 * other takes the mediating family as 用神 instead of the scarcest element.
 */
import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { familyElement } from '../src/analyzer/elements';
import type { BirthInput } from '../src/engine/types';

const birth = (o: Partial<BirthInput>): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Singapore', gender: 'male', useTrueSolarTime: false, ...o,
});

describe('通关', () => {
  it('fires on a locked 中和 chart and names the mediator', () => {
    const a = analyzeChart(buildChart(birth({ year: 1980, month: 1, day: 7, hour: 18 })));
    expect(a.strength.verdict).toBe('中和');
    expect(a.yongShen.mediation).not.toBeNull();
    const [attacker, defender] = a.yongShen.mediation!;
    const share = a.strength.familyPercent;
    expect(share[attacker]).toBeGreaterThanOrEqual(30);
    expect(share[defender]).toBeGreaterThanOrEqual(30);
    expect(Math.abs(share[attacker] - share[defender])).toBeLessThanOrEqual(6);
    expect(a.yongShen.primary).toBe(familyElement(a.chart.dayMasterElement, a.yongShen.primaryFamily));
    expect(a.yongShen.reasoning.some((r) => r.zh.includes('通关'))).toBe(true);
  });

  it('stays out of a chart with a clear verdict', () => {
    const a = analyzeChart(buildChart(birth({})));
    expect(a.strength.verdict).not.toBe('中和');
    expect(a.yongShen.mediation).toBeNull();
    expect(a.yongShen.reasoning.some((r) => r.zh.includes('通关'))).toBe(false);
  });
});
