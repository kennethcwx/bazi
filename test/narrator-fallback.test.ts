/**
 * The keyless narrator, and provider selection.
 *
 * The composed reading is not a stub — it is what most people opening this app
 * will actually read, because it is what works with no configuration at all.
 * So it is held to the same contract as the model: same output format, same
 * citation discipline, same two languages, and it must pass the same grounding
 * check.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { composeReading } from '../src/narrator/compose';
import { checkGrounding } from '../src/narrator/prompt';
import { selectProvider, providerStatus } from '../src/narrator/providers';
import { narrate } from '../src/narrator/narrate';
import { TEMPLATES, templateById } from '../src/narrator/templates';
import { LOCALES } from '../src/i18n/text';
import type { BirthInput } from '../src/engine/types';

const SG = 'Asia/Singapore';
const base = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});
const analyse = (o: Partial<BirthInput> = {}) => analyzeChart(buildChart(base(o)));

const CHINESE_PROSE = /[的是不有在了会要为与和之则者宜主多易]/;

/** Provider selection reads the environment, so each test starts from clean. */
const KEYS = [
  'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'GROQ_API_KEY', 'NARRATOR_PROVIDER',
];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('composed reading', () => {
  const analysis = analyse();

  it('produces a reading for every template in both languages', () => {
    for (const t of TEMPLATES) {
      for (const locale of LOCALES) {
        const text = composeReading(analysis, t, locale);
        expect(text.length, `${t.id}/${locale}`).toBeGreaterThan(80);
        expect(text, `${t.id}/${locale}`).toContain('### ');
      }
    }
  });

  it('satisfies the same grounding check the model must pass', () => {
    for (const t of TEMPLATES) {
      for (const locale of LOCALES) {
        const g = checkGrounding(composeReading(analysis, t, locale), analysis, t);
        expect(g.ok, `${t.id}/${locale} failed grounding`).toBe(true);
        expect(g.invalid, `${t.id}/${locale}`).toEqual([]);
        expect(g.cited.length).toBeGreaterThan(0);
      }
    }
  });

  it('cannot invent a citation, because it only cites what it was handed', () => {
    const valid = new Set(analysis.findings.map((f) => f.id));
    for (const t of TEMPLATES) {
      const g = checkGrounding(composeReading(analysis, t, 'zh'), analysis, t);
      for (const id of g.cited) expect(valid.has(id), id).toBe(true);
    }
  });

  it('gives every section a citation line', () => {
    for (const t of TEMPLATES) {
      const text = composeReading(analysis, t, 'en');
      const headings = (text.match(/^### /gm) ?? []).length;
      const citations = (text.match(/^依据：/gm) ?? []).length;
      // The closing method section is the one heading without findings to cite.
      expect(headings - citations, t.id).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic — the same chart composes to the same words', () => {
    for (const t of TEMPLATES.slice(0, 3)) {
      expect(composeReading(analysis, t, 'zh')).toBe(composeReading(analysis, t, 'zh'));
      expect(composeReading(analysis, t, 'en')).toBe(composeReading(analysis, t, 'en'));
    }
  });

  it('writes genuinely different prose per language, with no leakage', () => {
    for (const t of TEMPLATES) {
      const zh = composeReading(analysis, t, 'zh');
      const en = composeReading(analysis, t, 'en');
      expect(zh).not.toBe(en);
      // Strip 干支 and terms that legitimately stay in characters, then check
      // no Chinese function words survived into the English.
      const prose = en.split('\n').filter((l) => !l.startsWith('依据：')).join(' ');
      expect(CHINESE_PROSE.test(prose), `leaked into ${t.id}: ${prose.slice(0, 120)}`).toBe(false);
    }
  });

  it('hedges contested findings rather than stating them flatly', () => {
    const t = templateById('rel.overview')!;
    const hasLow = analysis.findings.some((f) => f.topic === 'relationship' && f.confidence === 'low');
    if (!hasLow) return;
    expect(composeReading(analysis, t, 'zh')).toContain('一说');
    expect(composeReading(analysis, t, 'en')).toContain('Less certainly');
  });

  it('always discloses the 用神 school, as the model prompt demands', () => {
    for (const locale of LOCALES) {
      const text = composeReading(analysis, templateById('career.field')!, locale);
      expect(text).toContain(analysis.yongShen.school[locale]);
    }
  });

  it('leads with what the template asked it to lead with', () => {
    const t = templateById('rel.timing')!;
    const text = composeReading(analysis, t, 'zh');
    const present = t.leadWith.filter((id) =>
      analysis.findings.some((f) => f.id === id));
    if (present.length === 0) return;
    // The first cited id must be one of the template's priorities.
    const firstCite = /^依据：(.+)$/m.exec(text)![1]!.split(',')[0]!.trim();
    expect(present).toContain(firstCite);
  });
});

describe('provider selection', () => {
  it('returns no provider when nothing is configured', () => {
    expect(selectProvider()).toBeNull();
    expect(providerStatus().id).toBe('composed');
  });

  it('prefers Anthropic, then Gemini, then Groq', () => {
    process.env['GROQ_API_KEY'] = 'x';
    expect(selectProvider()?.id).toBe('groq');
    process.env['GEMINI_API_KEY'] = 'x';
    expect(selectProvider()?.id).toBe('gemini');
    process.env['ANTHROPIC_API_KEY'] = 'x';
    expect(selectProvider()?.id).toBe('anthropic');
  });

  it('accepts GOOGLE_API_KEY as well as GEMINI_API_KEY', () => {
    process.env['GOOGLE_API_KEY'] = 'x';
    expect(selectProvider()?.id).toBe('gemini');
  });

  it('lets NARRATOR_PROVIDER force a choice', () => {
    process.env['ANTHROPIC_API_KEY'] = 'x';
    process.env['GEMINI_API_KEY'] = 'x';
    process.env['NARRATOR_PROVIDER'] = 'gemini';
    expect(selectProvider()?.id).toBe('gemini');
  });

  it('lets NARRATOR_PROVIDER=none force the composer even with keys present', () => {
    process.env['ANTHROPIC_API_KEY'] = 'x';
    process.env['NARRATOR_PROVIDER'] = 'none';
    expect(selectProvider()).toBeNull();
    expect(providerStatus().id).toBe('composed');
  });

  it('returns null rather than a broken provider when the forced one has no key', () => {
    process.env['NARRATOR_PROVIDER'] = 'gemini';
    expect(selectProvider()).toBeNull();
  });
});

describe('narrate with no model configured', () => {
  it('still returns a reading, marked as composed', async () => {
    const analysis = analyse();
    const t = templateById('career.mode')!;
    const r = await narrate(analysis, t, { locale: 'en' });

    expect(r.source).toBe('composed');
    expect(r.text.length).toBeGreaterThan(80);
    expect(r.grounding.ok).toBe(true);
    expect(r.usage).toBeUndefined();
  });

  it('streams the composed text through onDelta like a model would', async () => {
    const analysis = analyse();
    let streamed = '';
    const r = await narrate(analysis, templateById('rel.partner')!, {
      locale: 'zh',
      onDelta: (t) => { streamed += t; },
    });
    expect(streamed).toBe(r.text);
  });

  it('caches, so the second call is served from memory', async () => {
    const analysis = analyse({ year: 1988, month: 4, day: 2 });
    const t = templateById('career.overview')!;
    const first = await narrate(analysis, t, { locale: 'zh' });
    const second = await narrate(analysis, t, { locale: 'zh' });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.text).toBe(first.text);
  });

  it('keys the cache per language', async () => {
    const analysis = analyse({ year: 1993, month: 9, day: 21 });
    const t = templateById('rel.obstacles')!;
    const zh = await narrate(analysis, t, { locale: 'zh' });
    const en = await narrate(analysis, t, { locale: 'en' });
    expect(en.text).not.toBe(zh.text);
    expect(en.cached).toBe(false);
  });
});
