/**
 * Rendering 排盘依据 notes in the reader's language.
 *
 * The engine emits structured notes; this is the only place that turns them
 * into sentences. Keeping the split means adding a language never touches the
 * calculation layer, and the Chinese build never leaks English at a user.
 */

import type { MomentNote } from '../engine/types';

export type Locale = 'zh' | 'en';

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

export function formatNote(note: MomentNote, locale: Locale = 'zh'): string {
  const zh = locale === 'zh';

  switch (note.code) {
    case 'historical-offset':
      return zh
        ? `${note.timeZone} 在此日期为 UTC${note.actualOffset}，` +
          `而非今日的 UTC${note.presentOffset}，已按当时时区起盘。`
        : `${note.timeZone} was UTC${note.actualOffset} on this date, not ` +
          `today's UTC${note.presentOffset}. Charted on the historical offset.`;

    case 'true-solar-applied':
      return zh
        ? `已按经度 ${note.longitude.toFixed(2)}° 作真太阳时校正 ` +
          `${signed(note.minutes)} 分钟。`
        : `True solar time correction of ${signed(note.minutes)} minutes ` +
          `applied for longitude ${note.longitude.toFixed(2)}°.`;

    case 'true-solar-no-longitude':
      return zh
        ? '已选用真太阳时，但未提供出生地经度，故未作校正。'
        : 'True solar time was requested but no longitude was given, so no ' +
          'correction was applied.';

    case 'true-solar-disabled':
      return zh
        ? '未使用真太阳时，按当地钟表时间起盘。'
        : 'True solar time is off; charted on civil clock time.';
  }
}

/** True when a note is a caveat the user should actually notice. */
export function isCaveat(note: MomentNote): boolean {
  return note.code === 'historical-offset' || note.code === 'true-solar-no-longitude';
}

/**
 * When the 大运 begin, in words.
 *
 * The engine emits the counts; choosing how to say them is a presentation
 * decision, so it lives here alongside the other rendered text.
 */
export function formatLuckStart(
  luckStart: { years: number; months: number; days: number },
  forward: boolean,
  locale: Locale = 'zh',
): string {
  const { years, months, days } = luckStart;
  if (locale === 'zh') {
    return `${years}年${months}个月${days}天起运，大运${forward ? '顺行' : '逆行'}`;
  }
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  const span = parts.length ? parts.join(', ') : 'no time at all';
  return `Luck pillars begin ${span} after birth, running ${forward ? 'forward' : 'backward'}`;
}
