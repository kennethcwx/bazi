/**
 * Chart printer, for cross-checking L1 against 问真八字 by eye.
 *
 * The golden suite proves the derivation rules; this proves the result against
 * a tool practitioners already trust. Run the same birth in both and compare.
 *
 *   npx tsx src/cli.ts 1990-06-15 14:30 male
 *   npx tsx src/cli.ts 1981-12-15 08:00 female --tz Asia/Singapore --lon 103.82
 *   npx tsx src/cli.ts 1990-06-15 --unknown-time male
 */

import { buildChart } from './engine/chart';
import { formatNote, formatLuckStart } from './i18n/notes';
import { isLocale } from './i18n/text';
import type { BirthInput, Gender, Pillar } from './engine/types';

function parseArgs(argv: readonly string[]): BirthInput {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const date = positional[0];
  if (!date) throw new Error('Usage: cli.ts YYYY-MM-DD [HH:MM] male|female [--tz Z] [--lon L]');

  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) throw new Error(`Bad date "${date}", expected YYYY-MM-DD`);

  const unknownTime = argv.includes('--unknown-time');
  const timePart = positional.find((p) => p.includes(':'));
  const [h, mi] = timePart ? timePart.split(':').map(Number) : [undefined, undefined];

  const gender = (positional.find((p) => p === 'male' || p === 'female') ?? 'male') as Gender;
  const lon = flag('lon');

  return {
    year: y, month: mo, day: d,
    ...(unknownTime || h === undefined ? {} : { hour: h, minute: mi ?? 0 }),
    timeZone: flag('tz') ?? 'Asia/Singapore',
    gender,
    ...(lon ? { longitude: Number(lon) } : {}),
    useTrueSolarTime: !argv.includes('--no-true-solar'),
  };
}

const pad = (s: string, w: number) => {
  // CJK glyphs occupy two terminal columns; pad on display width, not length.
  const width = [...s].reduce((n, ch) => n + (/[⺀-￿]/.test(ch) ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, w - width));
};

/**
 * One column of the chart table.
 *
 * 藏干 get a line each rather than being joined onto one. Three of them read
 * `甲伤官 丙正财 戊正官` — twenty display columns of CJK in a cell sized for
 * sixteen, so `pad()` returned nothing and the cell bled into its neighbour.
 * Stacking is what the web UI does, and it removes the width guess entirely.
 */
const HIDDEN_ROWS = 3;

function pillarColumn(p: Pillar | null, label: string): string[] {
  if (!p) {
    return [label, '—', '—', ...Array<string>(HIDDEN_ROWS).fill(''), '(时辰未知)', '', ''];
  }
  const hidden = p.hiddenStems.map((h) => `${h.stem}${h.tenGod}`);
  return [
    label,
    `${p.stem}${p.branch}`,
    p.tenGod ?? '日主',
    ...Array.from({ length: HIDDEN_ROWS }, (_, i) => hidden[i] ?? ''),
    p.naYin,
    p.terrain,
    p.isVoid ? '空亡' : '',
  ];
}

function main() {
  const input = parseArgs(process.argv.slice(2));
  const c = buildChart(input);

  console.log('\n' + '─'.repeat(64));
  console.log(`  ${c.moment.input}  ${c.gender === 'male' ? '男' : '女'}   ${c.moment.timeZone}`);
  console.log('─'.repeat(64));
  const cliLang = process.argv.includes('--lang')
    ? process.argv[process.argv.indexOf('--lang') + 1] : 'zh';
  const L = isLocale(cliLang) ? cliLang : 'zh';
  for (const n of c.moment.notes) console.log(`  · ${formatNote(n, L)}`);
  if (c.moment.trueSolarCorrectionMinutes !== 0) {
    const m = c.moment.charted;
    console.log(`  · charted at ${m.year}-${m.month}-${m.day} ` +
      `${String(m.hour).padStart(2, '0')}:${String(m.minute).padStart(2, '0')} 真太阳时`);
  }

  const cols = [
    pillarColumn(c.pillars.year, '年柱'),
    pillarColumn(c.pillars.month, '月柱'),
    pillarColumn(c.pillars.day, '日柱'),
    pillarColumn(c.pillars.hour, '时柱'),
  ];
  const rowLabels = ['', '干支', '十神', '藏干', '', '', '纳音', '长生', ''];

  console.log('');
  for (let r = 0; r < rowLabels.length; r++) {
    const label = pad(rowLabels[r] ?? '', 6);
    const cells = cols.map((col) => pad(col[r] ?? '', 16)).join('');
    if (cells.trim()) console.log(`  ${label}${cells}`);
  }

  console.log(`\n  日主 ${c.dayMaster}（${c.dayMasterYinYang}${c.dayMasterElement}）` +
    `　${formatLuckStart(c.luckStart, c.luckForward, L)}`);

  console.log('\n  大运');
  for (const d of c.decades.slice(0, 8)) {
    console.log(`    ${String(d.startAge).padStart(3)}岁 ${d.startYear}  ` +
      `${pad(d.ganZhi, 6)}${pad(d.stemTenGod, 8)}${pad(d.branchMainTenGod, 8)}` +
      `${d.isVoid ? '空亡' : ''}`);
  }
  console.log(`\n  chartHash ${c.chartHash}\n`);
}

main();
