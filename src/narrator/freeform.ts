/**
 * A question in the reader's own words, answered from the findings that
 * speak to it — not routed to one of the fixed questions.
 *
 * The first version of the question box routed free text to the nearest
 * template, which meant every question got one of eight canned answers and
 * the box was theatre. This one selects: each finding is scored on how much
 * of the question it shares (the finding's label, claim and evidence, in the
 * asked language, plus a lighter hand from the fixed questions' vocabulary),
 * and the reading is composed from the matching findings only, headed by the
 * question itself. When nothing matches it says so and offers the fixed
 * questions, which is the honest answer — the computed findings are all the
 * narrator is allowed to say, so a question none of them touch has no
 * answer here.
 *
 * With a model configured the same selection becomes the model's allowed
 * set, so a free question is answered from the findings that fit it rather
 * than from a whole topic.
 */

import type { Analysis } from '../analyzer/index';
import type { Finding, Topic } from '../analyzer/findings';
import { t, type Locale, type LocalizedText } from '../i18n/text';
import { FINDING_LABELS } from '../i18n/finding-labels';
import { TEMPLATES, routeQuestion, type Template } from './templates';

/** The most findings a free answer draws on: enough to answer, not a dump. */
const MAX_FINDINGS = 4;

const EN_STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her',
  'was', 'one', 'our', 'out', 'has', 'have', 'had', 'his', 'him', 'she', 'its',
  'will', 'what', 'when', 'how', 'why', 'who', 'does', 'this', 'that', 'with',
  'from', 'they', 'them', 'been', 'more', 'most', 'like', 'about', 'there',
  'would', 'could', 'should', 'into', 'than', 'then', 'very', 'just', 'good',
  'bad', 'get', 'got', 'am', 'my', 'me', 'is', 'it', 'in', 'on', 'to', 'of',
  'do', 'be', 'or', 'an', 'a', 'i', 'we', 'us',
]);
const ZH_STOP = new Set([
  '我的', '我们', '什么', '怎么', '怎样', '会不会', '是不是', '可以', '能不能',
  '比较', '一点', '这个', '那个', '还是', '如何', '有没有', '吗', '呢', '的',
  '了', '会', '我', '是', '在', '和', '与', '有', '不', '要', '想', '很', '都',
  '也', '就', '吧', '啊', '呀',
]);

/** Question tokens: English words, and Chinese bigrams plus single characters. */
export function tokens(text: string, locale: Locale): Set<string> {
  const out = new Set<string>();
  const lower = text.toLowerCase();
  for (const w of lower.split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !EN_STOP.has(w)) out.add(w);
  }
  const han = lower.replace(/[^一-鿿]/g, ' ').split(/\s+/).filter(Boolean);
  for (const run of han) {
    for (let i = 0; i < run.length; i++) {
      const bi = run.slice(i, i + 2);
      if (bi.length === 2 && !ZH_STOP.has(bi)) out.add(bi);
    }
  }
  void locale;
  return out;
}

/** Everything a finding says, in one language, as tokens. */
function findingTokens(f: Finding, locale: Locale): Set<string> {
  const label = FINDING_LABELS[f.id];
  const text = [
    label ? label[locale] : '',
    f.claim[locale],
    ...f.evidence.map((e) => e[locale]),
    f.id.replace(/[.-]/g, ' '),
  ].join(' ');
  return tokens(text, locale);
}

export interface FreeformSelection {
  readonly topic: Exclude<Topic, 'base'>;
  readonly findings: readonly Finding[];
  readonly scores: ReadonlyMap<string, number>;
}

/**
 * Pick the findings that speak to a question.
 *
 * Direct overlap with the finding's own words counts most. A finding a fixed
 * question leads with is also nudged when the question uses that fixed
 * question's vocabulary — "when" and "结婚" pull the timing findings even if
 * the question shares no word with the claim itself. Topic is whichever side
 * the matches fall on; a tie goes to relationships, the product's first
 * subject.
 */
