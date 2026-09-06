/**
 * L1: birth input -> Chart.
 *
 * The only module that touches tyme4ts. Everything downstream reads the Chart
 * contract in ./types, so the calendar library stays replaceable and the
 * analyzer stays a pure function of plain data.
 *
 * Nothing here interprets. Interpretation is L2's job, narration is L3's, and
 * keeping the seam sharp is what makes a reading reproducible and auditable.
 */

import {
  SolarTime,
  HeavenStem,
  EarthBranch,
  ChildLimit,
  Gender as TymeGender,
  type SixtyCycle,
} from 'tyme4ts';

import { resolveMoment } from './moment';
import type {
  AnnualLuck,
  BirthInput,
  Chart,
  DecadeLuck,
  Element,
  HiddenStem,
  HiddenStemRole,
  Pillar,
  PillarPosition,
  TenGod,
  YinYang,
} from './types';

/** tyme4ts HideHeavenStemType: 0 residual, 1 middle, 2 main. */
const HIDDEN_ROLE: Record<number, HiddenStemRole> = {
  0: 'residual',
  1: 'middle',
  2: 'main',
};

/** Default when the birth time is unknown: chart at noon so the three knowable
 *  pillars are correct, then discard the hour pillar. Never shown as real. */
const UNKNOWN_HOUR = 12;

function yinYang(v: number): YinYang {
  // tyme4ts YinYang: 0 = 阴, 1 = 阳.
  return v === 1 ? '阳' : '阴';
}

/**
 * Build one pillar.
 *
 * `dayStem` is the 日主 — every 十神 and 十二长生 value on every pillar is a
 * relation *to* it, which is why the day pillar's own tenGod is null rather
 * than 比肩: it is the reference point, not a relation to itself.
 */
function buildPillar(
  position: PillarPosition,
  cycle: SixtyCycle,
  dayStem: HeavenStem,
  voidBranches: ReadonlySet<string>,
): Pillar {
  const stem = cycle.getHeavenStem();
  const branch = cycle.getEarthBranch();

  const hiddenStems: HiddenStem[] = branch.getHideHeavenStems().map((h) => {
    const hs = h.getHeavenStem();
    return {
      stem: hs.getName(),
      element: hs.getElement().getName() as Element,
      role: HIDDEN_ROLE[h.getType()] ?? 'residual',
      tenGod: dayStem.getTenStar(hs).getName() as TenGod,
    };
  });

  return {
    position,
    stem: stem.getName(),
    stemElement: stem.getElement().getName() as Element,
    stemYinYang: yinYang(stem.getYinYang()),
    branch: branch.getName(),
    branchElement: branch.getElement().getName() as Element,
    branchYinYang: yinYang(branch.getYinYang()),
    ganZhi: cycle.getName(),
    tenGod: position === 'day' ? null : (dayStem.getTenStar(stem).getName() as TenGod),
    hiddenStems,
    naYin: cycle.getSound().getName(),
    terrain: dayStem.getTerrain(branch).getName(),
    isVoid: voidBranches.has(branch.getName()),
  };
}

/** Both 十神 readings for a luck cycle: its stem, and its branch's 本气. */
function luckTenGods(cycle: SixtyCycle, dayStem: HeavenStem) {
  return {
    stemTenGod: dayStem.getTenStar(cycle.getHeavenStem()).getName() as TenGod,
    branchMainTenGod: dayStem
      .getTenStar(cycle.getEarthBranch().getHideHeavenStemMain())
      .getName() as TenGod,
  };
}

/**
 * Stable cache key. Reports are a pure function of the charted moment, gender
 * and conventions, so this keys the generated-reading cache — identical charts
 * share one generation regardless of who asked.
 *
 * FNV-1a: not cryptographic, just a compact stable digest.
 */
