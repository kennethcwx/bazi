/**
 * 合婚 — reading two charts against each other.
 *
 * The design decision that matters here: **compatibility is not symmetric, and
 * this reports it that way.** One person can be fed by the other's chart while
 * giving little back. Collapsing that into a single "87% match" is the single
 * most dishonest thing this kind of product does, and it is also the least
 * useful — "you supply what they lack, they do not supply what you lack" is
 * something a couple can actually act on.
 *
 * Four factors, in descending order of how much classical practice trusts them:
 *
 *   1. 用神 supply — does each chart carry what the other actually needs?
 *      This is the deep one and the one worth most weight.
 *   2. 日柱 relation — the two marriage palaces meeting directly.
 *   3. 配偶星 — is one person's Day Master literally the other's spouse star?
 *   4. 生肖 (年支) — the folk favourite, and the weakest. Included because
 *      everyone asks, weighted low because it sorts the world into twelve boxes.
 */

import type { Chart, Element } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import { ELEMENT, RELATION, TEN_GOD } from '../../i18n/glossary';
import { FAMILY_OF, familyElement, tenGodFamily } from '../elements';
import { finding, type Finding } from '../findings';
import { findRelations, isBranchRelation, type Relation } from '../relations';
import type { StrengthAnalysis } from '../strength';
import type { YongShenAnalysis } from '../yongshen';

export interface Side {
  readonly chart: Chart;
  readonly strength: StrengthAnalysis;
  readonly yongShen: YongShenAnalysis;
}

export interface CompatibilityAnalysis {
  /** How much of the partner's chart is made of what this person needs, 0-100.
   *  Reported per direction because the two are rarely equal. */
  readonly supplyToA: number;
  readonly supplyToB: number;
  readonly dayRelations: readonly Relation[];
  readonly yearRelations: readonly Relation[];
  /** True when one Day Master is literally the other's spouse star. */
  readonly aSeesSpouseStar: boolean;
  readonly bSeesSpouseStar: boolean;
  readonly findings: readonly Finding[];
}

/**
 * What share of one chart is made of the elements the other needs.
 *
 * Summing the partner's element percentages over the subject's favourable set
 * gives a direct, explainable number — no weighting invented to make a score
 * look precise.
 */
function supply(favourable: readonly Element[], partner: Record<Element, number>): number {
  const total = favourable.reduce((sum, e) => sum + (partner[e] ?? 0), 0);
  return Math.round(total * 10) / 10;
}

/** A plain reading of a supply figure, without inventing precision. */
function supplyBand(pct: number): LocalizedText {
  if (pct >= 45) return t('很足', 'strongly');
  if (pct >= 30) return t('够用', 'adequately');
  if (pct >= 18) return t('偏少', 'thinly');
  return t('几乎没有', 'barely at all');
}

