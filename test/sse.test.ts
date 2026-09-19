/**
 * The SSE reader must not drop the last event, and must accept CRLF frames —
 * both silently produced an empty Gemini reading in production.
 */

import { describe, it, expect } from 'vitest';
import { readSse } from '../src/narrator/providers';

const respond = (body: string) => new Response(new Blob([body]).stream());
const extract = (p: unknown) => String((p as { t?: string }).t ?? '');

describe('readSse', () => {
  it('keeps the final event when the stream ends without a blank line', async () => {
    const text = await readSse(respond('data: {"t":"a"}\n\ndata: {"t":"b"}\n'), extract, () => {});
    expect(text).toBe('ab');
  });

  it('reads CRLF-separated frames', async () => {
    const text = await readSse(respond('data: {"t":"x"}\r\n\r\ndata: {"t":"y"}\r\n\r\n'), extract, () => {});
    expect(text).toBe('xy');
  });

  it('ignores [DONE] and malformed lines', async () => {
    const text = await readSse(respond('data: nope\n\ndata: [DONE]\n\ndata: {"t":"z"}\n\n'), extract, () => {});
    expect(text).toBe('z');
  });
});
