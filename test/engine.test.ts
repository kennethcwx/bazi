/**
 * Golden suite for L1.
 *
 * Two kinds of test here, and the distinction matters:
 *
 *  - INVARIANTS: classical rules that must hold for every chart ever produced
 *    (五虎遁, 五鼠遁, day-cycle continuity, 立春 year roll). Swept over thousands
 *    of dates. If the engine violates one of these it is broken, full stop.
 *  - EDGE CASES: the specific traps that make real charts wrong — historical
 *    timezones, DST, 真太阳时, 晚子时, 大运 direction, unknown birth time.
 *
 * Invariants are the stronger evidence: a transcribed fixture proves one chart,
 * a rule sweep proves the derivation.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { wallClockToInstant, trueSolarCorrectionMinutes } from '../src/engine/moment';
import { formatNote } from '../src/i18n/notes';
import type { BirthInput } from '../src/engine/types';

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

const SG = 'Asia/Singapore';
const base = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});

const si = (s: string) => STEMS.indexOf(s);
const bi = (s: string) => BRANCHES.indexOf(s);

/**
 * Sexagenary index 0-59 from a stem/branch pair.
 *
 * n must satisfy n = s (mod 10) and n = b (mod 12). Solving by CRT over
 * lcm(10,12)=60: k = 5*(b-s)/2 mod 6, n = s + 10k. Only defined when b-s is
 * even, which is exactly the constraint that makes 60 pairs valid out of 120.
 */
function cycleIndex(stem: string, branch: string): number {
  const s = si(stem);
  const b = bi(branch);
  const diff = b - s;
  if (diff % 2 !== 0) throw new Error(`invalid pair ${stem}${branch}`);
  const k = (((5 * (diff / 2)) % 6) + 6) % 6;
  return s + 10 * k;
}

/** Every nth date in a range, as charts. */
function sweep(fromYear: number, toYear: number, stepDays: number) {
  const out = [];
  const start = Date.UTC(fromYear, 0, 1);
  const end = Date.UTC(toYear, 11, 31);
  for (let t = start; t <= end; t += stepDays * 86_400_000) {
    const d = new Date(t);
    out.push(
      buildChart(base({
        year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
        hour: 10, minute: 0,
      })),
    );
  }
  return out;
}

describe('invariant: 五虎遁年起月 (month stem derives from year stem)', () => {
  it('holds across 1900-2100', () => {
    // Step 17 days so the sweep still lands on every year-stem x month-branch
    // combination many times over without a slow Intl lookup per calendar day.
    const charts = sweep(1900, 2100, 17);
    expect(charts.length).toBeGreaterThan(4000);

    for (const c of charts) {
      const y = si(c.pillars.year.stem);
      const offset = (bi(c.pillars.month.branch) - 2 + 12) % 12;
      const expected = ((y % 5) * 2 + 2 + offset) % 10;
      expect(
        si(c.pillars.month.stem),
        `${c.moment.input} year=${c.pillars.year.ganZhi} month=${c.pillars.month.ganZhi}`,
      ).toBe(expected);
    }
  }, 60_000);
});

describe('invariant: 五鼠遁日起时 (hour stem derives from day stem)', () => {
  it('holds for every 时辰 across a month of dates', () => {
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const c = buildChart(base({ year: 2024, month: 2, day, hour, minute: 30 }));
        const h = c.pillars.hour!;
        const expected = ((si(c.pillars.day.stem) % 5) * 2 + bi(h.branch)) % 10;
        expect(
          si(h.stem),
          `2024-02-${day} ${hour}:30 day=${c.pillars.day.ganZhi} hour=${h.ganZhi}`,
        ).toBe(expected);
      }
    }
  });
});

describe('invariant: day pillar advances exactly one sexagenary step per day', () => {
  it('is continuous across leap years and a century boundary', () => {
    // Three contiguous windows rather than 200 unbroken years: this covers a
    // divisible-by-400 leap year (2000), an ordinary leap year, and the
    // 1899/1900 non-leap century, which is where off-by-one bugs live.
    for (const startYear of [1898, 1999, 2023]) {
      let prev: number | null = null;
      const start = Date.UTC(startYear, 0, 1);
      for (let i = 0; i < 1200; i++) {
        const d = new Date(start + i * 86_400_000);
        const c = buildChart(base({
          year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
          hour: 10, minute: 0,
        }));
        const idx = cycleIndex(c.pillars.day.stem, c.pillars.day.branch);
        if (prev !== null) {
          expect(
            idx,
            `discontinuity at ${d.toISOString().slice(0, 10)}`,
          ).toBe((prev + 1) % 60);
        }
        prev = idx;
      }
    }
  }, 60_000);
});