export function selectFindings(
  analysis: Analysis,
  question: string,
  locale: Locale,
): FreeformSelection | null {
  const q = tokens(question, locale);
  const lower = question.toLowerCase();
  if (q.size === 0) return null;

  const scores = new Map<string, number>();
  for (const f of analysis.findings) {
    if (f.topic === 'base') continue;
    let score = 0;
    for (const tok of findingTokens(f, locale)) if (q.has(tok)) score += tok.length;
    scores.set(f.id, score);
  }

  // The fixed questions' vocabulary, as a lighter vote for what they lead with.
  for (const tpl of TEMPLATES) {
    const hit = tpl.matches.reduce(
      (n, kw) => n + (lower.includes(kw.toLowerCase()) ? kw.length : 0), 0);
    if (hit === 0) continue;
    tpl.leadWith.forEach((id, i) => {
      if (scores.has(id)) scores.set(id, scores.get(id)! + Math.max(1, hit - i));
    });
  }

  const ranked = analysis.findings
    .filter((f) => f.topic !== 'base' && (scores.get(f.id) ?? 0) > 0)
    .sort((a, b) =>
      (scores.get(b.id)! - scores.get(a.id)!) || ((b.salience ?? 0) - (a.salience ?? 0)));
  if (ranked.length === 0) return null;

  // Topic by weight of the matches. A question that clearly belongs to one
  // side ("结婚", "创业") keeps to it; one that straddles them ("is 2028 a
  // good year") is answered from both, and the heavier side names the topic.
  const weight = { relationship: 0, career: 0 };
  for (const f of ranked) weight[f.topic as 'relationship' | 'career'] += scores.get(f.id)!;
  const topic: Exclude<Topic, 'base'> = weight.career > weight.relationship ? 'career' : 'relationship';
  const other = topic === 'career' ? 'relationship' : 'career';
  const oneSided = weight[topic] >= 2 * weight[other];
  const chosen = (oneSided ? ranked.filter((f) => f.topic === topic) : ranked).slice(0, MAX_FINDINGS);
  return { topic, findings: chosen, scores };
}

/** The synthetic template a free question composes (or prompts) through. */
export function freeformTemplate(
  question: string,
  selection: FreeformSelection,
): Template {
  const q = question.trim();
  // The reading cache keys on the template id, so a free question carries
  // its own text in the id: two different questions must not share a cache
  // entry, and the same question asked twice should.
  return {
    id: `free:${q.toLowerCase().replace(/\s+/g, ' ')}`,
    topic: selection.topic,
    question: t(q, q),
    hint: t(q, q),
    leadWith: selection.findings.map((f) => f.id),
    // No background: the answer is the findings that match, and nothing else.
    background: 0,
    focus: t(
      '只回答这个问题。只能引用下列结论，不可补充未列出的判断；结论不足以回答时，直说不足。',
      'Answer this question only. Cite only the findings listed; add nothing they do not say. ' +
        'If they do not cover the question, say so plainly.',
    ),
    targetLength: 260,
    matches: [],
  };
}

export type FreeformRoute =
  | { readonly kind: 'answer'; readonly template: Template; readonly selection: FreeformSelection }
  | { readonly kind: 'declined'; readonly reason: LocalizedText };

/** Out-of-scope questions are still declined before anything is selected. */
export function routeFreeform(
  analysis: Analysis,
  question: string,
  locale: Locale,
): FreeformRoute {
  const scope = routeQuestion(question);
  if (scope.kind === 'declined' && /不回答|does not answer/.test(scope.reason.zh + scope.reason.en)) {
    return scope;
  }
  const selection = selectFindings(analysis, question, locale);
  if (!selection) {
    return {
      kind: 'declined',
      reason: t(
        '已算出的结论里没有能回答这个问题的。这里只讲命局算得出的事，可以试试下面的题目，或把问题换个说法。',
        'None of the computed findings speak to that question. This only says what the ' +
          'chart can be shown to say — try one of the questions above, or put it another way.',
      ),
    };
  }
  return { kind: 'answer', template: freeformTemplate(question, selection), selection };
}
