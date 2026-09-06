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
import { elementOfBranch, elementOfStem, type TenGodFamily } from '../elements';
import { finding, type Finding } from '../findings';
import { findShenSha } from '../shensha';
import type { StrengthAnalysis } from '../strength';
import type { YongShenAnalysis } from '../yongshen';

/** Sectors by element. Deliberately concrete: "金融" is useful, "金的行业" is not. */
const INDUSTRIES: Record<Element, readonly string[]> = {
  木: ['教育', '出版与文化', '纺织服装', '家具木材', '医药保健', '设计创意', '农林'],
  火: ['能源电力', '媒体广告', '餐饮', '娱乐演艺', '电子科技', '市场营销', '美容'],
  土: ['房地产', '建筑工程', '保险', '仓储物流', '农业', '咨询顾问', '陶瓷建材'],
  金: ['金融银行', '机械制造', '法律', '五金矿产', '汽车', '精密仪器', 'IT硬件'],
  水: ['贸易进出口', '航运物流', '旅游', '通信传媒', '饮料水产', '研究分析', '流通服务'],
};

/** Directions by element, for the 方位 question people always ask. */
const DIRECTIONS: Record<Element, string> = {
  木: '东方', 火: '南方', 土: '中部与本地', 金: '西方', 水: '北方',
};

export type CareerLean = '适合任职受雇' | '适合自主创业' | '两可，视运而定';

export interface DecadeOutlook {
  readonly index: number;
  readonly startAge: number;
  readonly endAge: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly ganZhi: string;
  readonly score: number;
  readonly verdict: '有利' | '偏顺' | '平稳' | '不利';
  readonly notes: readonly string[];
}

export interface CareerAnalysis {
  /** 格局 name, e.g. 正财格. */
  readonly structure: string;
  readonly structureExposed: boolean;
  readonly dominantFamily: TenGodFamily;
  readonly lean: CareerLean;
  readonly industries: readonly string[];
  readonly direction: string;
  readonly decades: readonly DecadeOutlook[];
  readonly bestDecade: DecadeOutlook | null;
  readonly findings: readonly Finding[];
}

/**
 * 格局 from the 月令.
 *
 * The month branch's 本气 gives the structure. 比肩 and 劫财 do not form a 格
 * in the ordinary sense — they are named 建禄 and 羊刃 instead.
 */
function determineStructure(chart: Chart): { name: string; exposed: boolean; tenGod: TenGod } {
  const monthMain = chart.pillars.month.hiddenStems.find((h) => h.role === 'main');
  const tenGod: TenGod = monthMain?.tenGod ?? '比肩';

  const name =
    tenGod === '比肩' ? '建禄格'
    : tenGod === '劫财' ? '羊刃格'
    : `${tenGod}格`;

  // 透干: the structure's stem also appears in a visible stem, which makes the
  // structure "clean" and the person's direction clearer.
  const stems = [
    chart.pillars.year.stem,
    chart.pillars.month.stem,
    ...(chart.pillars.hour ? [chart.pillars.hour.stem] : []),
  ];
  const exposed = monthMain ? stems.includes(monthMain.stem) : false;

  return { name, exposed, tenGod };
}

function determineLean(strength: StrengthAnalysis): { lean: CareerLean; why: string } {
  const s = strength.familyPercent;
  const strong = strength.verdict === '身强';
  const output = s['食伤'];
  const wealth = s['财'];
  const officer = s['官杀'];
  const seal = s['印'];

  if (strong && (wealth >= 20 || output >= 25)) {
    return {
      lean: '适合自主创业',
      why: `身强担得起财，食伤 ${output}% 与财 ${wealth}% 俱有力，` +
        `自主经营比受制于人更能发挥。`,
    };
  }
  if (!strong && (officer >= 20 || seal >= 20)) {
    return {
      lean: '适合任职受雇',
      why: `身弱而官印有力（官杀 ${officer}%、印 ${seal}%），` +
        `在有制度、有人带的组织里更稳，独自扛盘易力不从心。`,
    };
  }
  if (strong && officer >= 25) {
    return {
      lean: '适合任职受雇',
      why: `身强而官杀 ${officer}% 得力，适合在体制或大组织内担责掌权。`,
    };
  }
  return {
    lean: '两可，视运而定',
    why: `十神分布未见一面独强（官杀 ${officer}%、财 ${wealth}%、食伤 ${output}%），` +
      `受雇或自营皆可行，宜按大运选择时机。`,
  };
}

