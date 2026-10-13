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

describe('gemini that never answers', () => {
  // A fetch that only settles when aborted — what a stalled Gemini looks like.
  const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) =>
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

  it('moves to the fallback model when the first stalls', async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockImplementationOnce(hang).mockImplementationOnce(async () => sse(frame([{ text: '可读' }], 'STOP')));
    vi.stubGlobal('fetch', f);
    const p = gemini().stream('s', 'u', () => {});
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await p).text).toBe('可读');
    expect(String(f.mock.calls[1]![0])).toContain('lite');
    vi.useRealTimers();
  });

  it('fails cleanly, well inside the 60s function limit, when both stall', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(hang));
    const p = gemini().stream('s', 'u', () => {});
    const caught = expect(p).rejects.toThrow(/busy/);
    await vi.advanceTimersByTimeAsync(40_000);
    await caught;
    vi.useRealTimers();
  });
});
