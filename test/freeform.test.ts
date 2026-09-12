/**
 * A question in the reader's own words is answered from the findings that
 * speak to it — not routed to one of the fixed questions.
 *
 * The guards: different questions select different findings; a question
 * keeps to its topic when it clearly has one and straddles when it does not;
 * the reading is headed by the question and cites only what was selected;
 * out-of-scope and unanswerable questions are declined, each with its own
 * reason; and the cache key differs per question.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { composeReading } from '../src/narrator/compose';
import { checkGrounding } from '../src/narrator/prompt';
import { routeFreeform, selectFindings, tokens } from '../src/narrator/freeform';

const analysis = analyzeChart(buildChart({
  year: 1975, month: 3, day: 9, hour: 7, minute: 0,
  timeZone: 'Asia/Shanghai', gender: 'male', useTrueSolarTime: false,
}));

const answer = (q: string, locale: 'zh' | 'en' = 'zh') => {
  const r = routeFreeform(analysis, q, locale);
  if (r.kind === 'declined') throw new Error(`declined: ${r.reason[locale]}`);
  return { ...r, text: composeReading(analysis, r.template, locale) };
};

describe('free-form questions', () => {
  it('tokenises Chinese into bigrams and English into words, dropping filler', () => {
    const zh = tokens('我什么时候结婚', 'zh');
    expect(zh.has('结婚')).toBe(true);
    expect(zh.has('什么')).toBe(false);
    const en = tokens('When will I get married?', 'en');
    expect(en.has('married')).toBe(true);
    expect(en.has('when')).toBe(false);
  });

  it('different questions select different findings', () => {
    const a = answer('什么时候结婚比较好');
    const b = answer('我的另一半会是什么样的人');
    const c = answer('我适合自己创业还是打工');
    expect(a.template.leadWith[0]).toBe('rel.timing.favourable');
    expect(b.template.leadWith[0]).toBe('rel.palace.content');
    expect(c.selection.topic).toBe('career');
    expect(c.template.leadWith[0]).toBe('career.lean');
    expect(new Set([a.text, b.text, c.text]).size).toBe(3);
  });

  it('is headed by the question and cites only what it selected', () => {
    const q = 'will my marriage be stable';
    const r = answer(q, 'en');
    expect(r.text.split('\n')[0]).toBe(`### ${q}`);
    const g = checkGrounding(r.text, analysis, r.template);
    expect(g.ok).toBe(true);
    for (const id of g.cited) expect(r.template.leadWith).toContain(id);
  });

  it('keeps to one topic when the question clearly has one', () => {
    const r = answer('什么时候结婚比较好');
    expect(r.selection.findings.every((f) => f.topic === 'relationship')).toBe(true);
  });

  it('straddles both topics when the question does', () => {
    const r = answer('is 2028 a good year for me', 'en');
    const topics = new Set(r.selection.findings.map((f) => f.topic));
    expect(topics.has('relationship') && topics.has('career')).toBe(true);
  });

  it('a question answered only by a contested finding is still headed by the question', () => {
    const r = answer('do I have peach blossom', 'en');
    expect(r.text.split('\n')[0]).toMatch(/^### do I have peach blossom \(held lightly\)/);
  });

  it('declines out-of-scope questions with the scope reason', () => {
    const r = routeFreeform(analysis, '我今年会中彩票吗', 'zh');
    expect(r.kind).toBe('declined');
    if (r.kind === 'declined') expect(r.reason.zh).toContain('不回答');
  });

  it('declines a question nothing computed touches, and says so', () => {
    const r = routeFreeform(analysis, '明天天气怎样', 'zh');
    expect(r.kind).toBe('declined');
    if (r.kind === 'declined') expect(r.reason.zh).toContain('没有能回答');
    expect(selectFindings(analysis, '', 'zh')).toBeNull();
  });

  it('keys the cache per question, and the same question the same', () => {
    const a = answer('what might my partner be like', 'en');
    const b = answer('when will I marry', 'en');
    const c = answer('  What might my partner be like ', 'en');
    expect(a.template.id).not.toBe(b.template.id);
    expect(a.template.id).toBe(c.template.id);
    expect(a.template.id.startsWith('free:')).toBe(true);
  });

  it('draws on at most four findings and adds no background', () => {
    for (const q of ['感情', '事业', 'marriage career luck timing partner industry']) {
      const r = answer(q, q.includes(' ') ? 'en' : 'zh');
      expect(r.template.leadWith.length).toBeLessThanOrEqual(4);
      expect(r.template.background).toBe(0);
      const g = checkGrounding(r.text, analysis, r.template);
      expect(g.cited.length).toBeLessThanOrEqual(4);
    }
  });
});
