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
  const chart = buildChart(parseArgs(process.argv.slice(2)));
  const a = analyzeChart(chart);

  rule(`四柱  ${[chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]
    .map((p) => p?.ganZhi ?? '——').join('  ')}   日主 ${chart.dayMaster}（${chart.dayMasterYinYang}${chart.dayMasterElement}）`);

  rule('旺衰');
  for (const r of a.strength.reasoning) console.log(`  ${r}`);
  console.log(`  五行占比  ${Object.entries(a.strength.elementPercent)
    .map(([e, p]) => `${e} ${p}%`).join('   ')}`);

  rule('用神');
  for (const r of a.yongShen.reasoning) console.log(`  ${r}`);

  rule('姻缘 / 婚姻');
  for (const f of a.relationship.findings) {
    console.log(`\n  ▸ ${f.claim}`);
    console.log(`    [${f.id} · ${f.confidence}]`);
    for (const e of f.evidence) console.log(`    · ${e}`);
  }

  rule('事业 / 财运');
  for (const f of a.career.findings) {
    console.log(`\n  ▸ ${f.claim}`);
    console.log(`    [${f.id} · ${f.confidence}]`);
    for (const e of f.evidence) console.log(`    · ${e}`);
  }

  rule('大运走势');
  for (const d of a.career.decades) {
    const bar = d.verdict === '有利' ? '████' : d.verdict === '偏顺' ? '███'
      : d.verdict === '平稳' ? '██' : '▒';
    console.log(`  ${String(d.startAge).padStart(3)}-${String(d.endAge).padEnd(3)}岁 ` +
      `${d.startYear}-${d.endYear}  ${d.ganZhi}  ${d.verdict}  ${bar}`);
  }

  console.log(`\n  findings: ${a.findings.length}   chartHash ${chart.chartHash}\n`);
}

main();
