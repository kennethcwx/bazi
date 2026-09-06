/**
 * 姻缘 / 婚姻 — the relationship reading.
 *
 * Three questions drive everything here, in this order:
 *
 *   1. 夫妻宫 (the day branch) — the seat of the marriage. What sits in it, and
 *      is anything disturbing it?
 *   2. 配偶星 (the spouse star) — 正财 for a man, 正官 for a woman. Is it
 *      present, visible, strong, and is it a help or a hindrance to the chart?
 *   3. Timing — which 大运 and 流年 stir the palace or the star.
 *
 * A note on honesty in the timing scan: 冲 to the 日支 is genuinely ambiguous.
 * The same clash that ends a marriage also ends a long single spell, because
 * both are 变动 to the marriage palace. We report those years as volatile
 * rather than pretending to know the direction, which is what a careful
 * practitioner does too.
 */

import { annualLuck } from '../../engine/chart';
import type { Chart, Element, Pillar, TenGod } from '../../engine/types';
import { FAMILY_OF, elementOfBranch, familyElement } from '../elements';
import { finding, type Finding } from '../findings';
import { findRelations, isBranchRelation, type PositionedPillar, type Relation } from '../relations';
import { findShenSha } from '../shensha';
import type { StrengthAnalysis } from '../strength';
import type { YongShenAnalysis } from '../yongshen';

/** Where a 十神 was found, and how exposed it is. */
interface StarLocation {
  readonly position: string;
  readonly tenGod: TenGod;
  readonly exposed: boolean; // 透干 (in a stem) rather than buried in 藏干
  readonly stem: string;
}

export interface MarriageWindow {
  readonly year: number;
  readonly age: number;
  readonly ganZhi: string;
  readonly score: number;
  readonly triggers: readonly string[];
  /** favourable = the palace or star is being harmonised; volatile = it is
   *  being clashed, which moves the situation without saying which way. */
  readonly kind: 'favourable' | 'volatile';
}

export interface RelationshipAnalysis {
  readonly spousePalace: Pillar;
  readonly spousePalaceTenGod: TenGod;
  readonly primaryStar: TenGod;
  readonly secondaryStar: TenGod;
  readonly starLocations: readonly StarLocation[];
  readonly starPresence: 'exposed' | 'hidden' | 'absent';
  readonly starIsFavourable: boolean;
  readonly palaceDisturbances: readonly Relation[];
  readonly windows: readonly MarriageWindow[];
  readonly findings: readonly Finding[];
}

const POSITION_LABEL: Record<string, string> = {
  year: '年柱', month: '月柱', day: '日柱', hour: '时柱',
};

function locateStar(chart: Chart, stars: readonly TenGod[]): StarLocation[] {
  const out: StarLocation[] = [];
  const pillars = [
    chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour,
  ].filter((p): p is Pillar => p !== null);

  for (const p of pillars) {
    if (p.tenGod && stars.includes(p.tenGod)) {
      out.push({
        position: POSITION_LABEL[p.position] ?? p.position,
        tenGod: p.tenGod,
        exposed: true,
        stem: p.stem,
      });
    }
    for (const h of p.hiddenStems) {
      if (stars.includes(h.tenGod)) {
        out.push({
          position: `${POSITION_LABEL[p.position] ?? p.position}（${p.branch}藏）`,
          tenGod: h.tenGod,
          exposed: false,
          stem: h.stem,
        });
      }
    }
  }
  return out;
}

