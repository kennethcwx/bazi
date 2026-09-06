/**
 * The deterministic narrator: findings -> prose, with no model at all.
 *
 * This exists because the reasoning is already done. By the time L3 is reached,
 * every claim is a finished sentence with its evidence attached — a model is
 * being asked to arrange and connect, not to work anything out. Code can
 * arrange and connect.
 *
 * What this gives up against a model: fluency, and the ability to teach a term
 * mid-sentence in a way that feels natural. It reads like a well-organised
 * report rather than a consultation.
 *
 * What it gives back is not small: it costs nothing, needs no key, returns
 * instantly, never invents a citation because it only ever cites what it was
 * handed, and produces the same reading for the same chart forever. It is also
 * the honest floor of this product — if the composed version says something
 * useful, the model version is adding polish rather than substance.
 */

import type { Finding } from '../analyzer/findings';
import type { Analysis } from '../analyzer/index';
import type { Locale } from '../i18n/text';
import type { Template } from './templates';

interface Section {
  readonly heading: { zh: string; en: string };
  readonly findings: Finding[];
  /** True when the heading itself already marks the content as uncertain. */
  readonly hedged?: boolean;
}

/**
 * Connectives, cycled by position rather than chosen at random.
 *
 * Determinism matters here: the same chart must compose to the same words, or
 * the cache key lies and the tests cannot assert anything.
 */
const JOINERS: Record<Locale, readonly string[]> = {
  zh: ['', '再者，', '另外，', '同时，', '此外，'],
  en: ['', 'Beyond that, ', 'Alongside this, ', 'There is also this: ', 'And further, '],
};

/**
 * Sort findings into sections.
 *
 * Grouped by what the finding is about rather than by score: timing belongs
 * together, contested points belong together and last, and everything else
 * splits into the core reading and the detail behind it.
 */
function buildSections(findings: readonly Finding[]): Section[] {
  const timing = findings.filter((f) => f.id.includes('.timing'));
  const contested = findings.filter((f) => !f.id.includes('.timing') && f.confidence === 'low');
  const solid = findings.filter((f) => !f.id.includes('.timing') && f.confidence !== 'low');

  const core = solid.slice(0, 2);
  const detail = solid.slice(2);

  const sections: Section[] = [];
  if (core.length > 0) {
    sections.push({ heading: { zh: '基本格局', en: 'The shape of it' }, findings: core });
  }
  if (detail.length > 0) {
    sections.push({ heading: { zh: '细看', en: 'In more detail' }, findings: detail });
  }
  if (timing.length > 0) {
    sections.push({ heading: { zh: '时机', en: 'Timing' }, findings: timing });
  }
  if (contested.length > 0) {
    sections.push({
      heading: { zh: '仅供参考', en: 'Held lightly' },
      findings: contested,
      hedged: true,
    });
  }
  return sections;
}

/**
 * Hedge a low-confidence claim so a contested reading is not stated flatly.
 *
 * Skipped inside the "held lightly" section: that heading already says it, and
 * repeating "一说" on every sentence under it reads like a stammer.
 */
function hedge(
  claim: string,
  confidence: Finding['confidence'],
  locale: Locale,
  sectionIsHedged: boolean,
): string {
  if (confidence !== 'low' || sectionIsHedged) return claim;
  return locale === 'zh' ? `一说：${claim}` : `Less certainly: ${claim}`;
}

/**
 * Compose a reading.
 *
 * Output matches the model's contract exactly — `### heading`, paragraphs, and
 * a `依据：` line per section — so the UI, the grounding check and the cache
 * cannot tell the two apart.
 */
export function composeReading(
  analysis: Analysis,
  template: Template,
  locale: Locale = 'zh',
): string {
  const topicFindings = analysis.findings.filter((f) => f.topic === template.topic);

  // Order by the template's priorities first, then by salience — the same
  // ordering the model is given, so both narrators lead with the same thing.
  const leadIndex = new Map(template.leadWith.map((id, i) => [id, i]));
  const ordered = [...topicFindings].sort((a, b) => {
    const la = leadIndex.get(a.id) ?? 999;
    const lb = leadIndex.get(b.id) ?? 999;
    if (la !== lb) return la - lb;
    return (b.salience ?? 0) - (a.salience ?? 0);
  });

  const sections = buildSections(ordered);
  if (sections.length === 0) {
    return locale === 'zh'
      ? '### 无可报告\n这个命局在此题目上没有算出可陈述的结论。\n'
      : '### Nothing to report\nThis chart produced no statable findings for this question.\n';
  }

  const out: string[] = [];

  for (const section of sections) {
    out.push(`### ${section.heading[locale]}`);

    const sentences = section.findings.map((f, i) => {
      const joiner = JOINERS[locale][i % JOINERS[locale].length] ?? '';
      return joiner + hedge(f.claim[locale], f.confidence, locale, section.hedged === true);
    });

    // One paragraph per section. The claims are already complete sentences,
    // so running them together reads better than a bulleted list.
    out.push(sentences.join(locale === 'zh' ? '' : ' '));
    out.push(`依据：${section.findings.map((f) => f.id).join(', ')}`);
    out.push('');
  }

  // The school disclosure the model prompt also demands. It belongs in every
  // reading, whichever narrator wrote it.
  out.push(
    locale === 'zh'
      ? `### 关于取用\n本盘用神取 ${analysis.yongShen.primary}，流派为${analysis.yongShen.school.zh}。` +
        `不同师傅取用不同，若你听过别的说法，多半是流派差异而非对错。`
      : `### On method\nThis reading takes ${analysis.yongShen.primary} as the favourable ` +
        `element, using ${analysis.yongShen.school.en}. Practitioners differ here; if you ` +
        `have been told something else, that is usually a difference of school rather ` +
        `than one of you being wrong.`,
  );

  return out.join('\n');
}
