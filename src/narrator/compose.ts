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
function buildSections(
  lead: readonly Finding[],
  context: readonly Finding[],
  template: Template,
): Section[] {
  const solid = (fs: readonly Finding[]) => fs.filter((f) => f.confidence !== 'low');
  const contested = [...lead, ...context].filter((f) => f.confidence === 'low');
  const sections: Section[] = [];
  if (solid(lead).length > 0) {
    // The lead section is named for the question, not for the topic: it is
    // what makes the answer to "when" read differently from the answer to
    // "what shape".
    sections.push({ heading: { zh: template.hint.zh, en: template.hint.en }, findings: solid(lead) });
  }
  if (solid(context).length > 0) {
    sections.push({ heading: { zh: '背景', en: 'Background' }, findings: solid(context) });
  }
  if (contested.length > 0) {
    // When everything that answers is contested, the answer is still headed
    // by the question — hedged in the heading rather than hidden under a
    // generic one.
    const onlyContested = sections.length === 0;
    sections.push({
      heading: onlyContested
        ? { zh: `${template.hint.zh}（仅供参考）`, en: `${template.hint.en} (held lightly)` }
        : { zh: '仅供参考', en: 'Held lightly' },
      findings: contested,
      hedged: true,
    });
  }
  return sections;
}

/**
 * Determiners and pronouns that should drop to lower case after a joiner even
 * when a capitalised term follows them: "your Spouse Palace", not "Your".
 */
const ALWAYS_LOWER = new Set([
  'The', 'A', 'An', 'This', 'That', 'These', 'Those',
  'Your', 'You', 'It', 'There', 'Both', 'Each', 'No', 'None',
]);

/**
 * Lower-case an English sentence opener so a joiner reads naturally.
 *
 * The trap is that a claim can open with a term name — "Indirect Wealth shows
 * openly" — where lowering it is wrong, and character-level tests cannot tell
 * "Indirect Wealth" from "In the natal chart": both are a capital followed by
 * a lowercase letter. Looking at the SECOND word settles it, since a term name
 * is Title Case throughout.
 */
function afterJoiner(text: string, joiner: string, locale: Locale): string {
  if (!joiner || locale === 'zh') return text;

  const match = /^([A-Z][a-z]+)(\s+)(\S+)/.exec(text);
  if (!match) return text;

  const [, first, gap, second] = match;
  const secondIsCapitalised = /^[A-Z][a-z]/.test(second!);
  if (secondIsCapitalised && !ALWAYS_LOWER.has(first!)) return text;

  return first!.charAt(0).toLowerCase() + first!.slice(1) + gap + text.slice(first!.length + gap!.length);
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

  // Answer the question, not the topic. The first cut arranged EVERY finding
  // of the topic under each question, only reordered — so the four
  // relationship questions produced the same reading four times, and the
  // person asking "when" got the same paragraphs as the person asking "what
  // shape". The lead findings are the answer; at most two more, by salience,
  // are background — and a timing finding is not background to a
  // non-timing question.
  // Lead findings are looked up across every topic: a free question about
  // "a good year" is answered by both the marriage and the career timing.
  const lead = template.leadWith
    .map((id) => analysis.findings.find((f) => f.id === id))
    .filter((f): f is Finding => f !== undefined);
  const leadIds = new Set(lead.map((f) => f.id));
  const wantsTiming = template.leadWith.some((id) => id.includes('.timing'));
  const context = topicFindings
    .filter((f) => !leadIds.has(f.id) && (wantsTiming || !f.id.includes('.timing')))
    .sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0))
    .slice(0, template.background ?? Math.max(1, 3 - lead.length));

  const sections = buildSections(lead, context, template);
  if (sections.length === 0) {
    return locale === 'zh'
      ? '### 无可报告\n这个命局在此题目上没有算出可陈述的结论。\n'
      : '### Nothing to report\nThis chart produced no statable findings for this question.\n';
  }

  const out: string[] = [];

  for (const section of sections) {
    out.push(`### ${section.heading[locale]}`);

    const sentences = section.findings.map((f, i) => {
      const willHedge = f.confidence === 'low' && section.hedged !== true;
      const claim = hedge(f.claim[locale], f.confidence, locale, section.hedged === true);
      // A hedge is itself a connective. Stacking a joiner on top of it gives
      // "Beyond that, less certainly: ...", which reads like a throat-clear.
      const joiner = willHedge ? '' : (JOINERS[locale][i % JOINERS[locale].length] ?? '');
      return joiner + afterJoiner(claim, joiner, locale);
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