function scoreDecades(chart: Chart, yongShen: YongShenAnalysis): DecadeOutlook[] {
  const fav = new Set(yongShen.favourable);

  return chart.decades.map((d) => {
    const stemEl = elementOfStem(d.stem);
    const branchEl = elementOfBranch(d.branch);
    const notes: string[] = [];
    let score = 0;

    if (fav.has(stemEl)) { score += 2; notes.push(`天干${d.stem}属${stemEl}，为用神一路`); }
    else { score -= 1; notes.push(`天干${d.stem}属${stemEl}，非用神`); }

    if (fav.has(branchEl)) { score += 2; notes.push(`地支${d.branch}属${branchEl}，为用神一路`); }
    else { score -= 1; notes.push(`地支${d.branch}属${branchEl}，非用神`); }

    if (d.isVoid) { score -= 1; notes.push('此运落空亡，力量打折'); }

    return {
      index: d.index,
      startAge: d.startAge,
      endAge: d.endAge,
      startYear: d.startYear,
      endYear: d.endYear,
      ganZhi: d.ganZhi,
      score,
      // Range is -3..+4. 有利 needs at least one favourable pillar plus no
      // drag; 不利 needs both pillars against.
      verdict: score >= 3 ? '有利' : score >= 1 ? '偏顺' : score >= -1 ? '平稳' : '不利',
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

  f.push(finding({
    id: 'career.structure',
    topic: 'career',
    claim: `月令取${structure.name}${structure.exposed ? '，且格神透干，格局清晰' : '，格神未透，方向需自己摸索'}。`,
    evidence: [
      `月支 ${chart.pillars.month.branch} 本气 ${chart.pillars.month.hiddenStems.find((h) => h.role === 'main')?.stem ?? ''}（${structure.tenGod}）`,
      structure.exposed ? '格神于天干得见' : '格神仅藏于地支',
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 9,
  }));

  f.push(finding({
    id: 'career.lean',
    topic: 'career',
    claim: `${lean}。`,
    evidence: [
      why,
      `旺衰判定 ${strength.verdict}（支持度 ${strength.supportPercent}%）`,
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 10,
  }));

  f.push(finding({
    id: 'career.industry',
    topic: 'career',
    claim: `用神为${yongShen.primary}，宜走${yongShen.primary}性行业：` +
      `${industries.slice(0, 5).join('、')}等；方位利${direction}。`,
    evidence: [
      `用神 ${yongShen.primary}（${yongShen.primaryFamily}）`,
      `取用流派：${yongShen.school}`,
      ...(yongShen.climateConflict
        ? [`⚠️ 调候另取${yongShen.climateNeed}，与扶抑不一致，行业选择可两者兼顾`]
        : []),
    ],
    confidence: yongShen.climateConflict ? 'low' : 'medium',
    requiresHour: false,
    salience: 9,
  }));

  f.push(finding({
    id: 'career.dominant',
    topic: 'career',
    claim: `十神以${dominantFamily}最重（${strength.familyPercent[dominantFamily]}%），` +
      `${familyCareerMeaning(dominantFamily)}`,
    evidence: (Object.entries(strength.familyPercent) as [TenGodFamily, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([fam, pct]) => `${fam} ${pct}%`),
    confidence: 'high',
    requiresHour: false,
    salience: 8,
  }));

  if (favourableDecades.length > 0) {
    f.push(finding({
      id: 'career.timing.favourable',
      topic: 'career',
      claim: `事业较得力的大运：` +
        favourableDecades
          .map((d) => `${d.startAge}-${d.endAge}岁（${d.startYear}-${d.endYear}，${d.ganZhi}）`)
          .join('、') + '。',
      evidence: favourableDecades.flatMap((d) => d.notes.map((n) => `${d.ganZhi}运：${n}`)),
      confidence: 'medium',
      requiresHour: false,
      salience: 10,
    }));
  } else if (mildDecades.length > 0) {
    f.push(finding({
      id: 'career.timing.mild',
      topic: 'career',
      claim: `前十步大运中没有干支俱为用神的强运，较为顺遂的是：` +
        mildDecades
          .map((d) => `${d.startAge}-${d.endAge}岁（${d.ganZhi}）`)
          .join('、') +
        `，皆为一柱得用、一柱不得用，事业进展靠积累多于际遇。`,
      evidence: mildDecades.flatMap((d) => d.notes.map((n) => `${d.ganZhi}运：${n}`)),
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
      claim: '前十步大运中未见明显的用神旺运，事业进展偏靠积累而非际遇，宜稳中求进。',
      evidence: decades.map((d) => `${d.startAge}岁 ${d.ganZhi}：${d.verdict}（${d.score}分）`),
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
      claim: `须留意的大运：` +
        adverse.map((d) => `${d.startAge}-${d.endAge}岁（${d.ganZhi}）`).join('、') +
        `，此期间不宜大幅扩张或贸然转行。`,
      evidence: adverse.flatMap((d) => d.notes.map((n) => `${d.ganZhi}运：${n}`)),
      confidence: 'medium',
      requiresHour: false,
      salience: 7,
    }));
  }

  if (shensha.length > 0) {
    f.push(finding({
      id: 'career.shensha',
      topic: 'career',
      claim: `事业相关神煞：${[...new Set(shensha.map((s) => s.name))].join('、')}。`,
      evidence: shensha.map((s) => `${s.name} 在${s.position}${s.branch} — ${s.meaning}`),
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

function familyCareerMeaning(family: TenGodFamily): string {
  switch (family) {
    case '官杀': return '重责任与规矩，在有层级的组织里升得上去，但压力也来自于此。';
    case '财': return '对资源与机会敏感，务实、看重回报，适合直接与钱和客户打交道。';
    case '食伤': return '表达与创造力强，靠作品、技艺或点子取胜，受不了被框死。';
    case '印': return '重学习与资历，靠专业身份立足，起步慢但根基稳。';
    case '比劫': return '重同侪与合作，做事靠人脉与团队，但也容易在分利上生嫌隙。';
  }
}
