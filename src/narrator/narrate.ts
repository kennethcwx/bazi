/**
 * L3: findings -> prose, via Claude.
 *
 * Streaming, because a reading takes long enough that a non-streaming request
 * risks a serverless timeout and reads as a dead page on a phone.
 *
 * Caching is the main cost lever and it is nearly free here: a reading is a
 * pure function of (chartHash, templateId, promptVersion), so identical charts
 * share one generation for the life of the process. The store below is
 * in-memory and therefore per-instance — fine for a single box, and the place
 * to swap in Turso when this needs to survive a redeploy.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Analysis } from '../analyzer/index';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  checkGrounding,
  type GroundingReport,
} from './prompt';
import type { Template } from './templates';

const MODEL = 'claude-opus-5';

/** Generous: adaptive thinking draws from the same budget as the prose. */
const MAX_TOKENS = 16_000;

export interface Reading {
  readonly templateId: string;
  readonly text: string;
  readonly grounding: GroundingReport;
  readonly cached: boolean;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
  };
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set');
    this.name = 'MissingApiKeyError';
  }
}

export const hasApiKey = (): boolean => Boolean(process.env['ANTHROPIC_API_KEY']);

// ---------------------------------------------------------------------------
// Cache

const CACHE_LIMIT = 300;
const cache = new Map<string, Reading>();

const cacheKey = (analysis: Analysis, template: Template): string =>
  `${analysis.chart.chartHash}:${template.id}:${PROMPT_VERSION}`;

function remember(key: string, reading: Reading): void {
  // Insertion-ordered Map: the first key is the oldest, so this is an LRU-ish
  // eviction that costs nothing to maintain.
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, reading);
}

export const getCached = (analysis: Analysis, template: Template): Reading | undefined =>
  cache.get(cacheKey(analysis, template));

// ---------------------------------------------------------------------------

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!process.env['ANTHROPIC_API_KEY']) throw new MissingApiKeyError();
  client ??= new Anthropic();
  return client;
}

export interface NarrateOptions {
  /** Called with each text delta as it arrives. */
  readonly onDelta?: (text: string) => void;
}

/**
 * Generate a reading, streaming deltas as they arrive.
 *
 * A cached reading is replayed through `onDelta` in one chunk so callers do
 * not need a second code path for the cache hit.
 */
export async function narrate(
  analysis: Analysis,
  template: Template,
  opts: NarrateOptions = {},
): Promise<Reading> {
  const key = cacheKey(analysis, template);

  const hit = cache.get(key);
  if (hit) {
    opts.onDelta?.(hit.text);
    return { ...hit, cached: true };
  }

  const anthropic = getClient();

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // The analysis is already done; the narrator is writing, not reasoning
    // its way to a verdict. Low effort keeps latency and cost down without
    // costing prose quality.
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Frozen and chart-independent, so it caches across every reading.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(analysis, template) }],
  });

  if (opts.onDelta) {
    stream.on('text', (delta) => opts.onDelta!(delta));
  }

  const message = await stream.finalMessage();

  // A safety decline arrives as a 200 with stop_reason "refusal", so it has to
  // be checked before reading content.
  if (message.stop_reason === 'refusal') {
    throw new Error(
      '内容安全系统拒绝了这次生成。请换一个问题，或直接查看下方已算出的结论。',
    );
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const reading: Reading = {
    templateId: template.id,
    text,
    grounding: checkGrounding(text, analysis, template),
    cached: false,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };

  // Only cache a reading whose citations all check out. A hallucinated
  // citation should not be served twice.
  if (reading.grounding.ok) remember(key, reading);

  return reading;
}
