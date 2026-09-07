/**
 * 事业 / 财运 — the career reading.
 *
 * Structured around what a person can actually act on:
 *
 *   1. 格局 — the structure the chart is built on, taken from the 月令.
 *   2. Disposition — 官杀 wants structure, 食伤 wants autonomy, 财 wants
 *      commerce, 印 wants credentials, 比劫 wants peers. The mix says whether
 *      employment or working for oneself fits better.
 *   3. Industry — the 用神 element points at sectors.
 *   4. Timing — score every 大运 decade, which is the screen people screenshot.
 *
 * The decade scoring is deliberately simple and legible: each luck pillar is
 * scored on whether its stem and branch elements are favourable. A more
 * elaborate model would be less explicable, and explicability is the product.
 */

import type { Chart, Element, TenGod } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import {
  DIRECTION, ELEMENT, SHENSHA, STRUCTURE, TEN_GOD, TEN_GOD_FAMILY,
} from '../../i18n/glossary';
import { elementOfBranch, elementOfStem, type TenGodFamily } from '../elements';
import { findRelations, isBranchRelation, natalPillars } from '../relations';
import { finding, type Finding } from '../findings';
import { rulingStem } from '../siling';
import { findShenSha } from '../shensha';
import type { StrengthAnalysis } from '../strength';
import type { YongShenAnalysis } from '../yongshen';

/** Sectors by element. Deliberately concrete: "金融" is useful, "金的行业" is not. */
const INDUSTRIES: Record<Element, readonly LocalizedText[]> = {
  木: [
    t('教育', 'education'), t('出版与文化', 'publishing and culture'),
    t('纺织服装', 'textiles and clothing'), t('家具木材', 'furniture and timber'),
    t('医药保健', 'medicine and health'), t('设计创意', 'design'),
    t('农林', 'agriculture and forestry'),
  ],
  火: [
    t('能源电力', 'energy and power'), t('媒体广告', 'media and advertising'),
    t('餐饮', 'food and beverage'), t('娱乐演艺', 'entertainment'),
    t('电子科技', 'electronics and tech'), t('市场营销', 'marketing'),
    t('美容', 'beauty'),
  ],
  土: [
    t('房地产', 'property'), t('建筑工程', 'construction'),
    t('保险', 'insurance'), t('仓储物流', 'warehousing and logistics'),
    t('农业', 'agriculture'), t('咨询顾问', 'consulting'),
    t('陶瓷建材', 'ceramics and building materials'),
  ],
  金: [
    t('金融银行', 'finance and banking'), t('机械制造', 'manufacturing'),
    t('法律', 'law'), t('五金矿产', 'metals and mining'),
    t('汽车', 'automotive'), t('精密仪器', 'precision instruments'),
    t('IT硬件', 'IT hardware'),
  ],
  水: [
    t('贸易进出口', 'trade and import/export'), t('航运物流', 'shipping and logistics'),
    t('旅游', 'travel'), t('通信传媒', 'communications'),
    t('饮料水产', 'drinks and seafood'), t('研究分析', 'research and analysis'),
    t('流通服务', 'distribution services'),
  ],
};

/** Directions by element, for the 方位 question people always ask. */
const DIRECTIONS: Record<Element, string> = {
  木: '东方', 火: '南方', 土: '中部与本地', 金: '西方', 水: '北方',
};

export type CareerLean = '适合任职受雇' | '适合自主创业' | '两可，视运而定';

const LEAN_LABEL: Record<CareerLean, LocalizedText> = {
  适合任职受雇: t('适合任职受雇', 'Better suited to employment'),
  适合自主创业: t('适合自主创业', 'Better suited to working for yourself'),
  '两可，视运而定': t('两可，视运而定', 'Either can work — it depends on timing'),
};

export type DecadeVerdict = '有利' | '偏顺' | '平稳' | '不利';

export interface DecadeOutlook {
  readonly index: number;
  readonly startAge: number;
  readonly endAge: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly ganZhi: string;
  readonly score: number;
  readonly verdict: DecadeVerdict;
  readonly notes: readonly LocalizedText[];
}

