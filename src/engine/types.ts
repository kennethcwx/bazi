/**
 * Canonical chart types.
 *
 * These are the L1 output contract: everything downstream (analyzer, narrator,
 * UI) reads this shape and never touches tyme4ts directly. Keeping the boundary
 * here means the calendar library stays swappable and the analyzer stays pure.
 *
 * All culturally-meaningful values are the canonical Chinese term. English is a
 * presentation concern handled by the glossary, never by translating in place.
 */

export type Gender = 'male' | 'female';

/** 五行 */
export type Element = '木' | '火' | '土' | '金' | '水';

/** 阴阳 */
export type YinYang = '阴' | '阳';

/** 十神 */
export type TenGod =
  | '比肩' | '劫财' | '食神' | '伤官' | '偏财'
  | '正财' | '七杀' | '正官' | '偏印' | '正印';

/** Which of the four pillars (四柱). */
export type PillarPosition = 'year' | 'month' | 'day' | 'hour';

/** 藏干 weighting class: 本气 / 中气 / 余气. */
export type HiddenStemRole = 'main' | 'middle' | 'residual';

/**
 * How the birth moment was resolved. Surfaced in the UI so a user can audit a
 * reading rather than having to trust it — the single most common cause of a
 * "wrong" chart is a silent timezone or true-solar-time assumption.
 */
export interface ResolvedMoment {
  /** Wall clock exactly as the user entered it. */
  readonly input: string;
  /** IANA zone used for the lookup. */
  readonly timeZone: string;
  /** Historical UTC offset in minutes at that instant (e.g. 450 for SG pre-1982). */
  readonly utcOffsetMinutes: number;
  /** True if the offset differs from the zone's present-day offset. */
  readonly isHistoricalOffset: boolean;
  /** Minutes added by 真太阳时 correction; 0 when disabled. */
  readonly trueSolarCorrectionMinutes: number;
  /** Longitude used for the correction, if any. */
  readonly longitude: number | null;
  /** Civil time after offset resolution, before true-solar correction. */
  readonly civil: CivilTime;
  /** The moment actually charted, after every correction. */
  readonly charted: CivilTime;
  /** Structured notes about anything non-obvious that was applied.
   *  Kept as data rather than prose so the same chart renders in either
   *  language — see src/i18n/notes.ts. */
  readonly notes: readonly MomentNote[];
}

/**
 * Something worth telling the user about how their birth moment was resolved.
 *
 * Data, not sentences: the engine has no business deciding what language the
 * interface speaks, and a bilingual product cannot have English baked into
 * its calculation layer.
 */
export type MomentNote =
  | { readonly code: 'historical-offset'; readonly timeZone: string;
      readonly actualOffset: string; readonly presentOffset: string }
  | { readonly code: 'true-solar-applied'; readonly minutes: number;
      readonly longitude: number }
  | { readonly code: 'true-solar-no-longitude' }
  | { readonly code: 'true-solar-disabled' };

export interface CivilTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export interface BirthInput {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  /** Omit hour/minute when the birth time is unknown — never guess one. */
  readonly hour?: number;
  readonly minute?: number;
  readonly timeZone: string;
  readonly gender: Gender;
  /** Degrees east positive. Required for true solar time. */
  readonly longitude?: number;
  /** 真太阳时 correction. Defaults on; schools differ, so it is exposed. */
  readonly useTrueSolarTime?: boolean;
}

export interface HiddenStem {
  readonly stem: string;
  readonly element: Element;
  readonly role: HiddenStemRole;
  /** 十神 of this hidden stem relative to the day master. */
  readonly tenGod: TenGod;
}

export interface Pillar {
  readonly position: PillarPosition;
  /** 天干 */
  readonly stem: string;
  readonly stemElement: Element;
  readonly stemYinYang: YinYang;
  /** 地支 */
  readonly branch: string;
  readonly branchElement: Element;
  readonly branchYinYang: YinYang;
  /** e.g. 甲子 */
  readonly ganZhi: string;
  /** 十神 of the stem relative to the day master. Null on the day pillar
   *  itself, which is the reference point rather than a relation. */
  readonly tenGod: TenGod | null;
  readonly hiddenStems: readonly HiddenStem[];
  /** 纳音 */
  readonly naYin: string;
  /** 十二长生 — the day master's phase in this branch. */
  readonly terrain: string;
  /** 旬空 — this branch is void relative to the day pillar's decade. */
  readonly isVoid: boolean;
}

/** One 大运 decade. */
export interface DecadeLuck {
  readonly index: number;
  readonly startAge: number;
  readonly endAge: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly ganZhi: string;
  readonly stem: string;
  readonly branch: string;
  readonly stemTenGod: TenGod;
  readonly branchMainTenGod: TenGod;
  readonly isVoid: boolean;
}

/** One 流年. */
export interface AnnualLuck {
  readonly year: number;
  readonly age: number;
  readonly ganZhi: string;
  readonly stem: string;
  readonly branch: string;
  readonly stemTenGod: TenGod;
  readonly branchMainTenGod: TenGod;
}

/** One 流月 — a month of the sexagenary year, opened by its 节. */
export interface MonthlyLuck {
  /** The 流年 (立春-based) this month belongs to. */
  readonly year: number;
  /** 0 = 寅月 (opens at 立春) … 11 = 丑月. */
  readonly index: number;
  readonly ganZhi: string;
  readonly stem: string;
  readonly branch: string;
  readonly stemTenGod: TenGod;
  readonly branchMainTenGod: TenGod;
  /** Civil date the month opens on — the day of its 节. */
  readonly starts: { readonly year: number; readonly month: number; readonly day: number };
}

export interface Chart {
  readonly input: BirthInput;
  readonly moment: ResolvedMoment;
  readonly gender: Gender;
  /** False when the birth time is unknown; the hour pillar is then omitted and
   *  every hour-dependent finding must be suppressed downstream. */
  readonly hourKnown: boolean;
  readonly pillars: {
    readonly year: Pillar;
    readonly month: Pillar;
    readonly day: Pillar;
    readonly hour: Pillar | null;
  };
  /** Days elapsed since the 节 that opened the birth month.
   *  Drives 人元司令: which of the month branch's 藏干 is actually in charge. */
  readonly monthTermDays: number;
  /** 日主 / 日元 — the day stem, reference point for the whole reading. */
  readonly dayMaster: string;
  readonly dayMasterElement: Element;
  readonly dayMasterYinYang: YinYang;
  /** 起运 age and the 大运 direction (阳男阴女顺行). */
  readonly luckStartAge: number;
  /** How long after birth the luck pillars begin. Structured rather than a
   *  sentence — the engine has no business choosing a language. */
  readonly luckStart: {
    readonly years: number;
    readonly months: number;
    readonly days: number;
  };
  readonly luckForward: boolean;
  readonly decades: readonly DecadeLuck[];
  /** Stable hash of the charted moment + gender + conventions. Cache key for
   *  generated readings, which are a pure function of the chart. */
  readonly chartHash: string;
}