export function analyzeCompatibility(a: Side, b: Side): CompatibilityAnalysis {
  const supplyToA = supply(a.yongShen.favourable, b.strength.elementPercent);
  const supplyToB = supply(b.yongShen.favourable, a.strength.elementPercent);

  const dayRelations = findRelations([
    { position: '本人日柱', stem: a.chart.pillars.day.stem, branch: a.chart.pillars.day.branch },
    { position: '对方日柱', stem: b.chart.pillars.day.stem, branch: b.chart.pillars.day.branch },
  ]);
  const yearRelations = findRelations([
    { position: '本人年柱', stem: a.chart.pillars.year.stem, branch: a.chart.pillars.year.branch },
    { position: '对方年柱', stem: b.chart.pillars.year.stem, branch: b.chart.pillars.year.branch },
  ]);

  // Is one Day Master literally the other's spouse star?
  const aStar = a.chart.gender === 'male' ? '正财' : '正官';
  const bStar = b.chart.gender === 'male' ? '正财' : '正官';
  const aStarElement = familyElement(a.chart.dayMasterElement, FAMILY_OF[aStar]);
  const bStarElement = familyElement(b.chart.dayMasterElement, FAMILY_OF[bStar]);
  const aSeesSpouseStar = b.chart.dayMasterElement === aStarElement;
  const bSeesSpouseStar = a.chart.dayMasterElement === bStarElement;

  const findings: Finding[] = [];

  // --- 1. 用神 supply, per direction ---
  const bandA = supplyBand(supplyToA);
  const bandB = supplyBand(supplyToB);
  const lopsided = Math.abs(supplyToA - supplyToB) >= 18;

  findings.push(finding({
    id: 'compat.supply',
    topic: 'relationship',
    claim: lopsided
      ? t(
          `两人补益并不对等：对方的命局为你提供了 ${supplyToA}% 的用神之气（${bandA.zh}），` +
            `而你为对方提供 ${supplyToB}%（${bandB.zh}）。` +
            `${supplyToA > supplyToB ? '你从这段关系里得到的，多于你给出的' : '你给出的，多于你从中得到的'}——` +
            `这不是谁对谁错，但长期相处要意识到这个落差。`,
          `The benefit here runs unevenly. Their chart supplies ${supplyToA}% of ` +
            `what yours needs (${bandA.en}), while yours supplies ${supplyToB}% of ` +
            `what theirs needs (${bandB.en}). ` +
            `${supplyToA > supplyToB ? 'You draw more from this than you give.' : 'You give more to this than you draw.'} ` +
            `Neither of you is at fault for that, but you should both know it.`,
        )
      : t(
          `两人互补大致对等：对方为你提供 ${supplyToA}% 的用神之气（${bandA.zh}），` +
            `你为对方提供 ${supplyToB}%（${bandB.zh}）。`,
          `The benefit runs fairly evenly. Their chart supplies ${supplyToA}% of what ` +
            `yours needs (${bandA.en}); yours supplies ${supplyToB}% of theirs (${bandB.en}).`,
        ),
    evidence: [
      t(
        `你的用神：${a.yongShen.favourable.join('、')}；对方命中此类占 ${supplyToA}%`,
        `You need ${a.yongShen.favourable.map((e) => ELEMENT[e]!.en).join(' and ')}; ` +
          `their chart is ${supplyToA}% those elements`,
      ),
      t(
        `对方用神：${b.yongShen.favourable.join('、')}；你命中此类占 ${supplyToB}%`,
        `They need ${b.yongShen.favourable.map((e) => ELEMENT[e]!.en).join(' and ')}; ` +
          `your chart is ${supplyToB}% those elements`,
      ),
      t(
        `取用流派：${a.yongShen.school.zh}`,
        `Method used: ${a.yongShen.school.en}`,
      ),
    ],
    confidence: 'medium',
    requiresHour: false,
    salience: 10,
  }));

  // --- 2. 日柱: the two marriage palaces meeting ---
  const dayBranch = dayRelations.filter(isBranchRelation);
  if (dayBranch.length > 0) {
    const harmon = dayBranch.filter((r) => r.polarity === 'harmonising');
    const disturb = dayBranch.filter((r) => r.polarity === 'disturbing');
    findings.push(finding({
      id: harmon.length >= disturb.length ? 'compat.day.harmony' : 'compat.day.clash',
      topic: 'relationship',
      claim: harmon.length >= disturb.length
        ? t(
            `两人日支${harmon.map((r) => r.kind).join('、')}，夫妻宫直接相合，` +
              `相处上自然靠近，磨合期通常较短。`,
            `Your day branches form ${[...new Set(harmon.map((r) => RELATION[r.kind]!.en))].join(' and ')} — ` +
              `the two marriage palaces meet directly and favourably. You tend to ` +
              `settle into each other quickly rather than grinding through a long ` +
              `adjustment.`,
          )
        : t(
            `两人日支${disturb.map((r) => r.kind).join('、')}，夫妻宫相犯，` +
              `彼此容易踩到对方的点。这不代表不能成，但需要有意识地留出空间。`,
            `Your day branches form ${[...new Set(disturb.map((r) => RELATION[r.kind]!.en))].join(' and ')} — ` +
              `the two marriage palaces meet awkwardly. You will find each other's ` +
              `sore spots easily. It does not mean this cannot work; it means space ` +
              `has to be given deliberately rather than assumed.`,
          ),
      evidence: dayBranch.map((r) => t(
        `${r.label}（${a.chart.pillars.day.ganZhi} ↔ ${b.chart.pillars.day.ganZhi}）`,
        `${RELATION[r.kind]!.en}: ${r.values.join('–')} ` +
          `(${a.chart.pillars.day.ganZhi} ↔ ${b.chart.pillars.day.ganZhi})`,
      )),
      confidence: 'high',
      requiresHour: false,
      salience: 9,
    }));
  } else {
    findings.push(finding({
      id: 'compat.day.neutral',
      topic: 'relationship',
      claim: t(
        `两人日支之间既不合也不冲，夫妻宫互不牵动——关系的走向更多取决于` +
          `双方的用神互补与实际相处，而不是命理上的天然吸引。`,
        `Your day branches neither combine nor clash. The two marriage palaces ` +
          `simply do not engage each other, which means how this goes rests on ` +
          `what each chart supplies the other and on ordinary effort, rather than ` +
          `on any built-in pull.`,
      ),
      evidence: [t(
        `${a.chart.pillars.day.ganZhi} 与 ${b.chart.pillars.day.ganZhi} 之间无合冲刑害`,
        `No combination, clash, punishment or harm between ` +
          `${a.chart.pillars.day.ganZhi} and ${b.chart.pillars.day.ganZhi}`,
      )],
      confidence: 'high',
      requiresHour: false,
      salience: 7,
    }));
  }

  // --- 3. 配偶星 sitting on the partner's Day Master ---
  if (aSeesSpouseStar || bSeesSpouseStar) {
    findings.push(finding({
      id: 'compat.spouse-star',
      topic: 'relationship',
      claim: aSeesSpouseStar && bSeesSpouseStar
        ? t(
            '两人日主互为对方的配偶星，这是合婚里少见的一种对位——彼此在对方命中都占正位。',
            'Each of you is literally the other’s spouse star. That is an unusual ' +
              'alignment — you each occupy the proper place in the other’s chart.',
          )
        : aSeesSpouseStar
          ? t(
              `对方日主正是你的${aStar}，对方在你命中占配偶正位，你对其自然看重。`,
              `Their Day Master is exactly your ${TEN_GOD[aStar]!.en} — they occupy ` +
                `the spouse position in your chart, which is why they register to ` +
                `you the way they do.`,
            )
          : t(
              `你的日主正是对方的${bStar}，你在对方命中占配偶正位。`,
              `Your Day Master is exactly their ${TEN_GOD[bStar]!.en} — you occupy ` +
                `the spouse position in their chart.`,
            ),
      evidence: [
        t(
          `你日主 ${a.chart.dayMaster}（${a.chart.dayMasterElement}），对方日主 ${b.chart.dayMaster}（${b.chart.dayMasterElement}）`,
          `Your Day Master ${a.chart.dayMaster} (${ELEMENT[a.chart.dayMasterElement]!.en}); ` +
            `theirs ${b.chart.dayMaster} (${ELEMENT[b.chart.dayMasterElement]!.en})`,
        ),
      ],
      confidence: 'medium',
      requiresHour: false,
      salience: 8,
    }));
  }

  // --- 4. 生肖, weighted honestly ---
  const yearBranch = yearRelations.filter(isBranchRelation);
  if (yearBranch.length > 0) {
    const harmon = yearBranch.some((r) => r.polarity === 'harmonising');
    findings.push(finding({
      id: 'compat.zodiac',
      topic: 'relationship',
      claim: t(
        `生肖上${yearBranch.map((r) => r.kind).join('、')}` +
          `（${a.chart.pillars.year.branch} 与 ${b.chart.pillars.year.branch}）。` +
          `${harmon ? '民间视为相配' : '民间视为相冲'}——但生肖只看年支一字，` +
          `把人分成十二类，参考价值远低于上面几项。`,
        `By zodiac sign your year branches form ` +
          `${[...new Set(yearBranch.map((r) => RELATION[r.kind]!.en))].join(' and ')} ` +
          `(${a.chart.pillars.year.branch} and ${b.chart.pillars.year.branch}) — ` +
          `${harmon ? 'popularly read as a good match' : 'popularly read as a clash'}. ` +
          `Treat it lightly: the zodiac reads one character out of eight and sorts ` +
          `everyone alive into twelve boxes. The factors above are worth far more.`,
      ),
      evidence: yearBranch.map((r) => t(
        `${r.label}（年支 ${r.values.join('、')}）`,
        `${RELATION[r.kind]!.en} between year branches ${r.values.join(' and ')}`,
      )),
      confidence: 'low',
      requiresHour: false,
      salience: 3,
    }));
  }

  // --- Element each side is most short of, and whether the other has it ---
  const scarcestForA = [...a.yongShen.favourable]
    .sort((x, y) => (a.strength.elementPercent[x] ?? 0) - (a.strength.elementPercent[y] ?? 0))[0];
  if (scarcestForA) {
    const partnerHas = b.strength.elementPercent[scarcestForA] ?? 0;
    findings.push(finding({
      id: 'compat.gap',
      topic: 'relationship',
      claim: partnerHas >= 20
        ? t(
            `你最缺的是${scarcestForA}（本命仅 ${a.strength.elementPercent[scarcestForA]}%），` +
              `而对方命中${scarcestForA}占 ${partnerHas}%——这正是对方能实际补到你的地方。`,
            `What you are shortest of is ${ELEMENT[scarcestForA]!.en} — only ` +
              `${a.strength.elementPercent[scarcestForA]}% of your own chart — and ` +
              `their chart runs ${partnerHas}% ${ELEMENT[scarcestForA]!.en}. That is ` +
              `the concrete thing they bring you.`,
          )
        : t(
            `你最缺的是${scarcestForA}，对方命中亦只有 ${partnerHas}%，` +
              `这一块补不上，须靠自身或环境去补。`,
            `What you are shortest of is ${ELEMENT[scarcestForA]!.en}, and their ` +
              `chart carries only ${partnerHas}% of it. This is not a gap they can ` +
              `fill for you — it has to come from your own work or your surroundings.`,
          ),
      evidence: [
        t(
          `你的五行：${Object.entries(a.strength.elementPercent).map(([e, p]) => `${e}${p}%`).join('　')}`,
          `Your elements: ${Object.entries(a.strength.elementPercent).map(([e, p]) => `${ELEMENT[e]!.en} ${p}%`).join(', ')}`,
        ),
        t(
          `对方五行：${Object.entries(b.strength.elementPercent).map(([e, p]) => `${e}${p}%`).join('　')}`,
          `Their elements: ${Object.entries(b.strength.elementPercent).map(([e, p]) => `${ELEMENT[e]!.en} ${p}%`).join(', ')}`,
        ),
      ],
      confidence: 'medium',
      requiresHour: false,
      salience: 8,
    }));
  }

  if (!a.chart.hourKnown || !b.chart.hourKnown) {
    findings.push(finding({
      id: 'compat.no-hour',
      topic: 'relationship',
      claim: t(
        `${!a.chart.hourKnown && !b.chart.hourKnown ? '两人的' : !a.chart.hourKnown ? '你的' : '对方的'}` +
          `出生时辰未知，合婚的判断相应打了折扣——时柱缺失会影响旺衰与用神的准确度。`,
        `${!a.chart.hourKnown && !b.chart.hourKnown ? 'Neither birth time is known' : !a.chart.hourKnown ? 'Your birth time is unknown' : 'Their birth time is unknown'}, ` +
          `so this reading is correspondingly less certain — a missing hour pillar ` +
          `moves both the strength verdict and the favourable element it implies.`,
      ),
      evidence: [t('缺少时柱', 'Missing hour pillar')],
      confidence: 'high',
      requiresHour: false,
      salience: 6,
    }));
  }

  void tenGodFamily;

  return {
    supplyToA,
    supplyToB,
    dayRelations,
    yearRelations,
    aSeesSpouseStar,
    bSeesSpouseStar,
    findings: findings.sort((x, y) => (y.salience ?? 0) - (x.salience ?? 0)),
  };
}