export interface CareerAnalysis {
  /** 格局 name, e.g. 正财格. */
  readonly structure: string;
  readonly structureExposed: boolean;
  readonly dominantFamily: TenGodFamily;
  readonly lean: CareerLean;
  readonly industries: readonly LocalizedText[];
  readonly direction: string;
  readonly decades: readonly DecadeOutlook[];
  readonly bestDecade: DecadeOutlook | null;
  readonly findings: readonly Finding[];
}

/**
 * 格局 from the 月令 — 月令人元透干取格.
 *
 * Standard 子平 does not read the 本气 and stop. It looks at all three of the
 * month branch's 藏干 and takes the one that is 透干 — exposed in a visible
 * heavenly stem — because an exposed 人元 is the one actually able to act. Only
 * when none is exposed does the 本气 stand in.
 *
 * The 日干 does not count as an exposure. It is the subject the whole chart is
 * measured against, not evidence about the month.
 *
 * 比肩 and 劫财 do not form a 格 in the ordinary sense; they are named for the
 * position instead. 羊刃 is classically a 阳干 phenomenon (甲→卯, 丙戊→午,
 * 庚→酉, 壬→子) and most schools hold 阴干无刃, so a 阴干 day master with 劫财
 * in the month is 月劫格, not 羊刃格.
 */
function determineStructure(chart: Chart): { name: string; exposed: boolean; tenGod: TenGod } {
  const hidden = chart.pillars.month.hiddenStems;
  const monthMain = hidden.find((h) => h.role === 'main');

  // 日干 excluded on purpose — see above.
  const visibleStems = [
    chart.pillars.year.stem,
    chart.pillars.month.stem,
    ...(chart.pillars.hour ? [chart.pillars.hour.stem] : []),
  ];

  const ruler = rulingStem(
    chart.pillars.month.branch,
    chart.monthTermDays,
    hidden,
  );

  // Among the exposed 人元, depth of role decides first: 本气透 takes the 格
  // even when a 中气 is also exposed. That ordering is the common textbook rule
  // (本气透则取本气；本气不透而中气透则取中气), and putting 司令 above it would
  // let the day-count override the branch's own principal stem. 司令 is the
  // tie-break, reusing what 旺衰 already derived rather than re-deriving it.
  const ROLE_RANK = { main: 0, middle: 1, residual: 2 } as const;
  const revealed = hidden
    .filter((h) => visibleStems.includes(h.stem))
    .sort((a, b) =>
      ROLE_RANK[a.role] - ROLE_RANK[b.role]
      || (a.stem === ruler.stem ? -1 : 0) - (b.stem === ruler.stem ? -1 : 0),
    );

  const chosen = revealed[0] ?? monthMain;
  const tenGod: TenGod = chosen?.tenGod ?? '比肩';

  const name =
    tenGod === '比肩' ? '建禄格'
    : tenGod === '劫财' ? (chart.dayMasterYinYang === '阳' ? '羊刃格' : '月劫格')
    : `${tenGod}格`;

  // True when the structure was named from an exposed 人元 rather than falling
  // back to the 本气 — which is what this flag was always reaching for.
  const exposed = revealed.length > 0;

  return { name, exposed, tenGod };
}

