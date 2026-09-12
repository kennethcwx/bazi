/**
 * Streaming reading endpoint.
 *
 * Server-sent events rather than a plain JSON response: a reading takes long
 * enough that a blocking request risks a serverless timeout, and on a phone a
 * blank screen for thirty seconds reads as a broken page. Streaming turns the
 * wait into progress.
 *
 * The chart and its findings are recomputed here rather than trusted from the
 * client — findings are the narrator's only permitted source of truth, so they
 * must not be something a caller can forge.
 */

import { buildChart } from '../../../src/engine/chart';
import { analyzeChart } from '../../../src/analyzer/index';
import { narrate, providerStatus } from '../../../src/narrator/narrate';
import { templateById } from '../../../src/narrator/templates';
import { routeFreeform } from '../../../src/narrator/freeform';
import { isLocale, type Locale } from '../../../src/i18n/text';
import type { BirthInput } from '../../../src/engine/types';

export const maxDuration = 120;

interface Body extends Partial<BirthInput> {
  templateId?: string;
  question?: string;
  locale?: unknown;
}

const sse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求格式不正确。' }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const zh = locale === 'zh';

  const { year, month, day, timeZone, gender } = body;
  if (!year || !month || !day || !timeZone || !gender) {
    return Response.json(
      { error: zh ? '缺少必要资料。' : 'Missing required details.' },
      { status: 400 },
    );
  }

  let analysis;
  try {
    analysis = analyzeChart(buildChart(body as BirthInput));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : (zh ? '排盘失败。' : 'Could not cast the chart.') },
      { status: 400 },
    );
  }

  // An explicit template wins. Free text is answered from the findings that
  // speak to it — a synthetic template headed by the question — or declined
  // when out of scope or when nothing computed touches it.
  let template = body.templateId ? templateById(body.templateId) : undefined;
  let basedOn: string[] | null = null;
  if (!template && body.question) {
    const routed = routeFreeform(analysis, body.question, locale);
    if (routed.kind === 'declined') {
      return Response.json({ error: routed.reason[locale], code: 'declined' }, { status: 400 });
    }
    template = routed.template;
    basedOn = routed.selection.findings.map((f) => f.id);
  }
  if (!template) {
    return Response.json(
      { error: zh ? '未指定要回答的问题。' : 'No question was specified.' },
      { status: 400 },
    );
  }

  const chosen = template;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          // Client hung up mid-stream; nothing to do but stop writing.
        }
      };

      send('meta', {
        templateId: chosen.id,
        question: chosen.question[locale],
        topic: chosen.topic,
        basedOn,
        // Say which narrator is writing, rather than letting composed prose
        // pass as a model's.
        source: providerStatus().id,
      });

      try {
        const reading = await narrate(analysis, chosen, {
          locale,
          onDelta: (text) => send('delta', { text }),
        });
        send('done', {
          cached: reading.cached,
          source: reading.source,
          grounding: reading.grounding,
          usage: reading.usage ?? null,
        });
      } catch (e) {
        const message = e instanceof Error
          ? e.message
          : (zh ? '生成解读时发生错误。' : 'Something went wrong generating the reading.');
        send('failed', { error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx and some proxies buffer SSE into uselessness without this.
      'X-Accel-Buffering': 'no',
    },
  });
}
