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
import { narrate, hasApiKey, MissingApiKeyError } from '../../../src/narrator/narrate';
import { routeQuestion, templateById } from '../../../src/narrator/templates';
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

  if (!hasApiKey()) {
    return Response.json(
      {
        error: zh
          ? '尚未设定 ANTHROPIC_API_KEY，无法生成解读。下方的结论是程序算出的，' +
            '不需要 API 也能看。'
          : 'ANTHROPIC_API_KEY is not set, so no reading can be generated. The ' +
            'findings below are computed and need no API key to read.',
        code: 'no_api_key',
      },
      { status: 503 },
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

  // An explicit template wins; free text is routed; anything unroutable is
  // declined rather than answered.
  let template = body.templateId ? templateById(body.templateId) : undefined;
  if (!template && body.question) {
    const routed = routeQuestion(body.question);
    if (routed.kind === 'declined') {
      return Response.json({ error: routed.reason[locale], code: 'declined' }, { status: 400 });
    }
    template = routed.template;
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
      });

      try {
        const reading = await narrate(analysis, chosen, {
          locale,
          onDelta: (text) => send('delta', { text }),
        });
        send('done', {
          cached: reading.cached,
          grounding: reading.grounding,
          usage: reading.usage ?? null,
        });
      } catch (e) {
        const message =
          e instanceof MissingApiKeyError
            ? (zh ? '尚未设定 ANTHROPIC_API_KEY。' : 'ANTHROPIC_API_KEY is not set.')
            : e instanceof Error
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
