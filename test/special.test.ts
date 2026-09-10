/**
 * 化气格 and 专旺格 — determined, and inverting 用神 when they are.
 *
 * The shape of this file mirrors test/following.test.ts, because the risk is
 * the same one: a verdict that replaces 扶抑 outright has to be REACHABLE (all
 * ten 格 and both 真/假, or the conditions are decoration) and it has to stay
 * RARE (a model that finds 曲直格 on one chart in twenty is miscalibrated, not
 * perceptive). Neither bound alone catches a threshold set wrong.
 *
 * Every condition test is a negative control in the strict sense: it asserts
 * that charts which fail one requirement are NOT read as 化气 or 专旺. That is
 * the only way to tell a working gate from a rubber stamp.
 *
 * The 用神 tests carry the most weight here. Both of these 格 exist to invert
 * the ordinary reading, and for 专旺 the inversion is the sharpest it gets in
 * this whole analyzer: 扶抑 tells a Day Master this strong to take 官杀, while
 * 专旺 says 官杀 is the one thing that wrecks it. A test that only checked the
 * 格 was NAMED would pass while the reading gave exactly the opposite advice.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { analyzeStrength } from '../src/analyzer/strength';
import { analyzeYongShen } from '../src/analyzer/yongshen';
import { analyzeFollowing } from '../src/analyzer/following';
import {
  controls, controlledBy, elementOfBranch, familyElement, generatedBy, generates,
  tenGodFamily,
} from '../src/analyzer/elements';
import type { BirthInput, Element } from '../src/engine/types';

const at = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Shanghai', longitude: 116.4, gender: 'male',
  useTrueSolarTime: false, ...o,
});

const analyse = (o: Partial<BirthInput>) => analyzeChart(buildChart(at(o)));

/**
 * Charts that DO transform, one per 化神, pinned by date.
 *
 * Pinned rather than discovered because 化气 lands on roughly a third of a
 * percent of charts: a sweep thin enough to run in a test suite misses several
 * of the five, and the test then fails for a reason that has nothing to do with
 * the code. Found by sweeping every 1930-2020 chart on five days a month.
 */
const TRANSFORM_PINNED: ReadonlyArray<readonly [string, Partial<BirthInput>]> = [
  ['化土格', { year: 1933, month: 7, day: 27, hour: 7 }],   // 甲午 日, 己 月干, 未 月
  ['化木格', { year: 1954, month: 2, day: 15, hour: 13 }],  // 壬寅 日, 丁 时干, 真化
  ['化水格', { year: 1954, month: 12, day: 21, hour: 7 }],  // 辛亥 日, 壬 时干, 真化
  ['化火格', { year: 1950, month: 2, day: 27, hour: 7 }],   // 癸巳 日, 戊 月干, 寅 月
  ['化金格', { year: 1932, month: 9, day: 21, hour: 7 }],   // 乙酉 日, 庚 时干, 酉 月
];

/** One per 专旺 name. 从革格 needs a 申酉戌 or 巳酉丑 sweep to find at all. */
const DOMINANT_PINNED: ReadonlyArray<readonly [string, Partial<BirthInput>]> = [
  ['曲直格', { year: 1975, month: 3, day: 9, hour: 7 }],    // 乙卯 己卯 甲寅 戊辰, 寅卯辰
  ['炎上格', { year: 1966, month: 6, day: 27, hour: 13 }],  // 丙午 甲午 丁巳 丁未, 巳午未
  ['稼穑格', { year: 1931, month: 2, day: 3, hour: 7 }],    // 庚午 己丑 己丑 戊辰, 支全四库
  ['从革格', { year: 1968, month: 10, day: 7, hour: 8 }],   // 戊申 辛酉 庚戌 庚辰, 申酉戌
  ['润下格', { year: 1993, month: 11, day: 27, hour: 1 }],  // 癸酉 癸亥 壬子 辛丑, 亥子丑
];

const PINNED = [...TRANSFORM_PINNED, ...DOMINANT_PINNED];