export function analyzeRelationship(
  chart: Chart,
  strength: StrengthAnalysis,
  yongShen: YongShenAnalysis,
): RelationshipAnalysis {
  const isMale = chart.gender === 'male';
  const primaryStar: TenGod = isMale ? '正财' : '正官';
  const secondaryStar: TenGod = isMale ? '偏财' : '七杀';

  const palace = chart.pillars.day;
  const palaceMain = palace.hiddenStems.find((h) => h.role === 'main');
  const palaceTenGod = palaceMain?.tenGod ?? '比肩';

  const starLocations = locateStar(chart, [primaryStar, secondaryStar]);
  const starPresence: RelationshipAnalysis['starPresence'] =
    starLocations.length === 0 ? 'absent'
    : starLocations.some((l) => l.exposed) ? 'exposed'
    : 'hidden';

  // Does the spouse star help the chart? Compare the element the star maps to
  // against the favourable set, not the family label — 用神 is chosen as an
  // element and only incidentally corresponds to a family.
  const starFamily = FAMILY_OF[primaryStar];
  const starElement = familyElement(chart.dayMasterElement, starFamily);
  const starIsFavourable = yongShen.favourable.includes(starElement);

  // Natal relations touching the marriage palace.
  const natal: PositionedPillar[] = [
    { position: '年柱', stem: chart.pillars.year.stem, branch: chart.pillars.year.branch },
    { position: '月柱', stem: chart.pillars.month.stem, branch: chart.pillars.month.branch },
    { position: '日柱', stem: palace.stem, branch: palace.branch },
    ...(chart.pillars.hour
      ? [{ position: '时柱', stem: chart.pillars.hour.stem, branch: chart.pillars.hour.branch }]
      : []),
  ];
  const natalRelations = findRelations(natal);
  // 夫妻宫 is the day BRANCH. A stem clash (日干 vs 时干) is a relationship
  // between the person and something else — it does not disturb the palace,
  // and counting it there was overstating the case.
  const palaceDisturbances = natalRelations.filter(
    (r) => r.positions.includes('日柱') && r.polarity === 'disturbing' && isBranchRelation(r),
  );

  const shensha = findShenSha(chart).filter((s) => s.topic === 'relationship');
  const windows = scanWindows(chart, primaryStar, secondaryStar, natal, yongShen.favourable);
  const findings = buildFindings({
    chart, strength, yongShen, palace, palaceTenGod, primaryStar,
    starLocations, starPresence, starIsFavourable, palaceDisturbances,
    shensha, windows, natalRelations,
  });

  return {
    spousePalace: palace,
    spousePalaceTenGod: palaceTenGod,
    primaryStar,
    secondaryStar,
    starLocations,
    starPresence,
    starIsFavourable,
    palaceDisturbances,
    windows,
    findings,
  };
}

/**
 * Scan 大运 x 流年 for years that stir the marriage palace or the spouse star.
 *
 * Only years inside a 大运 are scored, and the 大运 branch is included in the
 * relation search, because a 流年 often only becomes significant through the
 * decade it sits in.
 */
function scanWindows(
  chart: Chart,
  primaryStar: TenGod,
  secondaryStar: TenGod,
  natal: readonly PositionedPillar[],
  favourable: readonly Element[],
): MarriageWindow[] {
  const fav = new Set(favourable);
  const birthYear = chart.moment.charted.year;
  const from = birthYear + 16;
  const to = birthYear + 60;
  const years = annualLuck(chart, from, to);
  const out: MarriageWindow[] = [];

  for (const y of years) {
    const decade = chart.decades.find(
      (d) => y.year >= d.startYear && y.year <= d.endYear,
    );
    if (!decade) continue;

    const withLuck: PositionedPillar[] = [
      ...natal,
      { position: '大运', stem: decade.stem, branch: decade.branch },
      { position: '流年', stem: y.stem, branch: y.branch },
    ];
    const rels = findRelations(withLuck);

    let score = 0;
    const triggers: string[] = [];
    let volatile = false;

    for (const r of rels) {
      // Only branch relations reach the palace, and only ones the 流年 itself
      // takes part in mark that year — a 大运-to-natal relation is true for the
      // whole decade and cannot single out a year within it.
      if (!r.positions.includes('流年')) continue;
      if (!r.positions.includes('日柱')) continue;
      if (!isBranchRelation(r)) continue;

      if (r.polarity === 'harmonising') {
        score += 3;
        triggers.push(`${r.label}（合动夫妻宫）`);
      } else {
        volatile = true;
        score += 2;
        triggers.push(`${r.label}（冲动夫妻宫，主变动）`);
      }
    }

    if (y.stemTenGod === primaryStar || y.branchMainTenGod === primaryStar) {
      score += 3;
      triggers.push(`流年${y.ganZhi}见${primaryStar}（配偶星到位）`);
    } else if (y.stemTenGod === secondaryStar || y.branchMainTenGod === secondaryStar) {
      score += 1;
      triggers.push(`流年${y.ganZhi}见${secondaryStar}`);
    }

    if (decade.stemTenGod === primaryStar || decade.branchMainTenGod === primaryStar) {
      score += 2;
      triggers.push(`大运${decade.ganZhi}行${primaryStar}运`);
    }

    // A decade whose own pillars carry the spouse star raises every year in it.
    if (fav.has(elementOfBranch(decade.branch))) {
      score += 1;
      triggers.push(`大运${decade.ganZhi}地支为用神一路`);
    }

    if (score >= 5) {
      out.push({
        year: y.year,
        age: y.age,
        ganZhi: y.ganZhi,
        score,
        triggers,
        kind: volatile && score < 6 ? 'volatile' : 'favourable',
      });
    }
  }

  return out.sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 10);
}

