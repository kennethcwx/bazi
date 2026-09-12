/**
 * 格局法 — the second 用神 lens, beside 扶抑.
 *
 * The 扶抑 school asks whether the day master is strong or weak and prescribes
 * the opposite. The 格局 school (子平真诠) asks a different question: what is
 * the chart BUILT on — the 格 taken from the 月令 — and what does that
 * structure need to work? Its answer, the 相神, is what that school calls the
 * 用神. On many charts the two agree; on some they do not, and that is the
 * deepest divergence between mainstream readings of the same eight
 * characters. On Kenneth's own 建禄格 chart, 扶抑 says 水 and 格局 says 木火.
 *
 * So this is presented, not resolved. 扶抑 stays the reading the scoring runs
 * on; this lens says what the other school would want and whether the two
 * agree, so a difference of school never reads as "the app is wrong".
 *
 * The rules are the textbook ones:
 *
 *   顺用 — the four 吉神, nurtured and protected:
 *     正官  wants 财 to feed it and 印 to guard it; fears 伤官
 *     财    wants 食伤 to feed it and 官 to guard it from 比劫; fears 比劫
 *     印    wants 官杀 to feed it; fears 财 (财破印)
 *     食神  wants 财 to flow into; fears 偏印 (枭神夺食)
 *   逆用 — the 凶神, controlled or transformed:
 *     七杀  wants 食神 to control it or 印 to transform it; fears 财 feeding it
 *     伤官  wants 印 to control it or 财 to carry it off; fears 正官
 *     禄刃  (建禄 / 羊刃 / 月劫) want 官杀 to control the excess, or 食伤 with
 *           财 to spend it; fear more 比劫
 *
 * 偏印 is 顺用 here with 印, as 子平真诠 has it; some schools treat 枭神 as
 * 逆用 and want 财 against it. Said in the reasoning rather than chosen.
 */

import type { Chart, Element, TenGod } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';
import { ELEMENT, STRUCTURE, TEN_GOD_FAMILY } from '../i18n/glossary';
import { familyElement, type TenGodFamily } from './elements';
import { determineStructure } from './topics/career';
import type { StrengthAnalysis } from './strength';
import type { YongShenAnalysis } from './yongshen';

export type StructureMethod = '顺用' | '逆用';

export interface StructureLens {
  /** 格 name, e.g. 正财格. */
  readonly structure: string;
  readonly structureEn: string;
  readonly tenGod: TenGod;
  readonly method: StructureMethod;
  /** 相神 families, in order of preference, and their elements. */
  readonly wantsFamilies: readonly TenGodFamily[];
  readonly wants: readonly Element[];
  /** What the 格 fears. */
  readonly fearsFamilies: readonly TenGodFamily[];
  readonly fears: readonly Element[];
  /** How this lens sits against the 扶抑 reading the scoring uses. */
  readonly agreement: 'agree' | 'partial' | 'differ';
  readonly reasoning: readonly LocalizedText[];
}

interface Rule {
  method: StructureMethod;
  wants: TenGodFamily[];
  fears: TenGodFamily[];
  why: LocalizedText;
}

const RULES: Record<TenGod, Rule> = {
  正官: {
    method: '顺用', wants: ['财', '印'], fears: ['食伤'],
    why: t('正官为吉神，顺用：财生官、印护官，忌伤官见官。',
      'Direct Officer is a benign star, used by nurturing it: wealth feeds it, resource guards it; it fears Hurting Officer.'),
  },
  正财: {
    method: '顺用', wants: ['食伤', '官杀'], fears: ['比劫'],
    why: t('正财为吉神，顺用：食伤生财、官护财，忌比劫夺财。',
      'Direct Wealth is a benign star, used by nurturing it: output feeds it, authority guards it; it fears peers taking it.'),
  },
  偏财: {
    method: '顺用', wants: ['食伤', '官杀'], fears: ['比劫'],
    why: t('偏财为吉神，顺用：食伤生财、官护财，忌比劫夺财。',
      'Indirect Wealth is a benign star, used by nurturing it: output feeds it, authority guards it; it fears peers taking it.'),
  },
  正印: {
    method: '顺用', wants: ['官杀'], fears: ['财'],
    why: t('正印为吉神，顺用：官杀生印，忌财破印。',
      'Direct Resource is a benign star, used by nurturing it: authority feeds it; it fears wealth breaking it.'),
  },
  偏印: {
    method: '顺用', wants: ['官杀'], fears: ['财'],
    why: t('偏印随印顺用：官杀生印，忌财破印（亦有流派以枭神为逆用，取财制之）。',
      'Indirect Resource is read with resource, nurtured: authority feeds it; it fears wealth breaking it (some schools treat 枭神 as a star to be controlled, and want wealth against it).'),
  },
  食神: {
    method: '顺用', wants: ['财'], fears: ['印'],
    why: t('食神为吉神，顺用：食神生财，忌偏印夺食。',
      'Eating God is a benign star, used by nurturing it: it flows into wealth; it fears Indirect Resource seizing it.'),
  },
  七杀: {
    method: '逆用', wants: ['食伤', '印'], fears: ['财'],
    why: t('七杀为凶神，逆用：食神制杀或印化杀，忌财生杀。',
      'Seven Killings is a harsh star, used by controlling it: Eating God restrains it or resource transforms it; it fears wealth feeding it.'),
  },
  伤官: {
    method: '逆用', wants: ['印', '财'], fears: ['官杀'],
    why: t('伤官为凶神，逆用：伤官配印或伤官生财，忌伤官见官。',
      'Hurting Officer is a harsh star, used by controlling it: paired with resource, or carried off into wealth; it fears meeting Direct Officer.'),
  },
  比肩: {
    method: '逆用', wants: ['官杀', '食伤'], fears: ['比劫'],
    why: t('建禄以比肩当令，逆用：官杀制之，或食伤泄之而生财，忌再见比劫。',
      'A 建禄 chart has peers commanding the month; used by controlling them: authority restrains, or output drains them into wealth; it fears more peers.'),
  },
  劫财: {
    method: '逆用', wants: ['官杀', '食伤'], fears: ['比劫'],
    why: t('羊刃／月劫以劫财当令，逆用：官杀制刃，或食伤泄之而生财，忌再见比劫。',
      'A 羊刃 / 月劫 chart has Rob Wealth commanding the month; used by controlling it: authority restrains the blade, or output drains it into wealth; it fears more peers.'),
  },
};