const SWEEP = (() => {
  const out = [];
  for (let year = 1930; year <= 2020; year += 5) {
    for (let month = 1; month <= 12; month++) {
      for (const day of [3, 9, 15, 21, 27]) {
        for (const hour of [1, 7, 13, 19]) {
          out.push(buildChart(at({ year, month, day, hour })));
        }
      }
    }
  }
  return out;
})();

const ANALYSES = SWEEP.map((c) => analyzeChart(c));
const PINNED_ANALYSES = PINNED.map(([, b]) => analyse(b));
/** Sweep hits plus the pinned ones, which is what the condition gates run on. */
const ALL = [...ANALYSES.filter((a) => a.strength.special !== null), ...PINNED_ANALYSES];
const TRANSFORMING = ALL.filter((a) => a.strength.special!.category === '化气');
const DOMINANT = ALL.filter((a) => a.strength.special!.category === '专旺');

/** Visible stems — the 日干 is the subject of the chart, not evidence about it. */
const visibleStems = (a: (typeof ALL)[number]): Element[] =>
  [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.hour]
    .filter((p) => p !== null)
    .map((p) => p!.stemElement);

const branches = (a: (typeof ALL)[number]): string[] =>
  [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.day, a.chart.pillars.hour]
    .filter((p) => p !== null)
    .map((p) => p!.branch);

describe('化气格 and 专旺格 fire, and fire rarely', () => {
  it('reaches all five 化气格', () => {
    for (const [kind, birth] of TRANSFORM_PINNED) {
      const a = analyse(birth);
      expect(a.strength.special, `${kind}: chart no longer transforms`).not.toBeNull();
      expect(a.strength.special!.kind).toBe(kind);
      expect(a.strength.special!.category).toBe('化气');
    }
  });

  it('reaches all five 专旺格', () => {
    for (const [kind, birth] of DOMINANT_PINNED) {
      const a = analyse(birth);
      expect(a.strength.special, `${kind}: chart no longer dominates`).not.toBeNull();
      expect(a.strength.special!.kind).toBe(kind);
      expect(a.strength.special!.category).toBe('专旺');
    }
  });

  it('reaches both 真化 and 假化', () => {
    expect(TRANSFORMING.some((a) => a.strength.special!.genuine)).toBe(true);
    expect(TRANSFORMING.some((a) => !a.strength.special!.genuine)).toBe(true);
  });

  it('reaches both a clean and a contested 专旺', () => {
    expect(DOMINANT.some((a) => a.strength.special!.genuine)).toBe(true);
    expect(DOMINANT.some((a) => !a.strength.special!.genuine)).toBe(true);
  });

  it('stays rare — well under 2% of charts, and 专旺 rarer than 化气', () => {
    const hits = ANALYSES.filter((a) => a.strength.special !== null);
    const rate = hits.length / ANALYSES.length;
    expect(rate).toBeGreaterThan(0.0005);
    expect(rate, `special 格 fired on ${(rate * 100).toFixed(2)}% of charts`)
      .toBeLessThan(0.02);

    const transforming = hits.filter((a) => a.strength.special!.category === '化气');
    const dominant = hits.filter((a) => a.strength.special!.category === '专旺');
    expect(dominant.length).toBeGreaterThan(0);
    expect(dominant.length).toBeLessThan(transforming.length);
  });
});

