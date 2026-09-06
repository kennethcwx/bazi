/**
 * Where the prose comes from.
 *
 * The narrator only writes — L2 has already done every judgement — so the model
 * is doing the least demanding job in the system. That is what makes this layer
 * worth having: a weaker or free model costs fluency, not correctness, and the
 * grounding check catches it either way.
 *
 * Selection is by whichever key is present, so a deployment with no keys at all
 * still produces readings through the deterministic composer. Adding a free
 * Gemini or Groq key upgrades the prose without touching any other code.
 *
 * Anthropic goes through its official SDK. The others are small REST surfaces
 * and go over fetch rather than pulling in two more dependencies for a
 * secondary path.
 */

import Anthropic from '@anthropic-ai/sdk';

export type ProviderId = 'anthropic' | 'gemini' | 'groq';

export interface ProviderResult {
  readonly text: string;
  readonly usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export interface Provider {
  readonly id: ProviderId;
  readonly label: string;
  readonly model: string;
  stream(
    system: string,
    user: string,
    onDelta: (t: string) => void,
  ): Promise<ProviderResult>;
}

const env = (k: string): string | undefined => process.env[k] || undefined;

// ---------------------------------------------------------------------------
// Anthropic

let anthropicClient: Anthropic | undefined;

function anthropicProvider(): Provider {
  const model = env('ANTHROPIC_MODEL') ?? 'claude-opus-5';
  return {
    id: 'anthropic',
    label: 'Claude',
    model,
    async stream(system, user, onDelta) {
      anthropicClient ??= new Anthropic();
      const s = anthropicClient.messages.stream({
        model,
        max_tokens: 16_000,
        // The analysis is already done; the narrator is writing, not reasoning
        // its way to a verdict. Low effort keeps latency and cost down.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        system: [{
          type: 'text',
          text: system,
          // Frozen and chart-independent, so it caches across every reading.
          cache_control: { type: 'ephemeral' },
        }],
        messages: [{ role: 'user', content: user }],
      });
      s.on('text', onDelta);
      const message = await s.finalMessage();

      // A safety decline arrives as a 200 with stop_reason "refusal".
      if (message.stop_reason === 'refusal') {
        throw new Error('REFUSAL');
      }
      return {
        text: message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text).join('').trim(),
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Shared SSE reader for the REST providers.

async function readSse(
  res: Response,
  extract: (payload: unknown) => string,
  onDelta: (t: string) => void,
): Promise<string> {
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let acc = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        let payload: unknown;
        try { payload = JSON.parse(raw); } catch { continue; }
        const piece = extract(payload);
        if (piece) { acc += piece; onDelta(piece); }
      }
    }
  }
  return acc.trim();
}

// ---------------------------------------------------------------------------
// Google Gemini — free tier at aistudio.google.com

function geminiProvider(key: string): Provider {
  // Overridable because Google retires model ids faster than this app will be
  // redeployed; a 404 here tells the user exactly which variable to set.
  const model = env('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  return {
    id: 'gemini',
    label: 'Gemini',
    model,
    async stream(system, user, onDelta) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        if (res.status === 404) {
          throw new Error(
            `Gemini model "${model}" was not found. Set GEMINI_MODEL to a current ` +
            `model id (see aistudio.google.com).`,
          );
        }
        throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
      }

      const text = await readSse(res, (p) => {
        const c = p as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        return c.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? '';
      }, onDelta);

      return { text };
    },
  };
}

// ---------------------------------------------------------------------------
// Groq — OpenAI-compatible, free tier at console.groq.com

function groqProvider(key: string): Provider {
  const model = env('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
  return {
    id: 'groq',
    label: 'Groq',
    model,
    async stream(system, user, onDelta) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Groq ${res.status}: ${detail.slice(0, 200)}`);
      }

      const text = await readSse(res, (p) => {
        const c = p as { choices?: { delta?: { content?: string } }[] };
        return c.choices?.[0]?.delta?.content ?? '';
      }, onDelta);

      return { text };
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * Pick a provider, or none.
 *
 * `NARRATOR_PROVIDER` forces a choice; otherwise the first key present wins, in
 * quality order. Returning null is a first-class outcome, not a failure — it
 * means the composer handles the reading.
 */
export function selectProvider(): Provider | null {
  const forced = env('NARRATOR_PROVIDER')?.toLowerCase();

  const anthropicKey = env('ANTHROPIC_API_KEY');
  const geminiKey = env('GEMINI_API_KEY') ?? env('GOOGLE_API_KEY');
  const groqKey = env('GROQ_API_KEY');

  if (forced === 'none') return null;
  if (forced === 'anthropic') return anthropicKey ? anthropicProvider() : null;
  if (forced === 'gemini') return geminiKey ? geminiProvider(geminiKey) : null;
  if (forced === 'groq') return groqKey ? groqProvider(groqKey) : null;

  if (anthropicKey) return anthropicProvider();
  if (geminiKey) return geminiProvider(geminiKey);
  if (groqKey) return groqProvider(groqKey);
  return null;
}

/** What is available, for the UI to be honest about where prose came from. */
export function providerStatus(): { id: ProviderId | 'composed'; label: string } {
  const p = selectProvider();
  return p ? { id: p.id, label: p.label } : { id: 'composed', label: 'Composed' };
}
