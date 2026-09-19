/**
 * POST the cards on the table and the question; get a reading streamed back.
 * Same SSE shape as /api/read: meta, delta…, done | failed.
 */

import { DECK } from '../../../src/tarot/cards';
import { narrateTarot } from '../../../src/tarot/narrate';
import { readSpread, TOPICS, type Topic } from '../../../src/tarot/spreads';
import { providerStatus } from '../../../src/narrator/providers';
import { isLocale, type Locale } from '../../../src/i18n/text';

export const maxDuration = 60;

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(req: Request) {
  let body: { question?: unknown; topic?: unknown; cards?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求格式不正确。 / Malformed request.' }, { status: 400 });
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const topic = (TOPICS as readonly string[]).includes(String(body.topic)) ? (body.topic as Topic) : 'general';
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 200) : '';
  const raw = Array.isArray(body.cards) ? body.cards : [];
  const ids = new Set<number>();
  const draws = [];
  for (const c of raw) {
    const id = (c as { id?: unknown })?.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || !DECK[id] || ids.has(id)) continue;
    ids.add(id);
    draws.push({ card: DECK[id]!, reversed: (c as { reversed?: unknown }).reversed === true });
  }
  if (![1, 3, 5].includes(draws.length)) {
    return Response.json({ error: locale === 'zh' ? '牌阵必须是 1、3 或 5 张。' : 'A spread is 1, 3 or 5 cards.' }, { status: 400 });
  }
  const spread = readSpread(draws, topic);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(sse(event, data))); } catch { /* client gone */ }
      };
      send('meta', { source: providerStatus().id });
      try {
        const r = await narrateTarot(question, topic, spread, locale, (text) => send('delta', { text }));
        send('done', { source: r?.source ?? 'composed' });
      } catch (e) {
        send('failed', { error: e instanceof Error ? e.message : 'narrator failed' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
  });
}