describe('invariant: 年柱 rolls at 立春, not at new year', () => {
  it('changes once per solar year, in early February', () => {
    for (let year = 1950; year <= 2050; year += 7) {
      const jan = buildChart(base({ year, month: 1, day: 20, hour: 10 })).pillars.year.ganZhi;
      const febEarly = buildChart(base({ year, month: 2, day: 1, hour: 10 })).pillars.year.ganZhi;
      const febLate = buildChart(base({ year, month: 2, day: 10, hour: 10 })).pillars.year.ganZhi;
      const dec = buildChart(base({ year, month: 12, day: 20, hour: 10 })).pillars.year.ganZhi;

      expect(jan, `${year}: Jan and early Feb share the prior year pillar`).toBe(febEarly);
      expect(febLate, `${year}: mid-Feb has rolled`).not.toBe(jan);
      expect(febLate, `${year}: mid-Feb and Dec match`).toBe(dec);
    }
  });

  it('rolls at the exact 立春 minute in 2024 (16:26:53 CST)', () => {
    const at = (h: number, m: number) => buildChart(base({
      year: 2024, month: 2, day: 4, hour: h, minute: m, timeZone: 'Asia/Shanghai',
    }));
    const before = at(16, 20);
    const after = at(16, 30);

    expect(before.pillars.year.ganZhi).toBe('癸卯');
    expect(after.pillars.year.ganZhi).toBe('甲辰');
    expect(before.pillars.month.ganZhi).toBe('乙丑');
    expect(after.pillars.month.ganZhi).toBe('丙寅');
    // The day pillar must NOT move — only year and month follow the term.
    expect(before.pillars.day.ganZhi).toBe(after.pillars.day.ganZhi);
  });
});

