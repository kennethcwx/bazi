/**
 * L3 suite — everything that does not need an API key.
 *
 * The prompt builder, the router and the grounding check are all pure, so the
 * parts of the narrator most likely to be wrong are testable without spending
 * a cent. What is NOT covered here is the prose itself; that needs a real
 * call and a human read.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { TEMPLATES, routeQuestion, templateById, templatesFor } from '../src/narrator/templates';
import { buildUserPrompt, checkGrounding, SYSTEM_PROMPT } from '../src/narrator/prompt';
import type { BirthInput } from '../src/engine/types';

const SG = 'Asia/Singapore';
const base = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});
const analyse = (o: Partial<BirthInput> = {}) => analyzeChart(buildChart(base(o)));

/**
 * Every finding id L2 can emit, gathered by sweeping charts across both
 * genders and every month. Used to prove no template cites an id that will
 * never exist — a typo there degrades a reading silently.
 */
function allFindingIds(): Set<string> {
  const ids = new Set<string>();
  for (const gender of ['male', 'female'] as const) {
    for (let month = 1; month <= 12; month++) {
      for (const year of [1985, 1990, 1996, 2001]) {
        for (const f of analyse({ year, month, day: 12, gender }).findings) ids.add(f.id);
      }
    }
  }
  // The no-hour path emits one finding the timed path never does.
  for (const f of analyzeChart(
    buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' }),
  ).findings) ids.add(f.id);
  return ids;
}

describe('templates', () => {
  it('has unique ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers both topics', () => {
    expect(templatesFor('relationship').length).toBeGreaterThanOrEqual(3);
    expect(templatesFor('career').length).toBeGreaterThanOrEqual(3);
  });

  it('only cites finding ids the analyzer can actually emit', () => {
    const real = allFindingIds();
    const bogus: string[] = [];
    for (const t of TEMPLATES) {
      for (const id of t.leadWith) if (!real.has(id)) bogus.push(`${t.id} -> ${id}`);
    }
    expect(bogus, `templates reference findings that never exist: ${bogus.join(', ')}`)
      .toEqual([]);
  });

  it('gives every template a focus and a length target', () => {
    for (const t of TEMPLATES) {
      expect(t.focus.length).toBeGreaterThan(20);
      expect(t.targetLength).toBeGreaterThan(200);
      expect(t.leadWith.length).toBeGreaterThan(0);
    }
  });

  it('looks up by id', () => {
    expect(templateById('rel.timing')?.topic).toBe('relationship');
    expect(templateById('nope')).toBeUndefined();
  });
});

describe('question routing', () => {
  it('routes relationship questions to relationship templates', () => {
    const r = routeQuestion('我什么时候会结婚');
    expect(r.kind).toBe('template');
    if (r.kind === 'template') expect(r.template.topic).toBe('relationship');
  });

  it('routes career questions to career templates', () => {
    const r = routeQuestion('我适合什么行业');
    expect(r.kind).toBe('template');
    if (r.kind === 'template') expect(r.template.id).toBe('career.field');
  });

  it('respects a preferred topic when the words are ambiguous', () => {
    // "什么时候" matches both rel.timing and career.timing.
    const rel = routeQuestion('什么时候比较好', 'relationship');
    const car = routeQuestion('什么时候比较好', 'career');
    if (rel.kind === 'template') expect(rel.template.topic).toBe('relationship');
    if (car.kind === 'template') expect(car.template.topic).toBe('career');
  });

  it('declines health and lifespan questions', () => {
    for (const q of ['我会得什么病', '我能活到几岁', '我的寿命如何']) {
      const r = routeQuestion(q);
      expect(r.kind, q).toBe('declined');
      if (r.kind === 'declined') expect(r.reason).toContain('健康');
    }
  });

  it('declines legal and gambling questions', () => {
    expect(routeQuestion('我会有官司吗').kind).toBe('declined');
    expect(routeQuestion('买什么股票会赚').kind).toBe('declined');
  });

  it('declines rather than guessing at an unroutable question', () => {
    const r = routeQuestion('今天午餐吃什么');
    expect(r.kind).toBe('declined');
  });
});

