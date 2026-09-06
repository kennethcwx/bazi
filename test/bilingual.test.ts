/**
 * Bilingual coverage.
 *
 * These exist because of a specific failure: the glossary layer was built and
 * then only one thing was routed through it, so the interface silently became
 * Chinese-only. Every test here is a guard against some version of that —
 * a pair that was never filled in, a term the glossary does not know, or
 * Chinese prose leaking into an English reading.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { analyzeStrength } from '../src/analyzer/strength';
import { analyzeYongShen } from '../src/analyzer/yongshen';
import { findShenSha } from '../src/analyzer/shensha';
import { findRelations } from '../src/analyzer/relations';
import { buildUserPrompt, systemPrompt } from '../src/narrator/prompt';
import { TEMPLATES, routeQuestion, templateById } from '../src/narrator/templates';
import { formatNote, formatLuckStart } from '../src/i18n/notes';
import { UI } from '../src/i18n/ui';
import {
  ELEMENT, RELATION, SHENSHA, STRUCTURE, TEN_GOD, TEN_GOD_FAMILY, TERRAIN, term,
} from '../src/i18n/glossary';
import { LOCALES, type Locale, type LocalizedText } from '../src/i18n/text';
import type { BirthInput } from '../src/engine/types';

const SG = 'Asia/Singapore';
const base = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});
const analyse = (o: Partial<BirthInput> = {}) => analyzeChart(buildChart(base(o)));

/** A spread of charts wide enough to fire most findings. */
function sweep() {
  const out = [];
  for (const gender of ['male', 'female'] as const) {
    for (let month = 1; month <= 12; month++) {
      for (const year of [1979, 1985, 1990, 1996, 2003]) {
        out.push(analyse({ year, month, day: 12, gender }));
      }
    }
  }
  out.push(analyzeChart(buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' })));
  return out;
}

/**
 * Chinese function words. Individual 干支, element and 十神 characters are
 * legitimate inside English text — 辛亥 and 正财 must survive so a reader can
 * check the chart elsewhere. These particles only appear in running prose, so
 * finding one in an English string means a pair was left untranslated.
 */
const CHINESE_PROSE = /[的是不有在了会要为与和之则者宜主多易]/;

function assertPair(text: LocalizedText, where: string) {
  expect(text.zh.trim().length, `${where}: empty zh`).toBeGreaterThan(0);
  expect(text.en.trim().length, `${where}: empty en`).toBeGreaterThan(0);
  expect(text.zh, `${where}: zh and en are identical — a pair was not filled in`)
    .not.toBe(text.en);
  expect(CHINESE_PROSE.test(text.en), `${where}: Chinese prose leaked into en — "${text.en}"`)
    .toBe(false);
}

describe('findings are genuinely bilingual', () => {
  const charts = sweep();

  it('gives every claim and every piece of evidence both languages', () => {
    let checked = 0;
    for (const a of charts) {
      for (const f of a.findings) {
        assertPair(f.claim, `${f.id} claim`);
        f.evidence.forEach((e, i) => assertPair(e, `${f.id} evidence[${i}]`));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('covers every finding id the analyzer can emit', () => {
    const ids = new Set(charts.flatMap((a) => a.findings.map((f) => f.id)));
    // If a new finding is added without an English half, the loop above fails;
    // this asserts the sweep is actually exercising a broad set.
    expect(ids.size).toBeGreaterThanOrEqual(12);
  });

  it('gives 旺衰 and 用神 reasoning both languages', () => {
    for (const a of charts.slice(0, 20)) {
      a.strength.reasoning.forEach((r, i) => assertPair(r, `strength.reasoning[${i}]`));
      a.yongShen.reasoning.forEach((r, i) => assertPair(r, `yongShen.reasoning[${i}]`));
      assertPair(a.yongShen.school, 'yongShen.school');
    }
  });

  it('gives every 大运 note both languages', () => {
    for (const a of charts.slice(0, 20)) {
      for (const d of a.career.decades) {
        d.notes.forEach((n, i) => assertPair(n, `decade ${d.ganZhi} note[${i}]`));
      }
    }
  });

  it('gives every 神煞 meaning both languages', () => {
    for (const a of charts.slice(0, 30)) {
      for (const s of findShenSha(a.chart)) assertPair(s.meaning, `${s.name} meaning`);
    }
  });
});

describe('glossary covers what the engine emits', () => {
  const charts = sweep();

  it('knows every 十神 that appears in a chart', () => {
    const seen = new Set<string>();
    for (const a of charts) {
      for (const p of [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.day, a.chart.pillars.hour]) {
        if (!p) continue;
        if (p.tenGod) seen.add(p.tenGod);
        for (const h of p.hiddenStems) seen.add(h.tenGod);
      }
    }
    expect(seen.size).toBe(10);
    for (const g of seen) expect(TEN_GOD[g], `missing 十神 ${g}`).toBeDefined();
  });

  it('knows every 十二长生 stage', () => {
    const seen = new Set<string>();
    for (const a of charts) {
      for (const p of [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.day, a.chart.pillars.hour]) {
        if (p) seen.add(p.terrain);
      }
    }
    for (const s of seen) expect(TERRAIN[s], `missing 长生 ${s}`).toBeDefined();
  });

  it('knows every 五行 and every 十神 family', () => {
    for (const e of ['木', '火', '土', '金', '水']) expect(ELEMENT[e]).toBeDefined();
    for (const f of ['比劫', '印', '食伤', '财', '官杀']) expect(TEN_GOD_FAMILY[f]).toBeDefined();
  });

  it('knows every 神煞 the detector can produce', () => {
    const seen = new Set<string>();
    for (const a of charts) for (const s of findShenSha(a.chart)) seen.add(s.name);
    expect(seen.size).toBeGreaterThan(4);
    for (const n of seen) expect(SHENSHA[n], `missing 神煞 ${n}`).toBeDefined();
  });

  it('knows every relation kind', () => {
    const p = (position: string, gz: string) => ({ position, stem: gz[0]!, branch: gz[1]! });
    const seen = new Set<string>();
    // A spread wide enough to produce every kind at least once.
    for (const combo of [
      ['甲子', '己丑'], ['甲子', '庚午'], ['甲寅', '乙亥'], ['丙巳', '戊申'],
      ['甲申', '丙子'], ['甲子', '乙酉'], ['甲辰', '丙辰'], ['甲子', '乙未'],
    ]) {
      for (const r of findRelations(combo.map((gz, i) => p(`P${i}`, gz)))) seen.add(r.kind);
    }
    for (const r of findRelations([p('A', '甲寅'), p('B', '乙卯'), p('C', '戊辰')])) seen.add(r.kind);
    for (const r of findRelations([p('A', '甲申'), p('B', '丙子'), p('C', '戊辰')])) seen.add(r.kind);
    expect(seen.size).toBeGreaterThan(6);
    for (const k of seen) expect(RELATION[k], `missing relation ${k}`).toBeDefined();
  });

  it('knows every 格局 name', () => {
    const seen = new Set(charts.map((a) => a.career.structure));
    for (const s of seen) expect(STRUCTURE[s], `missing 格局 ${s}`).toBeDefined();
  });

  it('falls back to the Chinese rather than blanking on an unknown term', () => {
    expect(term('甲子', 'en')).toBe('甲子');
    expect(term('海中金', 'en')).toBe('海中金');
    expect(term('正财', 'en')).toBe('Direct Wealth');
    expect(term('正财', 'zh')).toBe('正财');
  });
});

describe('interface strings', () => {
  it('gives every UI entry both languages', () => {
    for (const [key, value] of Object.entries(UI)) assertPair(value, `UI.${key}`);
  });

  it('renders 起运 in both languages from structured data', () => {
    const c = buildChart(base());
    expect(c.luckStart.years).toBeGreaterThanOrEqual(0);
    const zh = formatLuckStart(c.luckStart, c.luckForward, 'zh');
    const en = formatLuckStart(c.luckStart, c.luckForward, 'en');
    expect(zh).toContain('起运');
    expect(en).toContain('Luck pillars begin');
    expect(CHINESE_PROSE.test(en), `leaked Chinese: "${en}"`).toBe(false);
    // The engine must not be building a sentence itself.
    expect(Object.keys(c.luckStart).sort()).toEqual(['days', 'months', 'years']);
  });

  it('renders 排盘依据 notes in both languages without leaking the other', () => {
    const pre = buildChart(base({ year: 1981, month: 12, day: 15, longitude: 103.82, useTrueSolarTime: true }));
    expect(pre.moment.notes.length).toBeGreaterThan(0);
    for (const n of pre.moment.notes) {
      const zh = formatNote(n, 'zh');
      const en = formatNote(n, 'en');
      expect(zh).not.toBe(en);
      expect(CHINESE_PROSE.test(en), `English note leaked Chinese: "${en}"`).toBe(false);
    }
  });
});

describe('templates and prompts', () => {
  it('gives every template a bilingual question, hint and focus', () => {
    for (const t of TEMPLATES) {
      assertPair(t.question, `${t.id} question`);
      assertPair(t.hint, `${t.id} hint`);
      assertPair(t.focus, `${t.id} focus`);
    }
  });

  it('routes English questions as well as Chinese', () => {
    const cases: readonly [string, string][] = [
      ['when will I get married', 'relationship'],
      ['what field suits me', 'career'],
      ['what might my partner be like', 'relationship'],
      ['should I start my own business', 'career'],
    ];
    for (const [q, topic] of cases) {
      const r = routeQuestion(q);
      expect(r.kind, q).toBe('template');
      if (r.kind === 'template') expect(r.template.topic, q).toBe(topic);
    }
  });

  it('declines out-of-scope questions asked in English', () => {
    for (const q of ['will I get cancer', 'how long will I live', 'which stock should I buy', 'will I win the lottery']) {
      const r = routeQuestion(q);
      expect(r.kind, q).toBe('declined');
      if (r.kind === 'declined') assertPair(r.reason, `decline for "${q}"`);
    }
  });

  it('builds a genuinely English prompt, not a Chinese one with English labels', () => {
    const a = analyse();
    const tpl = templateById('rel.overview')!;
    const en = buildUserPrompt(a, tpl, 'en');
    const zh = buildUserPrompt(a, tpl, 'zh');

    expect(en).not.toBe(zh);
    expect(en).toContain('Day Master');
    expect(en).toContain('Write in English.');
    expect(en).toContain(tpl.question.en);
    // The pillars themselves must survive untranslated.
    expect(en).toContain(a.chart.pillars.day.ganZhi);
    // And the Chinese prompt must not carry English instructions.
    expect(zh).toContain('篇幅约');
    expect(zh).not.toContain('Write in English');
  });

  it('keeps the birth date out of the prompt in both languages', () => {
    const a = analyse();
    const tpl = templateById('career.field')!;
    for (const locale of LOCALES) {
      const p = buildUserPrompt(a, tpl, locale);
      expect(p, locale).not.toContain('1990-06-15');
    }
  });

  it('has a distinct system prompt per language, each enforcing citations', () => {
    const zh = systemPrompt('zh');
    const en = systemPrompt('en');
    expect(zh).not.toBe(en);
    // Both must demand the same citation marker — one parser, two languages.
    expect(zh).toContain('依据');
    expect(en).toContain('依据');
    expect(en).toContain('Teach each term once');
    expect(en).toContain('Nothing on health');
    expect(zh).toContain('不谈健康');
  });

  it('warns off the hour pillar in both languages when the time is unknown', () => {
    const noHour = analyzeChart(
      buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' }),
    );
    const tpl = templateById('rel.overview')!;
    expect(buildUserPrompt(noHour, tpl, 'zh')).toContain('不可提及时柱');
    expect(buildUserPrompt(noHour, tpl, 'en')).toContain('do not mention the hour pillar');
  });
});

describe('determinism holds per language', () => {
  it('produces identical findings for the same chart and locale', () => {
    const a = analyse();
    const b = analyse();
    for (const locale of LOCALES) {
      const pick = (x: typeof a, l: Locale) => x.findings.map((f) => f.claim[l]).join('|');
      expect(pick(b, locale)).toBe(pick(a, locale));
    }
  });

  it('keeps numbers identical across languages', () => {
    const a = analyse();
    const digits = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).join(',');
    for (const f of a.findings) {
      // Years, ages and percentages must not drift between the two writings.
      expect(digits(f.claim.en), `${f.id}: numbers differ between languages`)
        .toBe(digits(f.claim.zh));
    }
  });
});

describe('strength and yongshen render in both languages', () => {
  it('names the school in English too', () => {
    const c = buildChart(base());
    const s = analyzeStrength(c);
    const y = analyzeYongShen(c, s);
    expect(y.school.en).toContain('Ziping');
    expect(y.school.zh).toContain('子平');
  });
});
