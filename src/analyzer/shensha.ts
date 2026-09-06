/**
 * 神煞 — restricted to the ones that actually bear on relationships and career.
 *
 * There are well over a hundred 神煞 in circulation and most consumer apps list
 * them all, which is noise: a reading that mentions twenty stars says nothing.
 * These are the ones a practitioner would actually raise for our two topics.
 *
 * Reference points differ by star, and getting that wrong is the usual bug:
 * 桃花 and 红艳 key off different pillars from 红鸾 and 孤辰. Each table below
 * records which pillar it reads from.
 */

import type { Chart, Pillar } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';

export interface ShenShaHit {
  readonly name: string;
  /** Which pillar the star lands on. */
  readonly position: string;
  readonly branch: string;
  /** What it is read from — 年支, 日支, 日干. */
  readonly reference: string;
  readonly meaning: LocalizedText;
  readonly topic: 'relationship' | 'career';
}

/** 桃花（咸池）— read from the 年支 or 日支 三合 group. */
const PEACH: Record<string, string> = {
  申: '酉', 子: '酉', 辰: '酉',
  亥: '子', 卯: '子', 未: '子',
  寅: '卯', 午: '卯', 戌: '卯',
  巳: '午', 酉: '午', 丑: '午',
};

/** 红鸾 — from the 年支. */
const HONG_LUAN: Record<string, string> = {
  子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌',
  午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰',
};

/** 天喜 — from the 年支, always six places from 红鸾. */
const TIAN_XI: Record<string, string> = {
  子: '酉', 丑: '申', 寅: '未', 卯: '午', 辰: '巳', 巳: '辰',
  午: '卯', 未: '寅', 申: '丑', 酉: '子', 戌: '亥', 亥: '戌',
};

/** 孤辰 / 寡宿 — from the 年支, by season. */
const LONELY: Record<string, { gu: string; gua: string }> = {
  亥: { gu: '寅', gua: '戌' }, 子: { gu: '寅', gua: '戌' }, 丑: { gu: '寅', gua: '戌' },
  寅: { gu: '巳', gua: '丑' }, 卯: { gu: '巳', gua: '丑' }, 辰: { gu: '巳', gua: '丑' },
  巳: { gu: '申', gua: '辰' }, 午: { gu: '申', gua: '辰' }, 未: { gu: '申', gua: '辰' },
  申: { gu: '亥', gua: '未' }, 酉: { gu: '亥', gua: '未' }, 戌: { gu: '亥', gua: '未' },
};

/** 红艳煞 — from the 日干. */
const HONG_YAN: Record<string, string> = {
  甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰',
  己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申',
};

/** 阴差阳错 — whole 日柱 combinations, not a branch lookup. */
const YIN_CHA_YANG_CUO = new Set([
  '丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳',
  '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥',
]);

/** 将星 — leadership, read from the 年支 三合 group's cardinal. */
const GENERAL: Record<string, string> = {
  申: '子', 子: '子', 辰: '子',
  亥: '卯', 卯: '卯', 未: '卯',
  寅: '午', 午: '午', 戌: '午',
  巳: '酉', 酉: '酉', 丑: '酉',
};

/** 驿马 — movement, travel, relocation. From the 年支 or 日支 group. */
const TRAVEL: Record<string, string> = {
  申: '寅', 子: '寅', 辰: '寅',
  亥: '巳', 卯: '巳', 未: '巳',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
};

const POSITION_LABEL: Record<string, string> = {
  year: '年支', month: '月支', day: '日支', hour: '时支',
};

export function findShenSha(chart: Chart): ShenShaHit[] {
  const hits: ShenShaHit[] = [];
  const pillars = [
    chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour,
  ].filter((p): p is Pillar => p !== null);

  const yearBranch = chart.pillars.year.branch;
  const dayBranch = chart.pillars.day.branch;
  const dayStem = chart.dayMaster;

  const add = (
    name: string, target: string | undefined, reference: string,
    meaning: LocalizedText, topic: 'relationship' | 'career',
  ) => {
    if (!target) return;
    for (const p of pillars) {
      if (p.branch === target) {
        hits.push({
          name,
          position: POSITION_LABEL[p.position] ?? p.position,
          branch: p.branch,
          reference,
          meaning,
          topic,
        });
      }
    }
  };

  // 桃花 is conventionally read from both 年支 and 日支. When the two reference
  // points land on the same branch we report it once rather than twice.
  add('桃花', PEACH[yearBranch], '年支', t('异性缘、魅力、感情牵动', 'attraction, charm, and romantic pull'), 'relationship');
  if (PEACH[dayBranch] !== PEACH[yearBranch]) {
    add('桃花', PEACH[dayBranch], '日支', t('异性缘、魅力、感情牵动', 'attraction, charm, and romantic pull'), 'relationship');
  }

  add('红鸾', HONG_LUAN[yearBranch], '年支', t('婚恋喜事之星', 'the star of courtship and happy occasions'), 'relationship');
  add('天喜', TIAN_XI[yearBranch], '年支', t('喜庆、婚嫁之星', 'the star of celebration and marriage'), 'relationship');
  add('红艳', HONG_YAN[dayStem], '日干', t('情感浓烈、易招情缘', 'intense feeling; draws romantic attention easily'), 'relationship');

  const lonely = LONELY[yearBranch];
  add('孤辰', lonely?.gu, '年支', t('孤独、晚婚倾向', 'a pull toward solitude and later marriage'), 'relationship');
  add('寡宿', lonely?.gua, '年支', t('孤独、晚婚倾向', 'a pull toward solitude and later marriage'), 'relationship');

  add('将星', GENERAL[yearBranch], '年支', t('领导力、掌权', 'leadership, and holding real authority'), 'career');
  add('驿马', TRAVEL[yearBranch], '年支', t('奔波、外出、变动', 'travel, relocation, and movement'), 'career');
  if (TRAVEL[dayBranch] !== TRAVEL[yearBranch]) {
    add('驿马', TRAVEL[dayBranch], '日支', t('奔波、外出、变动', 'travel, relocation, and movement'), 'career');
  }

  if (YIN_CHA_YANG_CUO.has(chart.pillars.day.ganZhi)) {
    hits.push({
      name: '阴差阳错',
      position: '日柱',
      branch: chart.pillars.day.ganZhi,
      reference: '日柱',
      meaning: t('婚姻多波折、易有隔阂或聚少离多',
        'a marriage prone to setbacks, distance, or long stretches apart'),
      topic: 'relationship',
    });
  }

  // A star read from two reference points can land on the same branch twice.
  // That is worth saying once, with a note, not listing twice.
  const seen = new Map<string, ShenShaHit>();
  const doubled = new Set<string>();
  for (const h of hits) {
    const k = `${h.name}@${h.position}${h.branch}`;
    if (seen.has(k)) doubled.add(k);
    else seen.set(k, h);
  }
  return [...seen.entries()].map(([k, h]) =>
    doubled.has(k)
      ? { ...h, meaning: t(
          `${h.meaning.zh}（年、日两见，力量加重）`,
          `${h.meaning.en} (found from both the year and day branch, so it counts double)`,
        ) }
      : h,
  );
}
