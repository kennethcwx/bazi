/**
 * Bilingual text.
 *
 * Both languages are authored side by side rather than one being translated
 * from the other. That is deliberate: the English is not a rendering of the
 * Chinese, it has to carry a term the reader has never met. 「日支坐正财而透干」
 * is complete for a Chinese reader and opaque in literal English, so the
 * English says what it means instead of what it says.
 *
 * The engine is untouched by any of this — it emits canonical Chinese terms as
 * data, which is correct. Language is a presentation concern and lives here.
 */

export type Locale = 'zh' | 'en';

export const LOCALES: readonly Locale[] = ['zh', 'en'];

export interface LocalizedText {
  readonly zh: string;
  readonly en: string;
}

/** Shorthand for authoring a pair inline. */
export const t = (zh: string, en: string): LocalizedText => ({ zh, en });

export const pick = (text: LocalizedText, locale: Locale): string => text[locale];

/** Join a list of pairs into one pair, per language. */
export function joinLocalized(
  parts: readonly LocalizedText[],
  separator: LocalizedText = t('、', ', '),
): LocalizedText {
  return {
    zh: parts.map((p) => p.zh).join(separator.zh),
    en: parts.map((p) => p.en).join(separator.en),
  };
}

/** Concatenate pairs end to end. */
export function concatLocalized(...parts: readonly LocalizedText[]): LocalizedText {
  return {
    zh: parts.map((p) => p.zh).join(''),
    en: parts.map((p) => p.en).join(''),
  };
}

export const isLocale = (v: unknown): v is Locale => v === 'zh' || v === 'en';