function determineLean(strength: StrengthAnalysis): { lean: CareerLean; why: LocalizedText } {
  const s = strength.familyPercent;
  const strong = strength.verdict === '身强';
  const output = s['食伤'];
  const wealth = s['财'];
  const officer = s['官杀'];
  const seal = s['印'];

  if (strong && (wealth >= 20 || output >= 25)) {
    return {
      lean: '适合自主创业',
      why: t(
        `身强担得起财，食伤 ${output}% 与财 ${wealth}% 俱有力，自主经营比受制于人更能发挥。`,
        `The Day Master is strong enough to carry wealth, and both output ` +
          `(${output}%) and wealth (${wealth}%) have real weight. You get further ` +
          `running your own thing than working to someone else's brief.`,
      ),
    };
  }
  if (!strong && (officer >= 20 || seal >= 20)) {
    return {
      lean: '适合任职受雇',
      why: t(
        `身弱而官印有力（官杀 ${officer}%、印 ${seal}%），在有制度、有人带的组织里更稳，` +
          `独自扛盘易力不从心。`,
        `The Day Master is weak while authority (${officer}%) and resource (${seal}%) ` +
          `are strong. You do better inside an organisation with structure and ` +
          `people to learn from; carrying the whole load alone tends to outrun you.`,
      ),
    };
  }
  if (strong && officer >= 25) {
    return {
      lean: '适合任职受雇',
      why: t(
        `身强而官杀 ${officer}% 得力，适合在体制或大组织内担责掌权。`,
        `The Day Master is strong and authority is substantial at ${officer}%. ` +
          `That combination takes responsibility well inside an institution or a ` +
          `large organisation.`,
      ),
    };
  }
  return {
    lean: '两可，视运而定',
    why: t(
      `十神分布未见一面独强（官杀 ${officer}%、财 ${wealth}%、食伤 ${output}%），` +
        `受雇或自营皆可行，宜按大运选择时机。`,
      `No single force dominates — authority ${officer}%, wealth ${wealth}%, ` +
        `output ${output}%. Employment and self-employment are both viable; the ` +
        `luck pillars should decide which, and when.`,
    ),
  };
}

/**
 * How a decade's branch engages the natal chart — 合冲 with the four pillars.
 *
 * Element favourability (does the decade carry the 用神) says whether a decade
 * HELPS; it says nothing about whether it is turbulent. That is what 合冲 adds,
 * and it is often the more consequential reading: a decade full of the right
 * element that 冲s the 日支 is not a smooth good decade, it is an eventful one.
 *
 * Kept bounded on purpose — the whole file's claim is that a reader can follow
 * the score, so this is a modifier over the element base, capped at ±2, and
 * every point it moves leaves a note. Where a note is added but no score moves,
 * the relation is real but too minor to change the verdict — said, not scored.
 *
 * Only branch relations, and only those reaching a natal pillar. The palace
 * decides the weight: the 日支 (self, and the spouse palace) and the 月支 (the
 * 提纲, the chart's governing seat) are the ones a 冲 actually shakes; the 年
 * and 时 branches are the outer edges.
 */
const CORE_POSITIONS = new Set(['日柱', '月柱']);
const RELATION_CAP = 2;