function hashChart(parts: readonly (string | number | boolean)[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function buildChart(input: BirthInput): Chart {
  const hourKnown = input.hour !== undefined;

  const moment = resolveMoment(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour ?? UNKNOWN_HOUR,
      minute: input.minute ?? 0,
    },
    {
      timeZone: input.timeZone,
      longitude: input.longitude,
      // A true-solar correction on a guessed hour is false precision.
      useTrueSolarTime: hourKnown ? input.useTrueSolarTime : false,
    },
  );

  const c = moment.charted;
  const solar = SolarTime.fromYmdHms(c.year, c.month, c.day, c.hour, c.minute, 0);
  const eightChar = solar.getSixtyCycleHour().getEightChar();

  const dayCycle = eightChar.getDay();
  const dayStem = dayCycle.getHeavenStem();

  // 旬空 is a property of the day pillar's decade, applied across the chart.
  const voidBranches = new Set(
    dayCycle.getExtraEarthBranches().map((b: EarthBranch) => b.getName()),
  );

  const pillars = {
    year: buildPillar('year', eightChar.getYear(), dayStem, voidBranches),
    month: buildPillar('month', eightChar.getMonth(), dayStem, voidBranches),
    day: buildPillar('day', dayCycle, dayStem, voidBranches),
    hour: hourKnown
      ? buildPillar('hour', eightChar.getHour(), dayStem, voidBranches)
      : null,
  };

  // 大运 direction is 阳男阴女顺行 / 阴男阳女逆行, which tyme4ts derives from
  // the year stem's polarity crossed with gender.
  const childLimit = ChildLimit.fromSolarTime(
    solar,
    input.gender === 'male' ? TymeGender.MAN : TymeGender.WOMAN,
  );

  const decades: DecadeLuck[] = [];
  let fortune = childLimit.getStartDecadeFortune();
  for (let i = 0; i < 10; i++) {
    const cycle = fortune.getSixtyCycle();
    decades.push({
      index: i,
      startAge: fortune.getStartAge(),
      endAge: fortune.getEndAge(),
      startYear: fortune.getStartSixtyCycleYear().getYear(),
      endYear: fortune.getEndSixtyCycleYear().getYear(),
      ganZhi: cycle.getName(),
      stem: cycle.getHeavenStem().getName(),
      branch: cycle.getEarthBranch().getName(),
      ...luckTenGods(cycle, dayStem),
      isVoid: voidBranches.has(cycle.getEarthBranch().getName()),
    });
    fortune = fortune.next(1);
  }

  const startAge = decades[0]?.startAge ?? 0;
  const luckStartDescription =
    `${childLimit.getYearCount()}年${childLimit.getMonthCount()}个月` +
    `${childLimit.getDayCount()}天起运`;

  return {
    input,
    moment,
    gender: input.gender,
    hourKnown,
    pillars,
    dayMaster: dayStem.getName(),
    dayMasterElement: dayStem.getElement().getName() as Element,
    dayMasterYinYang: yinYang(dayStem.getYinYang()),
    luckStartAge: startAge,
    luckStartDescription,
    luckForward: childLimit.isForward(),
    decades,
    chartHash: hashChart([
      c.year, c.month, c.day, c.hour, c.minute,
      input.gender, hourKnown, input.timeZone,
    ]),
  };
}

/** 流年 for a span of calendar years, with the age at each. */
export function annualLuck(
  chart: Chart,
  fromYear: number,
  toYear: number,
): AnnualLuck[] {
  const dayStem = HeavenStem.fromName(chart.dayMaster);
  const birthYear = chart.moment.charted.year;
  const out: AnnualLuck[] = [];

  for (let y = fromYear; y <= toYear; y++) {
    // 流年干支 follows the 立春-based sexagenary year, which is what
    // SixtyCycleYear gives us via any solar time inside that year.
    const cycle = SolarTime.fromYmdHms(y, 6, 1, 12, 0, 0)
      .getSixtyCycleHour()
      .getYear();
    out.push({
      year: y,
      age: y - birthYear + 1,
      ganZhi: cycle.getName(),
      stem: cycle.getHeavenStem().getName(),
      branch: cycle.getEarthBranch().getName(),
      ...luckTenGods(cycle, dayStem),
    });
  }
  return out;
}