/**
 * 子平真诠 does not read the 格 blind to the day master. A weak day master
 * cannot carry the 财官食伤 its 格 would otherwise want ("身弱不胜财官"), so
 * the 相神 shifts to what props it up first; a strong one under an 印格 has
 * more resource than it can use, so the lens turns to spending it. These are
 * the textbook adjustments, applied before the rule above is quoted.
 */
function adjustForStrength(
  tenGod: TenGod, rule: Rule, verdict: StrengthAnalysis['verdict'],
): { rule: Rule; note: LocalizedText | null } {
  const isBenign = ['正官', '正财', '偏财', '食神', '伤官', '七杀'].includes(tenGod);
  if (verdict === '身弱' && isBenign) {
    // 财 feeds the pressure and 官杀 is the pressure; a weak day master
    // wants neither until it is propped up.
    return {
      rule: { ...rule, wants: ['印', '比劫'], fears: ['财', '官杀'] },
      note: t(
        `惟日主身弱，不胜${tenGod === '七杀' ? '杀' : tenGod.endsWith('财') ? '财' : tenGod.includes('官') ? '官' : '食伤'}，先取印、比劫扶身，而后论格。`,
        `But the day master is weak and cannot carry this star, so the lens first wants resource and peers to prop it up, and only then reads the structure.`,
      ),
    };
  }
  if (verdict === '身强' && (tenGod === '正印' || tenGod === '偏印')) {
    return {
      rule: { ...rule, wants: ['财', '食伤'], fears: ['印', '比劫'] },
      note: t(
        '惟日主身强，印多为累，转取财损印、食伤泄秀。',
        'But the day master is strong and resource is a surplus, so the lens turns to wealth to check the resource and to output to spend the excess.',
      ),
    };
  }
  return { rule, note: null };
}

export function analyzeStructureLens(
  chart: Chart, strength: StrengthAnalysis, yongShen: YongShenAnalysis,
): StructureLens {
  const structure = determineStructure(chart);
  const adjusted = adjustForStrength(structure.tenGod, RULES[structure.tenGod], strength.verdict);
  const rule = adjusted.rule;
  const dm = chart.dayMasterElement;
  const wants = [...new Set(rule.wants.map((f) => familyElement(dm, f)))];
  const fears = [...new Set(rule.fears.map((f) => familyElement(dm, f)))];

  const fav = new Set(yongShen.favourable);
  const unfav = new Set(yongShen.unfavourable);
  const wantedFav = wants.filter((e) => fav.has(e)).length;
  const wantedUnfav = wants.filter((e) => unfav.has(e)).length;
  const agreement: StructureLens['agreement'] =
    wantedFav > 0 && wantedUnfav === 0 ? 'agree'
    : wantedFav > 0 ? 'partial'
    : 'differ';

  const el = (e: Element) => ELEMENT[e]!.en;
  const fam = (f: TenGodFamily) => TEN_GOD_FAMILY[f]!.en;
  const structureEn = STRUCTURE[structure.name]?.en ?? structure.name;

  const reasoning: LocalizedText[] = [
    t(
      `月令取${structure.name}${structure.exposed ? '（格神透干）' : ''}。`,
      `The month names the structure: ${structureEn}${structure.exposed ? ' (its star shows in a stem)' : ''}.`,
    ),
    RULES[structure.tenGod].why,
    ...(adjusted.note ? [adjusted.note] : []),
    t(
      `故格局法喜 ${rule.wants.join('、')}（${wants.map((e) => ELEMENT[e]!.zh).join('、')}），` +
        `忌 ${rule.fears.join('、')}（${fears.map((e) => ELEMENT[e]!.zh).join('、')}）。`,
      `So this lens wants ${rule.wants.map(fam).join(' and ')} — ${wants.map(el).join(', ')} — ` +
        `and fears ${rule.fears.map(fam).join(', ')} (${fears.map(el).join(', ')}).`,
    ),
    agreement === 'agree'
      ? t('与扶抑法所取一致，两家同论，取用较稳。',
          'This agrees with the strength reading above — two schools, one answer, which makes the choice unusually reliable.')
      : agreement === 'partial'
        ? t('与扶抑法部分一致：所喜之中有扶抑所忌者。两家各有所据，此处以扶抑为准。',
            'This partly agrees with the strength reading: one of the elements it wants is one strength works against. Both have grounds; the scoring here follows strength.')
        : t('⚠️ 与扶抑法不同：格局所喜正是扶抑所忌。这是流派之别，不是错算；本盘以扶抑为准，格局法所取列此供参照。',
            '⚠️ This differs from the strength reading: what the structure wants is what strength works against. That is a difference of school, not a miscalculation; the scoring here follows strength, and this lens is shown for comparison.'),
  ];

  return {
    structure: structure.name,
    structureEn,
    tenGod: structure.tenGod,
    method: rule.method,
    wantsFamilies: rule.wants,
    wants,
    fearsFamilies: rule.fears,
    fears,
    agreement,
    reasoning,
  };
}