function scoreDecadeRelations(
  chart: Chart,
  stem: string,
  branch: string,
  fav: ReadonlySet<Element>,
): { delta: number; notes: LocalizedText[] } {
  const positioned = [...natalPillars(chart), { position: '大运', stem, branch }];
  const rels = findRelations(positioned)
    .filter(isBranchRelation)
    .filter((r) => r.positions.includes('大运'));

  const notes: LocalizedText[] = [];
  let delta = 0;
  const posZh: Record<string, string> = { 年柱: '年支', 月柱: '月支（提纲）', 日柱: '日支（自身/夫妻宫）', 时柱: '时支' };
  const posEn: Record<string, string> = { 年柱: 'year branch', 月柱: 'month branch (the 提纲)', 日柱: 'day branch (self / spouse palace)', 时柱: 'hour branch' };

  for (const r of rels) {
    const targets = r.positions.filter((p) => p !== '大运');
    const hitsCore = targets.some((p) => CORE_POSITIONS.has(p));
    const targetZh = targets.map((p) => posZh[p] ?? p).join('、');
    const targetEn = targets.map((p) => posEn[p] ?? p).join(', ');

    if (r.kind === '六冲') {
      // A 冲 to the 日支 or 月支 shakes the seat the chart is read from, and
      // that is what makes a decade eventful. A 冲 to the outer 年/时 branches
      // is real but does not define the decade's character — named, not scored.
      if (hitsCore) {
        delta -= 2;
        notes.push(t(
          `此运${branch}冲${targetZh}，主动荡变迁`,
          `This decade's ${branch} clashes the ${targetEn} — an unsettled, shifting stretch`,
        ));
      } else {
        notes.push(t(
          `此运${branch}冲${targetZh}，边角有触动`,
          `This decade's ${branch} clashes the ${targetEn} — stirs the edges of the chart`,
        ));
      }
    } else if (r.kind === '三合' || r.kind === '三会' || r.kind === '六合') {
      // A 合 binds, and binding is steadying more often than not. Its sign
      // follows what it produces where that is clear — forming the 用神 helps,
      // forming a 忌神 hinders — and where it transforms into nothing definite,
      // a 合 onto a core palace still reads as a settling, cohering influence.
      if (r.resultElement && fav.has(r.resultElement)) {
        delta += 1;
        notes.push(t(
          `此运${targetZh}相合化${r.resultElement}，正是用神，主稳中有成`,
          `This decade combines with the ${targetEn} into ${ELEMENT[r.resultElement]!.en}, ` +
            `the favourable element — steadying, and things come together`,
        ));
      } else if (r.resultElement && !fav.has(r.resultElement)) {
        delta -= 1;
        notes.push(t(
          `此运${targetZh}相合化${r.resultElement}，反为忌神，牵绊多`,
          `This decade combines with the ${targetEn} into ${ELEMENT[r.resultElement]!.en}, ` +
            `which the chart does not want — binding, and progress drags`,
        ));
      } else if (hitsCore) {
        delta += 1;
        notes.push(t(
          `此运${targetZh}相合，主安定、多助力`,
          `This decade combines with the ${targetEn} — a settling stretch, with support around you`,
        ));
      } else {
        notes.push(t(
          `此运${targetZh}相合，气机牵引`,
          `This decade combines with the ${targetEn} — a pull at the edges of the chart`,
        ));
      }
    } else if (r.kind === '半合') {
      notes.push(t(
        `此运${targetZh}半合，牵引较轻`,
        `This decade half-combines with the ${targetEn} — a lighter pull`,
      ));
    } else if (r.kind === '相刑' || r.kind === '自刑') {
      delta -= 1;
      notes.push(t(
        `此运${targetZh}相刑，主内耗、口舌或健康之扰`,
        `This decade punishes the ${targetEn} — friction, disputes, or a drain on health`,
      ));
    } else {
      // 相害 / 相破 — real blemishes, but not enough to move the verdict.
      notes.push(t(
        `此运与${targetZh}${r.kind === '相害' ? '相害' : '相破'}，小有嫌隙`,
        `This decade ${r.kind === '相害' ? 'harms' : 'breaks'} the ${targetEn} — a minor snag`,
      ));
    }
  }

  // Bounded so 合冲 modulates the element base rather than overwhelming it.
  return { delta: Math.max(-RELATION_CAP, Math.min(RELATION_CAP, delta)), notes };
}

function scoreDecades(chart: Chart, yongShen: YongShenAnalysis): DecadeOutlook[] {
  const fav = new Set(yongShen.favourable);

  return chart.decades.map((d) => {
    const stemEl = elementOfStem(d.stem);
    const branchEl = elementOfBranch(d.branch);
    const notes: LocalizedText[] = [];
    let score = 0;

    if (fav.has(stemEl)) {
      score += 2;
      notes.push(t(`天干${d.stem}属${stemEl}，为用神一路`,
        `Stem ${d.stem} is ${ELEMENT[stemEl]!.en} — favourable`));
    } else {
      score -= 1;
      notes.push(t(`天干${d.stem}属${stemEl}，非用神`,
        `Stem ${d.stem} is ${ELEMENT[stemEl]!.en} — not favourable`));
    }

    if (fav.has(branchEl)) {
      score += 2;
      notes.push(t(`地支${d.branch}属${branchEl}，为用神一路`,
        `Branch ${d.branch} is ${ELEMENT[branchEl]!.en} — favourable`));
    } else {
      score -= 1;
      notes.push(t(`地支${d.branch}属${branchEl}，非用神`,
        `Branch ${d.branch} is ${ELEMENT[branchEl]!.en} — not favourable`));
    }

    // 合冲 with the natal chart — the character layer over element favourability.
    const rel = scoreDecadeRelations(chart, d.stem, d.branch, fav);
    score += rel.delta;
    notes.push(...rel.notes);

    if (d.isVoid) {
      score -= 1;
      notes.push(t('此运落空亡，力量打折', 'This pillar falls void, which discounts its force'));
    }

    return {
      index: d.index,
      startAge: d.startAge,
      endAge: d.endAge,
      startYear: d.startYear,
      endYear: d.endYear,
      ganZhi: d.ganZhi,
      score,
      // Range is -5..+6: element base -3..+4, plus a bounded 合冲 layer of ±2.
      //
      // 不利 is reserved for a decade that is actively adverse — 忌 elements AND
      // a real disruption on top (a core 冲 -2, a 刑, or 旬空). A decade that
      // merely lacks the 用神 sits at the element base's -2 and reads as 平稳:
      // absence of help is not the presence of harm, and calling an unremarkable
      // decade "difficult" makes the whole timeline read as relentless and
      // untrustworthy. So 平稳 runs down to -2, and 不利 begins at -3.
      verdict: score >= 3 ? '有利' : score >= 1 ? '偏顺' : score >= -2 ? '平稳' : '不利',
      notes,
    } satisfies DecadeOutlook;
  });
}

