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
 *
 * Claims are authored in both languages at the point they are made. The English
 * is not a translation — it has to carry a term the reader has never met, so it
 * says what the Chinese means rather than what it literally says.
 */

import { annualLuck } from '../../engine/chart';
import type { Chart, Element, Pillar, TenGod } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import { ELEMENT, RELATION, SHENSHA, TEN_GOD, TERM } from '../../i18n/glossary';
import { FAMILY_OF, elementOfBranch, familyElement } from '../elements';
import { finding, type Finding } from '../findings';
import { findRelations, isBranchRelation, type PositionedPillar, type Relation } from '../relations';
import { findShenSha } from '../shensha';
import type { StrengthAnalysis } from '../strength';
import type { YongShenAnalysis } from '../yongshen';

/** Where a 十神 was found, and how exposed it is. */
interface StarLocation {
  readonly position: LocalizedText;
  readonly tenGod: TenGod;
  readonly exposed: boolean; // 透干 (in a stem) rather than buried in 藏干
  readonly stem: string;
  readonly isHourPillar: boolean;
}

export interface MarriageWindow {
  readonly year: number;
  readonly age: number;
  readonly ganZhi: string;
  readonly score: number;
  readonly triggers: readonly LocalizedText[];
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

const PILLAR_LABEL: Record<string, LocalizedText> = {
  year: t('年柱', 'year pillar'),
  month: t('月柱', 'month pillar'),
  day: t('日柱', 'day pillar'),
  hour: t('时柱', 'hour pillar'),
};

function locateStar(chart: Chart, stars: readonly TenGod[]): StarLocation[] {
  const out: StarLocation[] = [];
  const pillars = [
    chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour,
  ].filter((p): p is Pillar => p !== null);

  for (const p of pillars) {
    const label = PILLAR_LABEL[p.position]!;
    if (p.tenGod && stars.includes(p.tenGod)) {
      out.push({
        position: label,
        tenGod: p.tenGod,
        exposed: true,
        stem: p.stem,
        isHourPillar: p.position === 'hour',
      });
    }
    for (const h of p.hiddenStems) {
      if (stars.includes(h.tenGod)) {
        out.push({
          position: t(`${label.zh}（${p.branch}藏）`, `${label.en} (hidden in ${p.branch})`),
          tenGod: h.tenGod,
          exposed: false,
          stem: h.stem,
          isHourPillar: p.position === 'hour',
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
    shensha, windows, starElement,
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
  const years = annualLuck(chart, birthYear + 16, birthYear + 60);
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
    const triggers: LocalizedText[] = [];
    let volatile = false;

    for (const r of rels) {
      // Only branch relations reach the palace, and only ones the 流年 itself
      // takes part in mark that year — a 大运-to-natal relation is true for the
      // whole decade and cannot single out a year within it.
      if (!r.positions.includes('流年')) continue;
      if (!r.positions.includes('日柱')) continue;
      if (!isBranchRelation(r)) continue;

      const rel = RELATION[r.kind]!.en;
      if (r.polarity === 'harmonising') {
        score += 3;
        triggers.push(t(
          `${r.label}（合动夫妻宫）`,
          `${rel} on the Spouse Palace (${r.values.join('–')})`,
        ));
      } else {
        volatile = true;
        score += 2;
        triggers.push(t(
          `${r.label}（冲动夫妻宫，主变动）`,
          `${rel} against the Spouse Palace (${r.values.join('–')}) — brings change`,
        ));
      }
    }

    if (y.stemTenGod === primaryStar || y.branchMainTenGod === primaryStar) {
      score += 3;
      triggers.push(t(
        `流年${y.ganZhi}见${primaryStar}（配偶星到位）`,
        `The year ${y.ganZhi} carries ${TEN_GOD[primaryStar]!.en} — the spouse star is present`,
      ));
    } else if (y.stemTenGod === secondaryStar || y.branchMainTenGod === secondaryStar) {
      score += 1;
      triggers.push(t(
        `流年${y.ganZhi}见${secondaryStar}`,
        `The year ${y.ganZhi} carries ${TEN_GOD[secondaryStar]!.en}`,
      ));
    }

    if (decade.stemTenGod === primaryStar || decade.branchMainTenGod === primaryStar) {
      score += 2;
      triggers.push(t(
        `大运${decade.ganZhi}行${primaryStar}运`,
        `The ${decade.ganZhi} luck pillar runs ${TEN_GOD[primaryStar]!.en}`,
      ));
    }

    // A decade whose own pillars carry the spouse star raises every year in it.
    if (fav.has(elementOfBranch(decade.branch))) {
      score += 1;
      triggers.push(t(
        `大运${decade.ganZhi}地支为用神一路`,
        `The ${decade.ganZhi} luck pillar sits on a favourable element`,
      ));
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
  starElement: Element;
}

/** The spouse star, named so an English reader knows what it is for. */
function starLabel(star: TenGod, isMale: boolean): LocalizedText {
  return t(star, `${TEN_GOD[star]!.en} (the ${isMale ? 'wife' : 'husband'} star)`);
}

function buildFindings(ctx: FindingContext): Finding[] {
  const f: Finding[] = [];
  const { chart, palace, palaceTenGod, primaryStar, starPresence } = ctx;
  const isMale = chart.gender === 'male';
  const star = starLabel(primaryStar, isMale);

  f.push(finding({
    id: 'rel.palace.content',
    topic: 'relationship',
    claim: t(
      `夫妻宫（日支${palace.branch}）本气为${palaceTenGod}，配偶的基本性情由此定调。`,
      `Your ${TERM['夫妻宫']!.en} — the day branch ${palace.branch} — is governed by ` +
        `${TEN_GOD[palaceTenGod]!.en}. That sets the basic character of the partnership.`,
    ),
    evidence: [
      t(`日柱 ${palace.ganZhi}`, `Day pillar ${palace.ganZhi}`),
      t(
        `日支 ${palace.branch} 藏 ${palace.hiddenStems.map((h) => `${h.stem}${h.tenGod}`).join('、')}`,
        `Day branch ${palace.branch} hides ` +
          palace.hiddenStems.map((h) => `${h.stem} (${TEN_GOD[h.tenGod]!.en})`).join(', '),
      ),
    ],
    confidence: 'high',
    requiresHour: false,
    salience: 10,
  }));

  if (starPresence === 'absent') {
    f.push(finding({
      id: 'rel.star.absent',
      topic: 'relationship',
      claim: t(
        `命中不见${primaryStar}（${isMale ? '妻星' : '夫星'}），感情多靠大运流年引动，` +
          `自身主动追求的动力较弱，婚缘偏晚。`,
        `Your chart contains no ${star.en} anywhere. Relationships tend to be ` +
          `triggered by the luck cycles rather than by your own pursuit, which ` +
          `usually means marriage arrives later than for most.`,
      ),
      evidence: [t(
        `四柱天干与藏干中均无${primaryStar}`,
        `${TEN_GOD[primaryStar]!.en} appears in neither the visible stems nor the hidden stems`,
      )],
      confidence: 'high',
      requiresHour: false,
      salience: 9,
    }));
  } else if (starPresence === 'hidden') {
    f.push(finding({
      id: 'rel.star.hidden',
      topic: 'relationship',
      claim: t(
        `${primaryStar}藏而不透，感情偏内敛，缘分需要机会引动，不易在人群中主动显露。`,
        `Your ${star.en} is hidden inside the branches rather than showing in the ` +
          `stems. Feeling runs inward; a connection needs an occasion to surface, ` +
          `and you are unlikely to signal interest in a room full of people.`,
      ),
      evidence: ctx.starLocations.map((l) => t(
        `${l.position.zh} 藏 ${l.stem}（${l.tenGod}）`,
        `${l.position.en} hides ${l.stem} (${TEN_GOD[l.tenGod]!.en})`,
      )),
      confidence: 'high',
      requiresHour: false,
      salience: 8,
    }));
  } else {
    // Name the star that is actually exposed. 正财 and 偏财 both count as a
    // spouse star but read differently, and claiming 正财 while the evidence
    // shows 偏财 is exactly the kind of slip a practitioner will catch.
    const exposed = ctx.starLocations.filter((l) => l.exposed);
    const names = [...new Set(exposed.map((l) => l.tenGod))];
    const onlySecondary = !names.includes(primaryStar);

    f.push(finding({
      id: 'rel.star.exposed',
      topic: 'relationship',
      claim: onlySecondary
        ? t(
            `${names.join('、')}透干而${primaryStar}不透，异性缘不缺，但偏向随性、缘起缘落，` +
              `稳定的正缘要靠运引动。`,
            `${names.map((n) => TEN_GOD[n]!.en).join(' and ')} shows openly in your ` +
              `stems, but ${TEN_GOD[primaryStar]!.en} — the steadier of the two — ` +
              `does not. Attention is not in short supply; it simply arrives and ` +
              `leaves easily. A lasting match needs the luck cycles to bring it.`,
          )
        : t(
            `${names.join('、')}透干，感情态度外显，异性缘来得直接。`,
            `${names.map((n) => TEN_GOD[n]!.en).join(' and ')} shows openly in your ` +
              `stems. You wear your intentions where people can see them, and ` +
              `interest tends to arrive directly.`,
          ),
      evidence: exposed.map((l) => t(
        `${l.position.zh} 透 ${l.stem}（${l.tenGod}）`,
        `${l.position.en} shows ${l.stem} (${TEN_GOD[l.tenGod]!.en})`,
      )),
      confidence: 'high',
      requiresHour: exposed.every((l) => l.isHourPillar),
      salience: 8,
    }));
  }

  // Whether the spouse star helps or burdens the chart. This is what separates
  // "you will marry" from "marriage will suit you".
  f.push(finding({
    id: ctx.starIsFavourable ? 'rel.star.favourable' : 'rel.star.unfavourable',
    topic: 'relationship',
    claim: ctx.starIsFavourable
      ? t(
          `${primaryStar}为用神一路，婚姻对本人是助力，配偶多能带来实质帮助。`,
          `Your ${star.en} is one of the elements this chart actually needs. ` +
            `Marriage works in your favour — a partner is likely to bring real, ` +
            `practical help rather than only company.`,
        )
      : t(
          `${primaryStar}非用神，婚姻虽有，但需留意因感情而耗神费力，` +
            `择偶宜重实际相处而非一时热度。`,
          `Your ${star.en} is not among the elements this chart needs. Marriage ` +
            `is available, but relationships will tend to cost you energy rather ` +
            `than supply it. Choose on how someone actually lives alongside you, ` +
            `not on early intensity.`,
        ),
    evidence: [
      t(
        `用神 ${ctx.yongShen.primary}（${ctx.yongShen.primaryFamily}）`,
        `Favourable element: ${ELEMENT[ctx.yongShen.primary]!.en}`,
      ),
      t(
        `${primaryStar}属${FAMILY_OF[primaryStar]}，五行为${ctx.starElement}`,
        `${TEN_GOD[primaryStar]!.en} maps to the element ${ELEMENT[ctx.starElement]!.en}`,
      ),
      t(
        `取用流派：${ctx.yongShen.school.zh}`,
        `Method used: ${ctx.yongShen.school.en}`,
      ),
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 9,
  }));

  if (ctx.palaceDisturbances.length > 0) {
    const kindsEn = [...new Set(ctx.palaceDisturbances.map((r) => RELATION[r.kind]!.en))];
    f.push(finding({
      id: 'rel.palace.disturbed',
      topic: 'relationship',
      claim: t(
        `夫妻宫受${[...new Set(ctx.palaceDisturbances.map((r) => r.kind))].join('、')}，` +
          `婚姻关系易有波动或聚少离多，需要经营。`,
        `The Spouse Palace is disturbed by ${kindsEn.join(' and ')}. The ` +
          `relationship is prone to turbulence or time spent apart, and will need ` +
          `active tending rather than assumption.`,
      ),
      evidence: ctx.palaceDisturbances.map((r) => t(
        `${r.label}（${r.positions.join('↔')}）`,
        `${RELATION[r.kind]!.en}: ${r.values.join('–')}`,
      )),
      confidence: 'high',
      requiresHour: ctx.palaceDisturbances.every((r) => r.positions.includes('时柱')),
      salience: 8,
    }));
  } else {
    f.push(finding({
      id: 'rel.palace.stable',
      topic: 'relationship',
      claim: t(
        '原局夫妻宫未受刑冲害破，婚姻宫位本身安稳（大运流年引动另论）。',
        'In the natal chart the Spouse Palace takes no clash, punishment, harm or ' +
          'destruction. The seat of the marriage is sound in itself — what the ' +
          'luck cycles do to it later is a separate question.',
      ),
      evidence: [t(
        '原局日支未见冲、刑、害、破',
        'No clash, punishment, harm or destruction reaches the natal day branch',
      )],
      confidence: 'high',
      requiresHour: false,
      salience: 5,
    }));
  }

  if (isMale && ctx.strength.familyPercent['比劫'] >= 35) {
    f.push(finding({
      id: 'rel.male.competition',
      topic: 'relationship',
      claim: t(
        '比劫旺而夺财，感情上易遇竞争，或因朋友、合伙之事影响婚姻。',
        'Peers and rivals run strong here, and they compete for the same element ' +
          'as your wife star. Expect rivals for affection, or friendships and ' +
          'business partnerships that put pressure on the marriage.',
      ),
      evidence: [
        t(`比劫占 ${ctx.strength.familyPercent['比劫']}%`,
          `Peers hold ${ctx.strength.familyPercent['比劫']}% of the chart`),
        t(`妻星为${primaryStar}`, `The wife star is ${TEN_GOD[primaryStar]!.en}`),
      ],
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
        claim: t(
          '官杀混杂，感情选择多而杂，易有拉扯，宜专一取舍。',
          'Both husband stars appear — the steady one and the forceful one. ' +
            'Options are plentiful but muddled, and the pull between two types ' +
            'creates its own trouble. Deciding what you actually want matters ' +
            'more here than being chosen.',
        ),
        evidence: ctx.starLocations
          .filter((l) => l.tenGod === '正官' || l.tenGod === '七杀')
          .map((l) => t(
            `${l.position.zh} ${l.stem}（${l.tenGod}）`,
            `${l.position.en}: ${l.stem} (${TEN_GOD[l.tenGod]!.en})`,
          )),
        confidence: 'medium',
        requiresHour: false,
        salience: 7,
      }));
    }
    if (ctx.strength.familyPercent['食伤'] >= 35 && hasOfficer) {
      f.push(finding({
        id: 'rel.female.hurting-officer',
        topic: 'relationship',
        claim: t(
          '伤官见官，自我主张强于迁就，易与伴侣在主导权上磨合。',
          'Strong self-expression sits directly opposite the husband star. You ' +
            'assert rather than accommodate, and friction with a partner tends ' +
            'to be about who leads.',
        ),
        evidence: [
          t(`食伤占 ${ctx.strength.familyPercent['食伤']}%`,
            `Output holds ${ctx.strength.familyPercent['食伤']}% of the chart`),
          t('命中见正官', 'Direct Officer is present in the chart'),
        ],
        confidence: 'medium',
        requiresHour: false,
        salience: 7,
      }));
    }
  }

  if (ctx.shensha.length > 0) {
    const names = [...new Set(ctx.shensha.map((s) => s.name))];
    f.push(finding({
      id: 'rel.shensha',
      topic: 'relationship',
      claim: t(
        `感情相关神煞：${names.join('、')}。`,
        `Symbolic stars bearing on relationships: ` +
          `${names.map((n) => SHENSHA[n]?.en ?? n).join(', ')}.`,
      ),
      evidence: ctx.shensha.map((s) => t(
        `${s.name} 在${s.position}${s.branch}（以${s.reference}起）— ${s.meaning.zh}`,
        `${SHENSHA[s.name]?.en ?? s.name} on the ${s.branch} branch — ${s.meaning.en}`,
      )),
      confidence: 'low',
      requiresHour: ctx.shensha.every((s) => s.position === '时支'),
      salience: 4,
    }));
  }

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
          ? t(
              `本命夫妻宫逢${recurring}年即被引动，故每逢${recurring}年（约十二年一轮）` +
                `感情事最容易起变化：` +
                matching.map((w) => `${w.year}年（${w.age}岁）`).join('、') +
                `。这是命局结构使然，不是某一年独有的机缘。` +
                (others.length > 0
                  ? `另有 ${others.map((w) => `${w.year}年（${w.ganZhi}）`).join('、')} 因别的合局同样得力。`
                  : ''),
              `Any ${recurring} year stirs your Spouse Palace, so relationship ` +
                `matters tend to move roughly once every twelve years: ` +
                matching.map((w) => `${w.year} (age ${w.age})`).join(', ') +
                `. That is a structural feature of the chart repeating, not a ` +
                `run of separate strokes of luck.` +
                (others.length > 0
                  ? ` ${others.map((w) => `${w.year} (${w.ganZhi})`).join(', ')} also ` +
                    `carries weight, through a different combination.`
                  : ''),
            )
          : t(
              `婚缘引动较明显的年份：` +
                favourable.map((w) => `${w.year}年（${w.age}岁，${w.ganZhi}）`).join('、') + '。',
              `Years when the marriage prospect is most active: ` +
                favourable.map((w) => `${w.year} (age ${w.age}, ${w.ganZhi})`).join(', ') + '.',
            ),
        evidence: favourable.flatMap((w) =>
          w.triggers.map((tr) => t(`${w.year}：${tr.zh}`, `${w.year}: ${tr.en}`)),
        ),
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
        claim: t(
          `感情变动明显的年份：` +
            volatile.map((w) => `${w.year}年（${w.age}岁）`).join('、') +
            `。冲动夫妻宫主"变"，独身者可能因此成家，有伴者则需留意关系张力，` +
            `方向取决于当时的实际处境。`,
          `Years when the relationship situation is most likely to move: ` +
            volatile.map((w) => `${w.year} (age ${w.age})`).join(', ') +
            `. A clash to the Spouse Palace means change, not a direction — the ` +
            `same clash that ends a marriage also ends a long single spell. Which ` +
            `one it turns out to be depends on where you actually stand at the time.`,
        ),
        evidence: volatile.flatMap((w) =>
          w.triggers.map((tr) => t(`${w.year}：${tr.zh}`, `${w.year}: ${tr.en}`)),
        ),
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
      claim: t(
        '出生时辰未知，时柱相关的判断（如晚年感情、子女宫）已略去。',
        'The birth hour is unknown, so anything resting on the hour pillar — ' +
          'later-life relationships, the children palace — has been left out ' +
          'rather than guessed at.',
      ),
      evidence: [t('未提供出生时间', 'No birth time was supplied')],
      confidence: 'high',
      requiresHour: false,
      salience: 1,
    }));
  }

  return f.sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0));
}
