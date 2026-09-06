/**
 * L3: findings -> prose.
 *
 * Two narrators behind one function. When a model key is configured the prose
 * is written by that model; when none is, `composeReading` builds it from the
 * findings in code. Both produce the same format, so nothing downstream — the
 * UI, the grounding check, the cache — can tell them apart.
 *
 * That fallback is not a degraded mode so much as the honest floor of the
 * product: L2 has already done every judgement, so if the composed reading
 * says nothing useful, a model was only ever adding polish.
 *
 * Caching is the main cost lever and nearly free here: a reading is a pure
 * function of (chartHash, template, locale, source, promptVersion). The store
 * is in-memory and therefore per-instance — the place to swap in Turso when it
 * needs to survive a redeploy.
 */

import type { Analysis } from '../analyzer/index';
import {
  PROMPT_VERSION,
  buildUserPrompt,
  checkGrounding,
  systemPrompt,
  type GroundingReport,
} from './prompt';
import { composeReading } from './compose';
import { selectProvider, providerStatus, type ProviderId } from './providers';
import type { Locale } from '../i18n/text';
import type { Template } from './templates';

export type ReadingSource = ProviderId | 'composed';

export interface Reading {
  readonly templateId: string;
  readonly text: string;
  readonly grounding: GroundingReport;
  readonly cached: boolean;
  /** Which narrator wrote it. Surfaced in the UI rather than hidden. */
  readonly source: ReadingSource;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
  };
}

/** True when a model is configured. Readings work either way. */
export const hasModel = (): boolean => selectProvider() !== null;
export { providerStatus };

// ---------------------------------------------------------------------------
// Cache

const CACHE_LIMIT = 300;
const cache = new Map<string, Reading>();

const cacheKey = (
  analysis: Analysis, template: Template, locale: Locale, source: ReadingSource,
): string => `${analysis.chart.chartHash}:${template.id}:${locale}:${source}:${PROMPT_VERSION}`;

function remember(key: string, reading: Reading): void {
  // Insertion-ordered Map: the first key is the oldest, so this is an LRU-ish
  // eviction that costs nothing to maintain.
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, reading);
}

export interface NarrateOptions {
  /** Called with each text delta as it arrives. */
  readonly onDelta?: (text: string) => void;
  readonly locale?: Locale;
}

export async function narrate(
  analysis: Analysis,
  template: Template,
  opts: NarrateOptions = {},
): Promise<Reading> {
  const locale = opts.locale ?? 'zh';
  const provider = selectProvider();
  const source: ReadingSource = provider?.id ?? 'composed';
  const key = cacheKey(analysis, template, locale, source);

  const hit = cache.get(key);
  if (hit) {
    opts.onDelta?.(hit.text);
    return { ...hit, cached: true };
  }

  // --- No model configured: compose it. Instant, free, always available. ---
  if (!provider) {
    const text = composeReading(analysis, template, locale);
    opts.onDelta?.(text);
    const reading: Reading = {
      templateId: template.id,
      text,
      grounding: checkGrounding(text, analysis, template),
      cached: false,
      source: 'composed',
    };
    remember(key, reading);
    return reading;
  }

  // --- A model is configured. ---
  let result;
  try {
    result = await provider.stream(
      systemPrompt(locale),
      buildUserPrompt(analysis, template, locale),
      (t) => opts.onDelta?.(t),
    );
  } catch (e) {
    if (e instanceof Error && e.message === 'REFUSAL') {
      throw new Error(
        locale === 'en'
          ? 'The safety system declined this generation. Try a different question, ' +
            'or read the computed findings below.'
          : '内容安全系统拒绝了这次生成。请换一个问题，或直接查看下方已算出的结论。',
      );
    }
    throw e;
  }

  const reading: Reading = {
    templateId: template.id,
    text: result.text,
    grounding: checkGrounding(result.text, analysis, template),
    cached: false,
    source,
    ...(result.usage ? { usage: result.usage } : {}),
  };

  // Only cache a reading whose citations all check out. A hallucinated
  // citation should not be served twice.
  if (reading.grounding.ok) remember(key, reading);

  return reading;
}