export function analyzeCareer(
  chart: Chart,
  strength: StrengthAnalysis,
  yongShen: YongShenAnalysis,
): CareerAnalysis {
  const structure = determineStructure(chart);
  const { lean, why } = determineLean(strength);

  const dominantFamily = (Object.entries(strength.familyPercent) as [TenGodFamily, number][])
    .filter(([fam]) => fam !== '比劫')
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '财';

  const industries = INDUSTRIES[yongShen.primary];
  const direction = DIRECTIONS[yongShen.primary];
  const decades = scoreDecades(chart, yongShen);
  // 有利 means both pillars support the 用神. 偏顺 means one does and one
  // does not — worth mentioning, but calling it a strong decade oversells it.
  const favourableDecades = decades.filter((d) => d.verdict === '有利');
  const mildDecades = decades.filter((d) => d.verdict === '偏顺');
  const bestDecade = [...decades].sort((a, b) => b.score - a.score || a.startAge - b.startAge)[0] ?? null;

  const shensha = findShenSha(chart).filter((s) => s.topic === 'career');
  const f: Finding[] = [];
  const monthMainStem = chart.pillars.month.hiddenStems.find((h) => h.role === 'main')?.stem ?? '';
  const structureEn = STRUCTURE[structure.name]?.en ?? structure.name;

  f.push(finding({
    id: 'career.structure',
    topic: 'career',
    claim: t(
      `月令取${structure.name}${structure.exposed ? '，且格神透干，格局清晰' : '，格神未透，方向需自己摸索'}。`,
      `The month gives you a ${structureEn}` +
        (structure.exposed
          ? `, and its governing stem shows openly — the structure is clean and the direction is legible.`
          : `, but its governing stem stays hidden. The shape is there; you will have to find the direction yourself.`),
    ),
    evidence: [
      t(
        `月支 ${chart.pillars.month.branch} 本气 ${monthMainStem}（${structure.tenGod}）`,
        `Month branch ${chart.pillars.month.branch}, primary hidden stem ` +
          `${monthMainStem} (${TEN_GOD[structure.tenGod]!.en})`,
      ),
      structure.exposed
        ? t('格神于天干得见', 'The governing stem is visible above')
        : t('格神仅藏于地支', 'The governing stem is hidden in the branches only'),
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 9,
  }));

  f.push(finding({
    id: 'career.lean',
    topic: 'career',
    claim: t(`${lean}。`, `${LEAN_LABEL[lean].en}.`),
    evidence: [
      why,
      t(
        `旺衰判定 ${strength.verdict}（支持度 ${strength.supportPercent}%）`,
        `Strength: ${strength.verdict === '身强' ? 'strong' : strength.verdict === '身弱' ? 'weak' : 'balanced'} ` +
          `(support ${strength.supportPercent}%)`,
      ),
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 10,
  }));

  f.push(finding({
    id: 'career.industry',
    topic: 'career',
    claim: t(
      `用神为${yongShen.primary}，宜走${yongShen.primary}性行业：` +
        `${industries.slice(0, 5).map((i) => i.zh).join('、')}等；方位利${direction}。`,
      `Your favourable element is ${ELEMENT[yongShen.primary]!.en}, so ` +
        `${ELEMENT[yongShen.primary]!.en}-natured work suits you: ` +
        `${industries.slice(0, 5).map((i) => i.en).join(', ')}. ` +
        `Direction favours the ${DIRECTION[direction]?.en ?? direction}.`,
    ),
    evidence: [
      t(
        `用神 ${yongShen.primary}（${yongShen.primaryFamily}）`,
        `Favourable element ${ELEMENT[yongShen.primary]!.en} ` +
          `(${TEN_GOD_FAMILY[yongShen.primaryFamily]!.en})`,
      ),
      t(`取用流派：${yongShen.school.zh}`, `Method used: ${yongShen.school.en}`),
      ...(yongShen.climateConflict && yongShen.climateNeed
        ? [t(
            `⚠️ 调候另取${yongShen.climateNeed}，与扶抑不一致，行业选择可两者兼顾`,
            `⚠️ On climate grounds ${ELEMENT[yongShen.climateNeed]!.en} is wanted instead. ` +
              `The two methods disagree, so a sector spanning both is defensible.`,
          )]
        : []),
    ],
    confidence: yongShen.climateConflict ? 'low' : 'medium',
    requiresHour: false,
    salience: 9,
  }));

  f.push(finding({
    id: 'career.dominant',
    topic: 'career',
    claim: t(
      `十神以${dominantFamily}最重（${strength.familyPercent[dominantFamily]}%），` +
        familyCareerMeaning(dominantFamily).zh,
      `${TEN_GOD_FAMILY[dominantFamily]!.en} is the heaviest force in your chart at ` +
        `${strength.familyPercent[dominantFamily]}%. ` +
        familyCareerMeaning(dominantFamily).en,
    ),
    evidence: (Object.entries(strength.familyPercent) as [TenGodFamily, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([fam, pct]) => t(`${fam} ${pct}%`, `${TEN_GOD_FAMILY[fam]!.en} ${pct}%`)),
    confidence: 'high',
    requiresHour: false,
    salience: 8,
  }));

  const decadeSpan = (d: DecadeOutlook) => t(
    `${d.startAge}-${d.endAge}岁（${d.startYear}-${d.endYear}，${d.ganZhi}）`,
    `ages ${d.startAge}–${d.endAge} (${d.startYear}–${d.endYear}, ${d.ganZhi})`,
  );
  const decadeNotes = (list: readonly DecadeOutlook[]) =>
    list.flatMap((d) => d.notes.map((n) => t(`${d.ganZhi}运：${n.zh}`, `${d.ganZhi}: ${n.en}`)));

  if (favourableDecades.length > 0) {
    f.push(finding({
      id: 'career.timing.favourable',
      topic: 'career',
      claim: t(
        `事业较得力的大运：${favourableDecades.map((d) => decadeSpan(d).zh).join('、')}。`,
        `Your strongest luck pillars for work: ` +
          `${favourableDecades.map((d) => decadeSpan(d).en).join('; ')}.`,
      ),
      evidence: decadeNotes(favourableDecades),
      confidence: 'medium',
      requiresHour: false,
      salience: 10,
    }));
  } else if (mildDecades.length > 0) {
    f.push(finding({
      id: 'career.timing.mild',
      topic: 'career',
      claim: t(
        `前十步大运中没有干支俱为用神的强运，较为顺遂的是：` +
          `${mildDecades.map((d) => `${d.startAge}-${d.endAge}岁（${d.ganZhi}）`).join('、')}，` +
          `皆为一柱得用、一柱不得用，事业进展靠积累多于际遇。`,
        `None of the first ten luck pillars has both stem and branch in your ` +
          `favour. The better ones are ` +
          `${mildDecades.map((d) => `ages ${d.startAge}–${d.endAge} (${d.ganZhi})`).join('; ')} — ` +
          `each half favourable, half not. Progress here comes from accumulation ` +
          `rather than from a break.`,
      ),
      evidence: decadeNotes(mildDecades),
      confidence: 'medium',
      requiresHour: false,
      salience: 9,
    }));
  } else {
    // Defensive only. Ten consecutive decades cover all ten stems, so at least
    // two always carry a favourable stem and score into 偏顺 — reaching here
    // needs every such decade to also be 空亡. Swept 3,648 charts without a
    // single hit; kept so the topic always emits a timing finding.
    f.push(finding({
      id: 'career.timing.none',
      topic: 'career',
      claim: t(
        '前十步大运中未见明显的用神旺运，事业进展偏靠积累而非际遇，宜稳中求进。',
        'No luck pillar in the first ten clearly favours you. Career progress ' +
          'will come from steady accumulation rather than opportunity.',
      ),
      evidence: decades.map((d) => t(
        `${d.startAge}岁 ${d.ganZhi}：${d.verdict}（${d.score}分）`,
        `Age ${d.startAge} ${d.ganZhi}: score ${d.score}`,
      )),
      confidence: 'medium',
      requiresHour: false,
      salience: 8,
    }));
  }

  const adverse = decades.filter((d) => d.verdict === '不利');
  if (adverse.length > 0) {
    f.push(finding({
      id: 'career.timing.adverse',
      topic: 'career',
      claim: t(
        `须留意的大运：${adverse.map((d) => `${d.startAge}-${d.endAge}岁（${d.ganZhi}）`).join('、')}，` +
          `此期间不宜大幅扩张或贸然转行。`,
        `Pillars to watch: ` +
          `${adverse.map((d) => `ages ${d.startAge}–${d.endAge} (${d.ganZhi})`).join('; ')}. ` +
          `Not the time to expand hard or change field on impulse — this is a ` +
          `caution about pace, not a warning of disaster.`,
      ),
      evidence: decadeNotes(adverse),
      confidence: 'medium',
      requiresHour: false,
      salience: 7,
    }));
  }

  if (shensha.length > 0) {
    const names = [...new Set(shensha.map((s) => s.name))];
    f.push(finding({
      id: 'career.shensha',
      topic: 'career',
      claim: t(
        `事业相关神煞：${names.join('、')}。`,
        `Symbolic stars bearing on work: ${names.map((n) => SHENSHA[n]?.en ?? n).join(', ')}.`,
      ),
      evidence: shensha.map((s) => t(
        `${s.name} 在${s.position}${s.branch} — ${s.meaning.zh}`,
        `${SHENSHA[s.name]?.en ?? s.name} on the ${s.branch} branch — ${s.meaning.en}`,
      )),
      confidence: 'low',
      requiresHour: shensha.every((s) => s.position === '时支'),
      salience: 4,
    }));
  }

  return {
    structure: structure.name,
    structureExposed: structure.exposed,
    dominantFamily,
    lean,
    industries,
    direction,
    decades,
    bestDecade,
    findings: f.sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0)),
  };
}

function familyCareerMeaning(family: TenGodFamily): LocalizedText {
  switch (family) {
    case '官杀':
      return t(
        '重责任与规矩，在有层级的组织里升得上去，但压力也来自于此。',
        'You take responsibility and respect the rules, which is why you rise in ' +
          'organisations with a hierarchy — and also where the pressure comes from.',
      );
    case '财':
      return t(
        '对资源与机会敏感，务实、看重回报，适合直接与钱和客户打交道。',
        'You read resources and opportunities well, and you are practical about ' +
          'return. Work that puts you directly in front of money and customers suits you.',
      );
    case '食伤':
      return t(
        '表达与创造力强，靠作品、技艺或点子取胜，受不了被框死。',
        'Expression and invention are your edge — you win on work, craft or ideas, ' +
          'and you do badly when boxed in.',
      );
    case '印':
      return t(
        '重学习与资历，靠专业身份立足，起步慢但根基稳。',
        'You lean on learning and credentials, and you stand on professional ' +
          'standing. Slow to start, but the foundation holds.',
      );
    case '比劫':
      return t(
        '重同侪与合作，做事靠人脉与团队，但也容易在分利上生嫌隙。',
        'You work through peers and teams, and your network does real work for ' +
          'you — but splitting the proceeds is where friction tends to appear.',
      );
  }
}