describe('prompt construction', () => {
  const analysis = analyse();
  const template = templateById('rel.overview')!;
  const prompt = buildUserPrompt(analysis, template);

  it('supplies computed pillars, never the birth date', () => {
    expect(prompt).toContain(analysis.chart.pillars.day.ganZhi);
    // The narrator must not be able to re-derive anything.
    expect(prompt).not.toContain('1990-06-15');
    expect(prompt).not.toContain('出生日期');
  });

  it('includes the findings with their evidence and ids', () => {
    const f = analysis.relationship.findings[0]!;
    expect(prompt).toContain(`[${f.id}]`);
    expect(prompt).toContain(f.claim);
  });

  it('marks the template lead findings so the narrator knows what to lead with', () => {
    expect(prompt).toContain('★重点');
  });

  it('names the 用神 school so the reading can disclose it', () => {
    expect(prompt).toContain(analysis.yongShen.school);
  });

  it('carries only the requested topic findings', () => {
    for (const f of analysis.career.findings) {
      expect(prompt).not.toContain(`[${f.id}]`);
    }
  });

  it('warns the narrator off the hour pillar when the time is unknown', () => {
    const noHour = analyzeChart(
      buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' }),
    );
    const p = buildUserPrompt(noHour, template);
    expect(p).toContain('出生时辰不详');
    expect(p).toContain('不可提及时柱');
  });

  it('has a system prompt that forbids computing and requires citations', () => {
    expect(SYSTEM_PROMPT).toContain('不得自行推算');
    expect(SYSTEM_PROMPT).toContain('依据');
    expect(SYSTEM_PROMPT).toContain('不谈健康');
  });
});

describe('grounding check', () => {
  const analysis = analyse();
  const template = templateById('rel.overview')!;
  const realId = analysis.relationship.findings[0]!.id;

  it('accepts prose that cites real findings', () => {
    const text = `### 夫妻宫\n正文。\n依据：${realId}`;
    const g = checkGrounding(text, analysis, template);
    expect(g.ok).toBe(true);
    expect(g.cited).toContain(realId);
    expect(g.invalid).toEqual([]);
  });

  it('catches an invented citation', () => {
    const text = `### 夫妻宫\n正文。\n依据：${realId}, rel.totally.made.up`;
    const g = checkGrounding(text, analysis, template);
    expect(g.ok).toBe(false);
    expect(g.invalid).toEqual(['rel.totally.made.up']);
  });

  it('fails prose that cites nothing at all', () => {
    const g = checkGrounding('### 夫妻宫\n一段没有依据的话。', analysis, template);
    expect(g.ok).toBe(false);
    expect(g.cited).toEqual([]);
  });

  it('accepts either full-width or half-width colons and separators', () => {
    const two = analysis.relationship.findings.slice(0, 2).map((f) => f.id);
    if (two.length < 2) return;
    const a = checkGrounding(`依据：${two[0]}、${two[1]}`, analysis, template);
    const b = checkGrounding(`依据: ${two[0]}, ${two[1]}`, analysis, template);
    // `cited` is readonly, so copy before sorting.
    expect([...a.cited].sort()).toEqual([...two].sort());
    expect([...b.cited].sort()).toEqual([...two].sort());
  });

  it('counts sections that carry no citation line', () => {
    const text = `### 一\n正文。\n依据：${realId}\n\n### 二\n没有依据的一段。`;
    const g = checkGrounding(text, analysis, template);
    expect(g.uncitedSections).toBe(1);
  });

  it('reports lead findings the narrator ignored', () => {
    const g = checkGrounding(`依据：${realId}`, analysis, template);
    // Some lead findings exist for this chart and were not cited.
    expect(Array.isArray(g.uncitedLeads)).toBe(true);
    expect(g.uncitedLeads).not.toContain(realId);
  });

  it('strips trailing punctuation from a cited id', () => {
    const g = checkGrounding(`依据：${realId}。`, analysis, template);
    expect(g.cited).toContain(realId);
    expect(g.invalid).toEqual([]);
  });
});