/**
 * When the same 流年 branch keeps scoring, that is structural rather than
 * coincidental: this chart's 夫妻宫 is stirred by that branch every twelve
 * years. Saying so is more honest — and more useful — than presenting four
 * scattered years as if they were four independent predictions.
 */
function recurringBranch(windows: readonly MarriageWindow[]): string | null {
  const counts = new Map<string, number>();
  for (const w of windows) {
    const branch = w.ganZhi[1]!;
    counts.set(branch, (counts.get(branch) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 3 ? top[0] : null;
}

interface FindingContext {
  chart: Chart;
  strength: StrengthAnalysis;
  yongShen: YongShenAnalysis;
  palace: Pillar;
  palaceTenGod: TenGod;
  primaryStar: TenGod;
  starLocations: readonly StarLocation[];
  starPresence: 'exposed' | 'hidden' | 'absent';
  starIsFavourable: boolean;
  palaceDisturbances: readonly Relation[];
  shensha: ReturnType<typeof findShenSha>;
  windows: readonly MarriageWindow[];
  natalRelations: readonly Relation[];
}

function buildFindings(ctx: FindingContext): Finding[] {
  const f: Finding[] = [];
  const { chart, palace, palaceTenGod, primaryStar, starPresence } = ctx;
  const isMale = chart.gender === 'male';

  f.push(finding({
    id: 'rel.palace.content',
    topic: 'relationship',
    claim: `夫妻宫（日支${palace.branch}）本气为${palaceTenGod}，` +
      `配偶的基本性情由此定调。`,
    evidence: [
      `日柱 ${palace.ganZhi}`,
      `日支 ${palace.branch} 藏 ${palace.hiddenStems.map((h) => `${h.stem}${h.tenGod}`).join('、')}`,
    ],
    confidence: 'high',
    requiresHour: false,
    salience: 10,
  }));

  // Spouse star presence — the single most informative fact in the topic.
  if (starPresence === 'absent') {
    f.push(finding({
      id: 'rel.star.absent',
      topic: 'relationship',
      claim: `命中不见${primaryStar}（${isMale ? '妻星' : '夫星'}），` +
        `感情多靠大运流年引动，自身主动追求的动力较弱，婚缘偏晚。`,
      evidence: [`四柱天干与藏干中均无${primaryStar}`],
      confidence: 'high',
      requiresHour: false,
      salience: 9,
    }));
  } else if (starPresence === 'hidden') {
    f.push(finding({
      id: 'rel.star.hidden',
      topic: 'relationship',
      claim: `${primaryStar}藏而不透，感情偏内敛，缘分需要机会引动，` +
        `不易在人群中主动显露。`,
      evidence: ctx.starLocations.map((l) => `${l.position} 藏 ${l.stem}（${l.tenGod}）`),
      confidence: 'high',
      requiresHour: false,
      salience: 8,
    }));
  } else {
    // Name the star that is actually exposed. 正财 and 偏财 both count as a
    // spouse star but read differently, and claiming 正财 while the evidence
    // shows 偏财 is exactly the kind of slip a practitioner will catch.
    const exposed = ctx.starLocations.filter((l) => l.exposed);
    const exposedNames = [...new Set(exposed.map((l) => l.tenGod))];
    const onlySecondary = !exposedNames.includes(primaryStar);
    f.push(finding({
      id: 'rel.star.exposed',
      topic: 'relationship',
      claim: onlySecondary
        ? `${exposedNames.join('、')}透干而${primaryStar}不透，异性缘不缺，` +
          `但偏向随性、缘起缘落，稳定的正缘要靠运引动。`
        : `${exposedNames.join('、')}透干，感情态度外显，异性缘来得直接。`,
      evidence: exposed.map((l) => `${l.position} 透 ${l.stem}（${l.tenGod}）`),
      confidence: 'high',
      requiresHour: exposed.every((l) => l.position.startsWith('时柱')),
      salience: 8,
    }));
  }

  // Whether the spouse star helps or burdens the chart. This is what separates
  // "you will marry" from "marriage will suit you".
  f.push(finding({
    id: ctx.starIsFavourable ? 'rel.star.favourable' : 'rel.star.unfavourable',
    topic: 'relationship',
    claim: ctx.starIsFavourable
      ? `${primaryStar}为用神一路，婚姻对本人是助力，配偶多能带来实质帮助。`
      : `${primaryStar}非用神，婚姻虽有，但需留意因感情而耗神费力，` +
        `择偶宜重实际相处而非一时热度。`,
    evidence: [
      `用神 ${ctx.yongShen.primary}（${ctx.yongShen.primaryFamily}）`,
      `${primaryStar}属${FAMILY_OF[primaryStar]}，五行为${familyElement(chart.dayMasterElement, FAMILY_OF[primaryStar])}`,
      `取用流派：${ctx.yongShen.school}`,
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 9,
  }));

  // Palace disturbance.
  if (ctx.palaceDisturbances.length > 0) {
    f.push(finding({
      id: 'rel.palace.disturbed',
      topic: 'relationship',
      claim: `夫妻宫受${ctx.palaceDisturbances.map((r) => r.kind).join('、')}，` +
        `婚姻关系易有波动或聚少离多，需要经营。`,
      evidence: ctx.palaceDisturbances.map(
        (r) => `${r.label}（${r.positions.join('↔')}）`,
      ),
      confidence: 'high',
      requiresHour: ctx.palaceDisturbances.every((r) => r.positions.includes('时柱')),
      salience: 8,
    }));
  } else {
    f.push(finding({
      id: 'rel.palace.stable',
      topic: 'relationship',
      claim: '原局夫妻宫未受刑冲害破，婚姻宫位本身安稳（大运流年引动另论）。',
      evidence: ['原局日支未见冲、刑、害、破'],
      confidence: 'high',
      requiresHour: false,
      salience: 5,
    }));
  }

  // Gender-specific interference patterns.
  if (isMale && ctx.strength.familyPercent['比劫'] >= 35) {
    f.push(finding({
      id: 'rel.male.competition',
      topic: 'relationship',
      claim: '比劫旺而夺财，感情上易遇竞争，或因朋友、合伙之事影响婚姻。',
      evidence: [`比劫占 ${ctx.strength.familyPercent['比劫']}%`, `妻星为${primaryStar}`],
      confidence: 'medium',
      requiresHour: false,
      salience: 7,
    }));
  }

  if (!isMale) {
    const hasOfficer = ctx.starLocations.some((l) => l.tenGod === '正官');
    const hasKilling = ctx.starLocations.some((l) => l.tenGod === '七杀');
    if (hasOfficer && hasKilling) {
      f.push(finding({
        id: 'rel.female.mixed',
        topic: 'relationship',
        claim: '官杀混杂，感情选择多而杂，易有拉扯，宜专一取舍。',
        evidence: ctx.starLocations
          .filter((l) => l.tenGod === '正官' || l.tenGod === '七杀')
          .map((l) => `${l.position} ${l.stem}（${l.tenGod}）`),
        confidence: 'medium',
        requiresHour: false,
        salience: 7,
      }));
    }
    if (ctx.strength.familyPercent['食伤'] >= 35 && hasOfficer) {
      f.push(finding({
        id: 'rel.female.hurting-officer',
        topic: 'relationship',
        claim: '伤官见官，自我主张强于迁就，易与伴侣在主导权上磨合。',
        evidence: [`食伤占 ${ctx.strength.familyPercent['食伤']}%`, '命中见正官'],
        confidence: 'medium',
        requiresHour: false,
        salience: 7,
      }));
    }
  }

  // 神煞 — grouped into one finding, not one per star, to avoid noise.
  if (ctx.shensha.length > 0) {
    f.push(finding({
      id: 'rel.shensha',
      topic: 'relationship',
      claim: `感情相关神煞：${[...new Set(ctx.shensha.map((s) => s.name))].join('、')}。`,
      evidence: ctx.shensha.map(
        (s) => `${s.name} 在${s.position}${s.branch}（以${s.reference}起）— ${s.meaning}`,
      ),
      confidence: 'low',
      requiresHour: ctx.shensha.every((s) => s.position === '时支'),
      salience: 4,
    }));
  }

  // Timing.
  if (ctx.windows.length > 0) {
    const favourable = ctx.windows.filter((w) => w.kind === 'favourable').slice(0, 4);
    if (favourable.length > 0) {
      const recurring = recurringBranch(ctx.windows);
      // Only list years that actually carry the recurring branch, or the claim
      // contradicts its own examples.
      const matching = recurring
        ? favourable.filter((w) => w.ganZhi[1] === recurring)
        : favourable;
      const others = recurring
        ? favourable.filter((w) => w.ganZhi[1] !== recurring)
        : [];
      f.push(finding({
        id: 'rel.timing.favourable',
        topic: 'relationship',
        claim: recurring
          ? `本命夫妻宫逢${recurring}年即被引动，故每逢${recurring}年（约十二年一轮）` +
            `感情事最容易起变化：` +
            matching.map((w) => `${w.year}年（${w.age}岁）`).join('、') +
            `。这是命局结构使然，不是某一年独有的机缘。` +
            (others.length > 0
              ? `另有 ${others.map((w) => `${w.year}年（${w.ganZhi}）`).join('、')} 因别的合局同样得力。`
              : '')
          : `婚缘引动较明显的年份：` +
            favourable.map((w) => `${w.year}年（${w.age}岁，${w.ganZhi}）`).join('、') + '。',
        evidence: favourable.flatMap((w) => w.triggers.map((t) => `${w.year}：${t}`)),
        confidence: 'medium',
        requiresHour: false,
        salience: 10,
      }));
    }
    const volatile = ctx.windows.filter((w) => w.kind === 'volatile').slice(0, 3);
    if (volatile.length > 0) {
      f.push(finding({
        id: 'rel.timing.volatile',
        topic: 'relationship',
        claim: `感情变动明显的年份：` +
          volatile.map((w) => `${w.year}年（${w.age}岁）`).join('、') +
          `。冲动夫妻宫主"变"，独身者可能因此成家，有伴者则需留意关系张力，` +
          `方向取决于当时的实际处境。`,
        evidence: volatile.flatMap((w) => w.triggers.map((t) => `${w.year}：${t}`)),
        confidence: 'low',
        requiresHour: false,
        salience: 6,
      }));
    }
  }

  if (!chart.hourKnown) {
    f.push(finding({
      id: 'rel.no-hour',
      topic: 'relationship',
      claim: '出生时辰未知，时柱相关的判断（如晚年感情、子女宫）已略去。',
      evidence: ['未提供出生时间'],
      confidence: 'high',
      requiresHour: false,
      salience: 1,
    }));
  }

  return f.sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0));
}