describe('every 化气 condition actually gates', () => {
  it('only transforms on a 五合 that reaches the day pillar from beside it', () => {
    // 遥合不化: a 年干 combination is not adjacent, and the 日干 has to be one of
    // the two partners because it is the thing being transformed.
    for (const a of TRANSFORMING) {
      const dayStem = a.chart.pillars.day.stem;
      const neighbours = [a.chart.pillars.month.stem, a.chart.pillars.hour?.stem]
        .filter((s): s is string => !!s);
      const PAIRS: readonly (readonly [string, string])[] = [
        ['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸'],
      ];
      const combines = neighbours.some((n) => PAIRS.some(
        ([x, y]) => (dayStem === x && n === y) || (dayStem === y && n === x),
      ));
      expect(combines, `${a.chart.pillars.day.ganZhi}: no adjacent 五合`).toBe(true);
    }
  });

  it('only transforms into a 化神 the month carries', () => {
    const TRIPLE: Record<string, readonly string[]> = {
      水: ['申', '子', '辰'], 木: ['亥', '卯', '未'],
      火: ['寅', '午', '戌'], 金: ['巳', '酉', '丑'], 土: [],
    };
    for (const a of TRANSFORMING) {
      const target = a.strength.special!.element;
      const month = a.chart.pillars.month.branch;
      const carried = elementOfBranch(month) === target
        || TRIPLE[target]!.includes(month);
      expect(carried, `${month} month does not carry ${target}`).toBe(true);
    }
  });

  it('never transforms into an element that is barely present', () => {
    for (const a of TRANSFORMING) {
      const target = a.strength.special!.element;
      expect(a.strength.elementPercent[target]).toBeGreaterThanOrEqual(30);
    }
  });

  it('never transforms into the day master own element', () => {
    // 化 means becoming something else. A 己 day master "transforming" into 土
    // has not transformed, and calling it 真化 would assert a rootless Day
    // Master in a chart where that element holds half the weight.
    for (const a of TRANSFORMING) {
      expect(a.strength.special!.element).not.toBe(a.chart.dayMasterElement);
    }
  });

  it('never transforms while a visible stem controls the 化神', () => {
    // The two partners are exempt — they are bound in the combination — so the
    // check is on the stems OUTSIDE it.
    for (const a of TRANSFORMING) {
      const target = a.strength.special!.element;
      const attacker = controlledBy(target);
      const dayStem = a.chart.pillars.day.stem;
      const PAIRS: readonly (readonly [string, string])[] = [
        ['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸'],
      ];
      const partner = PAIRS.flatMap(([x, y]) =>
        dayStem === x ? [y] : dayStem === y ? [x] : []);
      const outside = [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.hour]
        .filter((p) => p !== null)
        .filter((p) => !partner.includes(p!.stem))
        .map((p) => p!.stemElement);
      expect(outside).not.toContain(attacker);
    }
  });

  it('never transforms a day master that sits on its own root', () => {
    for (const a of TRANSFORMING) {
      const seat = a.chart.pillars.day.hiddenStems.find((h) => h.role === 'main');
      expect(seat?.element).not.toBe(a.chart.dayMasterElement);
      expect(a.strength.elementPercent[a.chart.dayMasterElement])
        .toBeLessThanOrEqual(8);
    }
  });

  it('calls it 真化 only when the old element is gone from the chart entirely', () => {
    for (const a of TRANSFORMING) {
      const root = a.strength.elementPercent[a.chart.dayMasterElement];
      if (a.strength.special!.genuine) expect(root).toBe(0);
      else expect(root).toBeGreaterThan(0);
    }
  });

  it('never claims a root of zero and a surviving root in the same breath', () => {
    // The 真化/假化 wording differs, and getting it backwards would have the
    // reasoning assert something the numbers beside it contradict.
    for (const a of TRANSFORMING) {
      const zh = a.strength.reasoning.map((r) => r.zh).join('\n');
      if (a.strength.special!.genuine) expect(zh).not.toContain('化而未净');
      else expect(zh).not.toContain('无根可恃');
    }
  });
});

