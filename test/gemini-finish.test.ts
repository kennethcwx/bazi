/**
 * A Gemini stream that ends on MAX_TOKENS or SAFETY used to return as if
 * complete, so the page showed a reading clipped mid-sentence with no way to
 * tell. Thought parts must also stay out of the visible text.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { selectProvider } from '../src/narrator/providers';

const frame = (parts: unknown[], finishReason?: string) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts }, ...(finishReason ? { finishReason } : {}) }] })}\n\n`;
const sse = (body: string) => new Response(new Blob([body]).stream(), { status: 200 });

function gemini() {
  process.env['NARRATOR_PROVIDER'] = 'gemini';
  process.env['GEMINI_API_KEY'] = 'test';
  return selectProvider()!;
}
afterEach(() => { vi.unstubAllGlobals(); delete process.env['NARRATOR_PROVIDER']; delete process.env['GEMINI_API_KEY']; });

describe('gemini stream end', () => {
  it('returns the text on STOP, without thought parts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(
      frame([{ text: 'hmm', thought: true }]) + frame([{ text: '牌面' }]) + frame([{ text: '如此。' }], 'STOP'),
    )));
    const r = await gemini().stream('s', 'u', () => {});
    expect(r.text).toBe('牌面如此。');
  });

  it('throws on MAX_TOKENS so the route sends failed, not done', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(frame([{ text: '牌面' }]) + frame([{ text: '如' }], 'MAX_TOKENS'))));
    await expect(gemini().stream('s', 'u', () => {})).rejects.toThrow(/MAX_TOKENS/);
  });
});
