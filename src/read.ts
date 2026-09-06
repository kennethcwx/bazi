/**
 * Print the full L2 analysis for a birth — findings, evidence and all.
 *
 * This is the view a practitioner should be able to argue with: every claim
 * carries the chart facts it came from, so a disagreement lands on a specific
 * derivation rather than on the app as a whole.
 *
 *   npx tsx src/read.ts 1990-06-15 14:30 male --lon 103.82
 */

import { buildChart } from './engine/chart';
import { analyzeChart } from './analyzer/index';
import { formatNote } from './i18n/notes';
import { isLocale, type Locale } from './i18n/text';
import { ELEMENT, TEN_GOD } from './i18n/glossary';
import type { BirthInput, Gender } from './engine/types';

function parseArgs(argv: readonly string[]): BirthInput {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const date = positional[0];
  if (!date) throw new Error('Usage: read.ts YYYY-MM-DD [HH:MM] male|female [--lon L] [--tz Z]');

  const [y, mo, d] = date.split('-').map(Number);
  const timePart = positional.find((p) => p.includes(':'));
  const [h, mi] = timePart ? timePart.split(':').map(Number) : [undefined, undefined];
  const lon = flag('lon');

  return {
    year: y!, month: mo!, day: d!,
    ...(h === undefined ? {} : { hour: h, minute: mi ?? 0 }),
    timeZone: flag('tz') ?? 'Asia/Singapore',
    gender: (positional.find((p) => p === 'male' || p === 'female') ?? 'male') as Gender,
    ...(lon ? { longitude: Number(lon) } : {}),
    useTrueSolarTime: !argv.includes('--no-true-solar'),
  };
}

const rule = (t: string) => console.log(`\n${t}\n${'─'.repeat(66)}`);

function main() {
  const argv = process.argv.slice(2);
  const flagIdx = argv.indexOf('--lang');
  const raw = flagIdx >= 0 ? argv[flagIdx + 1] : 'zh';
  const L: Locale = isLocale(raw) ? raw : 'zh';

  const chart = buildChart(parseArgs(argv));
  const a = analyzeChart(chart);

  rule(`四柱  ${[chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]
    .map((p) => p?.ganZhi ?? '——').join('  ')}   日主 ${chart.dayMaster}（${chart.dayMasterYinYang}${chart.dayMasterElement}）`);

  rule(L === 'zh' ? '旺衰' : 'Day Master strength');
  for (const r of a.strength.reasoning) console.log(`  ${r[L]}`);
  console.log(`  ${Object.entries(a.strength.elementPercent)
    .map(([e, p]) => `${ELEMENT[e]![L]} ${p}%`).join('   ')}`);

  rule(L === 'zh' ? '用神' : 'Favourable element');
  for (const r of a.yongShen.reasoning) console.log(`  ${r[L]}`);

  rule(L === 'zh' ? '姻缘 / 婚姻' : 'Relationships');
  for (const f of a.relationship.findings) {
    console.log(`\n  ▸ ${f.claim[L]}`);
    console.log(`    [${f.id} · ${f.confidence}]`);
    for (const e of f.evidence) console.log(`    · ${e[L]}`);
  }

  rule(L === 'zh' ? '事业 / 财运' : 'Career');
  for (const f of a.career.findings) {
    console.log(`\n  ▸ ${f.claim[L]}`);
    console.log(`    [${f.id} · ${f.confidence}]`);
    for (const e of f.evidence) console.log(`    · ${e[L]}`);
  }

  rule(L === 'zh' ? '大运走势' : 'Luck pillars');
  for (const d of a.career.decades) {
    const bar = d.verdict === '有利' ? '████' : d.verdict === '偏顺' ? '███'
      : d.verdict === '平稳' ? '██' : '▒';
    console.log(`  ${String(d.startAge).padStart(3)}-${String(d.endAge).padEnd(3)}岁 ` +
      `${d.startYear}-${d.endYear}  ${d.ganZhi}  ${d.verdict}  ${bar}`);
  }

  console.log(`\n  findings: ${a.findings.length}   chartHash ${chart.chartHash}\n`);
}

main();