describe('every 专旺 condition actually gates', () => {
  it('only fires when the month is the day master own element', () => {
    for (const a of DOMINANT) {
      expect(elementOfBranch(a.chart.pillars.month.branch))
        .toBe(a.chart.dayMasterElement);
      expect(a.strength.special!.element).toBe(a.chart.dayMasterElement);
    }
  });

  it('only fires when the branches have gathered (支成方局 / 支全四库)', () => {
    const TRIPLE: Record<string, readonly string[]> = {
      水: ['申', '子', '辰'], 木: ['亥', '卯', '未'],
      火: ['寅', '午', '戌'], 金: ['巳', '酉', '丑'], 土: [],
    };
    const DIRECTIONAL: Record<string, readonly string[]> = {
      木: ['寅', '卯', '辰'], 火: ['巳', '午', '未'],
      金: ['申', '酉', '戌'], 水: ['亥', '子', '丑'], 土: [],
    };
    const STORES = new Set(['辰', '戌', '丑', '未']);
    for (const a of DOMINANT) {
      const dm = a.chart.dayMasterElement;
      const b = branches(a);
      const gathered = dm === '土'
        ? b.filter((x) => STORES.has(x)).length >= 3
        : TRIPLE[dm]!.every((x) => b.includes(x))
          || DIRECTIONAL[dm]!.every((x) => b.includes(x));
      expect(gathered, `${a.strength.special!.kind}: ${b.join('')} has not gathered`)
        .toBe(true);
    }
  });

  it('never fires against a visible 官杀, nor much of a hidden one', () => {
    for (const a of DOMINANT) {
      const officer = controlledBy(a.chart.dayMasterElement);
      expect(visibleStems(a)).not.toContain(officer);
      expect(a.strength.elementPercent[officer]).toBeLessThanOrEqual(8);
    }
  });

  it('only fires when the element genuinely rules', () => {
    for (const a of DOMINANT) {
      expect(a.strength.elementPercent[a.chart.dayMasterElement])
        .toBeGreaterThanOrEqual(55);
      // A chart this lopsided must read 身强 on the ordinary weighting too, or
      // the 格 and the strength verdict beside it disagree in the UI.
      expect(a.strength.verdict).toBe('身强');
    }
  });

  it('calls it clean only when there is no 官杀 at all', () => {
    for (const a of DOMINANT) {
      const officer = controlledBy(a.chart.dayMasterElement);
      const share = a.strength.elementPercent[officer];
      if (a.strength.special!.genuine) expect(share).toBe(0);
      else expect(share).toBeGreaterThan(0);
    }
  });
});

describe('用神 inverts under both 格', () => {
  it('judges a 化气 chart by what it became', () => {
    for (const a of TRANSFORMING) {
      const target = a.strength.special!.element;
      expect(a.yongShen.primary).toBe(target);
      // 生化神 is the 喜神, and 克化神 is the one thing it cannot take.
      expect(a.yongShen.secondary).toBe(generatedBy(target));
      expect(a.yongShen.unfavourable).toContain(controlledBy(target));
      expect(a.yongShen.favourable).not.toContain(controlledBy(target));
    }
  });

  it('tells a 专旺 chart to go with the force, not to take 官杀', () => {
    // This is the whole point. 扶抑 would look at a Day Master over 55% and
    // prescribe 官杀; here 官杀 is the 忌神 that breaks the structure.
    for (const a of DOMINANT) {
      const dm = a.chart.dayMasterElement;
      expect(a.yongShen.primary).toBe(dm);
      expect(a.yongShen.primaryFamily).toBe('比劫');
      expect(a.yongShen.secondary).toBe(generates(dm));       // 食伤泄秀
      expect(a.yongShen.favourable).toContain(generatedBy(dm)); // 印
      expect(a.yongShen.unfavourable).toContain(controlledBy(dm)); // 官杀
      expect(a.yongShen.unfavourable).toContain(controls(dm));     // 财
      expect(a.yongShen.favourable).not.toContain(controlledBy(dm));
    }
  });

  it('names the 格 as the method, rather than claiming 扶抑', () => {
    for (const a of ALL) {
      expect(a.yongShen.school.zh).toContain(a.strength.special!.kind);
      expect(a.yongShen.school.zh).not.toContain('扶抑为主');
    }
  });

  it('drops the climate modifier, which has no day master to temper', () => {
    for (const a of ALL) {
      expect(a.yongShen.climateNeed).toBeNull();
      expect(a.yongShen.climateConflict).toBe(false);
    }
  });

  it('never leaves 用神 and 忌神 overlapping', () => {
    for (const a of ALL) {
      for (const e of a.yongShen.favourable) {
        expect(a.yongShen.unfavourable).not.toContain(e);
      }
      expect(a.yongShen.favourable.length).toBeGreaterThan(0);
      expect(a.yongShen.unfavourable.length).toBeGreaterThan(0);
    }
  });

  // NEGATIVE CONTROL: ordinary charts must be untouched by any of this.
  it('leaves every ordinary chart on 扶抑', () => {
    const ordinary = ANALYSES.filter(
      (a) => a.strength.special === null && a.strength.following === null,
    );
    expect(ordinary.length).toBeGreaterThan(ANALYSES.length * 0.9);
    for (const a of ordinary) {
      expect(a.yongShen.school.zh).toContain('扶抑');
    }
  });

  it('is deterministic', () => {
    for (const a of PINNED_ANALYSES.slice(0, 4)) {
      const first = analyzeYongShen(a.chart, analyzeStrength(a.chart));
      const second = analyzeYongShen(a.chart, analyzeStrength(a.chart));
      expect(second.primary).toBe(first.primary);
      expect(second.favourable).toEqual(first.favourable);
      expect(second.school).toEqual(first.school);
    }
  });
});