describe('edge case: Singapore UTC+07:30 before 1982-01-01', () => {
  it('resolves the historical offset and flags it', () => {
    const pre = buildChart(base({ year: 1981, month: 12, day: 15, hour: 8, minute: 0 }));
    expect(pre.moment.utcOffsetMinutes).toBe(450);
    expect(pre.moment.isHistoricalOffset).toBe(true);
    const offsetNote = pre.moment.notes.find((n) => n.code === 'historical-offset');
    expect(offsetNote).toBeDefined();
    expect(offsetNote).toMatchObject({ actualOffset: '+07:30', presentOffset: '+08:00' });
    // And it must render in both languages without leaking the other one.
    expect(formatNote(offsetNote!, 'zh')).toContain('UTC+07:30');
    // The zone identifier is legitimately Latin; English *prose* is not.
    expect(formatNote(offsetNote!, 'zh')).not.toMatch(/(was|Charted|today's|offset)/);
    expect(formatNote(offsetNote!, 'zh')).toMatch(/[一-鿿]/);
    expect(formatNote(offsetNote!, 'en')).toContain('historical offset');

    const post = buildChart(base({ year: 1982, month: 1, day: 15, hour: 8, minute: 0 }));
    expect(post.moment.utcOffsetMinutes).toBe(480);
    expect(post.moment.isHistoricalOffset).toBe(false);
  });

  it('honours the 30-minute shift a naive fixed +08:00 would miss', () => {
    const wall = { year: 1981, month: 12, day: 15, hour: 8, minute: 50 };
    const honoured = wallClockToInstant(wall, SG);
    const naive = Date.UTC(1981, 11, 15, 8, 50) - 480 * 60_000;
    expect(honoured.instantMs - naive).toBe(30 * 60_000);
  });

  it('applies to Malaysia too, which changed on the same date', () => {
    const pre = buildChart(base({
      year: 1981, month: 6, day: 15, hour: 8, timeZone: 'Asia/Kuala_Lumpur',
    }));
    expect(pre.moment.utcOffsetMinutes).toBe(450);
  });
});

describe('edge case: China DST 1986-1991', () => {
  it('resolves +09:00 in summer 1988 and +08:00 in winter', () => {
    const summer = buildChart(base({
      year: 1988, month: 7, day: 15, hour: 14, timeZone: 'Asia/Shanghai',
    }));
    const winter = buildChart(base({
      year: 1988, month: 1, day: 15, hour: 14, timeZone: 'Asia/Shanghai',
    }));
    expect(summer.moment.utcOffsetMinutes).toBe(540);
    expect(summer.moment.isHistoricalOffset).toBe(true);
    expect(winter.moment.utcOffsetMinutes).toBe(480);
  });
});

describe('edge case: 真太阳时 correction', () => {
  it('is about -65 min for modern Singapore, not a rounding detail', () => {
    const corr = trueSolarCorrectionMinutes(Date.UTC(1990, 5, 15, 6, 30), 103.82, 480);
    expect(corr).toBeLessThan(-60);
    expect(corr).toBeGreaterThan(-70);
  });

  it('is about -35 min for pre-1982 Singapore on the +07:30 zone', () => {
    const corr = trueSolarCorrectionMinutes(Date.UTC(1981, 5, 15, 4, 30), 103.82, 450);
    expect(corr).toBeLessThan(-30);
    expect(corr).toBeGreaterThan(-40);
  });

  it('swings with the equation of time across the year', () => {
    const feb = trueSolarCorrectionMinutes(Date.UTC(1990, 1, 11, 4, 0), 103.82, 480);
    const nov = trueSolarCorrectionMinutes(Date.UTC(1990, 10, 3, 4, 0), 103.82, 480);
    // EoT runs about -14 min in mid-Feb and +16 min in early Nov.
    expect(nov - feb).toBeGreaterThan(20);
  });

  it('changes the hour pillar when it crosses a 时辰 boundary', () => {
    const args = { year: 1990, month: 6, day: 15, hour: 15, minute: 20, longitude: 103.82 };
    const off = buildChart(base({ ...args, useTrueSolarTime: false }));
    const on = buildChart(base({ ...args, useTrueSolarTime: true }));
    // 15:20 civil -> ~14:15 true solar, back across the 未/申 boundary at 15:00.
    expect(off.pillars.hour!.branch).toBe('申');
    expect(on.pillars.hour!.branch).toBe('未');
  });
});

describe('edge case: 晚子时 (23:00-23:59)', () => {
  it('advances the day pillar at 23:00', () => {
    const before = buildChart(base({ year: 2024, month: 3, day: 10, hour: 22, minute: 30 }));
    const after = buildChart(base({ year: 2024, month: 3, day: 10, hour: 23, minute: 30 }));
    expect(before.pillars.day.ganZhi).toBe('癸酉');
    expect(after.pillars.day.ganZhi).toBe('甲戌');
    expect(after.pillars.hour!.branch).toBe('子');
  });

  it('gives 23:30 and the next day 00:30 identical pillars', () => {
    const late = buildChart(base({ year: 2024, month: 3, day: 10, hour: 23, minute: 30 }));
    const early = buildChart(base({ year: 2024, month: 3, day: 11, hour: 0, minute: 30 }));
    expect(late.pillars.day.ganZhi).toBe(early.pillars.day.ganZhi);
    expect(late.pillars.hour!.ganZhi).toBe(early.pillars.hour!.ganZhi);
  });
});

describe('edge case: 大运 direction (阳男阴女顺行)', () => {
  it('runs forward for a male in a yang year, backward for a female', () => {
    const m = buildChart(base({ gender: 'male' }));   // 1990 庚午, 庚 is yang
    const f = buildChart(base({ gender: 'female' }));

    expect(m.pillars.year.stemYinYang).toBe('阳');
    expect(m.luckForward).toBe(true);
    expect(f.luckForward).toBe(false);

    // Stepping forward and backward from the month pillar 壬午.
    expect(m.pillars.month.ganZhi).toBe('壬午');
    expect(m.decades[0]!.ganZhi).toBe('癸未');
    expect(f.decades[0]!.ganZhi).toBe('辛巳');
  });

  it('reverses for a yin year', () => {
    const m = buildChart(base({ year: 1991, gender: 'male' })); // 辛未, yin
    const f = buildChart(base({ year: 1991, gender: 'female' }));
    expect(m.pillars.year.stemYinYang).toBe('阴');
    expect(m.luckForward).toBe(false);
    expect(f.luckForward).toBe(true);
  });
});

describe('edge case: unknown birth time', () => {
  it('omits the hour pillar rather than guessing one', () => {
    const c = buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' });
    expect(c.hourKnown).toBe(false);
    expect(c.pillars.hour).toBeNull();
  });

  it('still yields the three knowable pillars, matching a timed chart', () => {
    const unknown = buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' });
    const known = buildChart(base({ hour: 14, minute: 30 }));
    expect(unknown.pillars.year.ganZhi).toBe(known.pillars.year.ganZhi);
    expect(unknown.pillars.month.ganZhi).toBe(known.pillars.month.ganZhi);
    expect(unknown.pillars.day.ganZhi).toBe(known.pillars.day.ganZhi);
  });

  it('never applies a true-solar correction to a guessed hour', () => {
    const c = buildChart({
      year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male',
      longitude: 103.82, useTrueSolarTime: true,
    });
    expect(c.moment.trueSolarCorrectionMinutes).toBe(0);
  });
});

describe('chart derivations', () => {
  const c = buildChart(base());

  it('reads the day master off the day stem', () => {
    expect(c.dayMaster).toBe(c.pillars.day.stem);
    expect(c.pillars.day.tenGod).toBeNull();
  });

  it('gives every non-day stem a 十神 relative to the day master', () => {
    for (const p of [c.pillars.year, c.pillars.month, c.pillars.hour!]) {
      expect(p.tenGod).toBeTruthy();
    }
  });

  it('orders 藏干 with 本气 first', () => {
    for (const p of [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour!]) {
      expect(p.hiddenStems.length).toBeGreaterThan(0);
      expect(p.hiddenStems[0]!.role).toBe('main');
    }
  });

  it('never marks the day branch as 旬空', () => {
    // 旬空 is defined as the two branches absent from the day pillar's own
    // decade, so the day branch is void by construction impossible.
    expect(c.pillars.day.isVoid).toBe(false);
  });

  it('produces ten contiguous 大运 decades', () => {
    expect(c.decades).toHaveLength(10);
    for (let i = 1; i < c.decades.length; i++) {
      expect(c.decades[i]!.startAge).toBe(c.decades[i - 1]!.startAge + 10);
    }
  });

  it('hashes identically for identical input, differently across gender', () => {
    expect(buildChart(base()).chartHash).toBe(c.chartHash);
    expect(buildChart(base({ gender: 'female' })).chartHash).not.toBe(c.chartHash);
  });
});

describe('胎元 / 命宫 / 身宫', () => {
  const birth = {
    year: 1985, month: 6, day: 15, hour: 14, minute: 0,
    timeZone: 'Asia/Shanghai', longitude: 121.47, gender: 'male' as const,
    useTrueSolarTime: false,
  };

  it('胎元 is the month pillar advanced one stem and three branches', () => {
    const c = buildChart(birth);
    const STEMS = '甲乙丙丁戊己庚辛壬癸';
    const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
    const m = c.pillars.month;
    const stem = STEMS[(STEMS.indexOf(m.stem) + 1) % 10];
    const branch = BRANCHES[(BRANCHES.indexOf(m.branch) + 3) % 12];
    expect(c.palaces.fetalOrigin).toBe(`${stem}${branch}`);
  });

  it('命宫 and 身宫 are present with the hour and absent without it', () => {
    const withHour = buildChart(birth);
    expect(withHour.palaces.ownSign).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(withHour.palaces.bodySign).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    const { hour: _h, minute: _m, ...noHour } = birth;
    const without = buildChart(noHour);
    expect(without.palaces.fetalOrigin).toBe(withHour.palaces.fetalOrigin);
    expect(without.palaces.ownSign).toBeNull();
    expect(without.palaces.bodySign).toBeNull();
  });

  it('命宫 moves with the hour, 胎元 does not', () => {
    const a = buildChart(birth);
    const b = buildChart({ ...birth, hour: 2 });
    expect(b.palaces.fetalOrigin).toBe(a.palaces.fetalOrigin);
    expect(b.palaces.ownSign).not.toBe(a.palaces.ownSign);
  });
});