describe('at most one 格 may replace 扶抑', () => {
  it('never reads a chart as both special and 从格', () => {
    for (const a of ANALYSES) {
      if (a.strength.special) expect(a.strength.following).toBeNull();
    }
  });

  it('gives 化气 precedence over 从格, and the two disagree', () => {
    // 专旺 cannot collide with 从格 — one needs the month to feed the Day Master
    // and the other needs it not to — so the precedence that has to be proven is
    // 化气 over 从格. 1938-03-11 13:00 is 戊寅 乙卯 壬寅 丁未: 壬 has 0% support in
    // a 卯 month, which is textbook 从儿, AND 丁 sits beside it in a month that
    // carries 木, which is 化木.
    //
    // The two readings are NOT interchangeable, which is why the order matters
    // rather than being a tidiness question. Read as 化木格 the chart has BECOME
    // Wood, so Water is now the 印 that feeds it and Fire drains it. Read as
    // 从儿格 the Day Master is still Water following its own output, so Fire
    // carries that output onward and Water is the side it abandoned. Favourable
    // and unfavourable swap places on two of the five elements.
    const a = analyse({ year: 1938, month: 3, day: 11, hour: 13 });
    expect(a.strength.supportPercent).toBe(0);
    expect(a.strength.special!.kind).toBe('化木格');
    expect(a.strength.following).toBeNull();

    // What 从儿 would have said, had it been asked.
    const dm = a.chart.dayMasterElement;
    const ruler = a.chart.pillars.month.hiddenStems
      .find((h) => h.stem === a.strength.siLing.stem);
    const f = analyzeFollowing(
      a.chart, a.strength.familyPercent, a.strength.hasMonthCommand,
      ruler ? tenGodFamily(dm, ruler.element) : null,
    );
    expect(f!.kind).toBe('从儿格');
    const wouldWant = f!.favourable.map((fam) => familyElement(dm, fam));
    expect(wouldWant).toEqual(['木', '火']);
    expect(a.yongShen.favourable).toEqual(['木', '水']);
  });

  it('reads the 格 into the strength reasoning as well as the 用神', () => {
    // Both are shown to the user, from different fields. A verdict that reached
    // only one of them would leave the two panels disagreeing.
    for (const a of ALL) {
      const zh = a.strength.reasoning.map((r) => r.zh).join('\n');
      expect(zh).toContain(a.strength.special!.kind);
    }
  });
});

describe('the new prose is genuinely bilingual', () => {
  // The sweep in test/bilingual.test.ts is not dense enough to contain a 化气 or
  // 专旺 chart, so these strings would otherwise never reach that guard.
  const CHINESE_PROSE = /[的是不有在了会要为与和之则者宜主多易]/;

  it('gives every line both languages, with no Chinese prose in the English', () => {
    let checked = 0;
    for (const a of PINNED_ANALYSES) {
      const lines = [
        ...a.strength.special!.reasoning,
        ...a.yongShen.reasoning,
        a.yongShen.school,
      ];
      for (const line of lines) {
        expect(line.zh.trim().length).toBeGreaterThan(0);
        expect(line.en.trim().length).toBeGreaterThan(0);
        expect(line.zh).not.toBe(line.en);
        expect(
          CHINESE_PROSE.test(line.en),
          `Chinese prose leaked into en — "${line.en}"`,
        ).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('never pastes a Chinese pillar label into an English sentence', () => {
    for (const a of TRANSFORMING) {
      const en = a.strength.special!.reasoning.map((r) => r.en).join('\n');
      expect(en).not.toContain('月柱');
      expect(en).not.toContain('时柱');
      expect(en).toMatch(/(month|hour) pillar/);
    }
  });
});
