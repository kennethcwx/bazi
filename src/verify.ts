/**
 * The 问真八字 comparison harness.
 *
 * Every accuracy claim in this project rests on invariant sweeps — 五虎遁,
 * 五鼠遁, day-cycle continuity, the 立春 turn. Those prove the engine is
 * internally consistent. They cannot prove it agrees with the tool
 * practitioners already trust, and until someone checks that, the whole
 * premise is unverified.
 *
 * This makes the check cheap. It prints each fixture in a layout you can hold
 * beside 问真, and diffs whatever you transcribe back into the fixture file.
 *
 * Only the four pillars, the 起运 span and the first 大运 need transcribing.
 * 藏干, 十神, 纳音 and 星运 all follow deterministically once the pillars agree,
 * and the invariant suite already covers those derivations.
 *
 * ⚠️ 起运 and the 大运 ages are on DIFFERENT SCALES, and mixing them up reads as
 * a disagreement that is not there. 起运 is an elapsed span from birth — 7年2个月.
 * The age against each 大运 is 虚岁 in the calendar year the pillar is entered,
 * so the same chart shows 起运 7年2个月 and a first 大运 at 9. Both are ordinary
 * conventions. Each is printed here with its scale named, and transcribed into
 * its own field, so a real mismatch cannot hide behind a units confusion.
 *
 *   npm run verify              print every fixture for comparison
 *   npm run verify -- --check   diff only the ones you have filled in
 *   npm run verify -- --todo    list what is still blank
 */

import { readFileSync } from 'node:fs';
import { buildChart } from './engine/chart';
import { formatNote, formatLuckStart } from './i18n/notes';
import type { BirthInput, Chart } from './engine/types';

interface WenZhen {
  pillars: string;
  /** 起运 as an elapsed span, e.g. 7 years 2 months. Not an age. */
  luckStartYears: number;
  luckStartMonths: number;
  firstLuck: string;
  /** The age 问真 prints against the first 大运, if it shows one. Optional
   *  because the age scale is a convention and this field is the one most
   *  likely to differ for a reason that is not an error. */
  firstLuckAge?: number | null;
}
interface Case {
  label: string;
  why?: string;
  birth: BirthInput;
  wenzhen: WenZhen | null;
}

const FIXTURES = new URL('../test/fixtures/wenzhen.json', import.meta.url);
const cases: Case[] = JSON.parse(readFileSync(FIXTURES, 'utf8')).cases;

const pillarsOf = (c: Chart): string =>
  [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour]
    .map((p) => p?.ganZhi ?? '--').join(' ');

const pad = (s: string, w: number) => {
  const width = [...s].reduce((n, ch) => n + (/[⺀-￿]/.test(ch) ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, w - width));
};

/** What to type into 问真, so the two tools are given the same input. */
function inputLine(b: BirthInput): string {
  const time = b.hour === undefined
    ? 'hour unknown'
    : `${String(b.hour).padStart(2, '0')}:${String(b.minute ?? 0).padStart(2, '0')}`;
  return `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')} ${time}` +
    `　${b.gender === 'male' ? '男' : '女'}　${b.timeZone}` +
    `　真太阳时 ${b.useTrueSolarTime ? 'ON' : 'OFF'}`;
}

function show(c: Case, index: number): void {
  const chart = buildChart(c.birth);
  console.log(`\n${'━'.repeat(66)}`);
  console.log(`[${index + 1}/${cases.length}] ${c.label}`);
  if (c.why) console.log(`         ${c.why}`);
  console.log('─'.repeat(66));
  console.log(`  enter in 问真:  ${inputLine(c.birth)}`);
  for (const n of chart.moment.notes) console.log(`  · ${formatNote(n, 'zh')}`);
  console.log('');
  console.log(`  ${pad('四柱', 10)}${pillarsOf(chart)}`);
  console.log(`  ${pad('起运', 10)}${formatLuckStart(chart.luckStart, chart.luckForward, 'zh')}`);
  console.log(`  ${pad('大运', 10)}${chart.decades.slice(0, 4)
    .map((d) => `${d.ganZhi} ${d.startAge}虚岁(${d.startYear}年)`).join('  ')}`);
  console.log(`  ${pad('', 10)}↑ 虚岁，与上面的「起运」不同尺度，勿直接相比。`);
  console.log(`  ${pad('月令司令', 10)}距节 ${chart.monthTermDays.toFixed(1)} 天`);

  if (!c.wenzhen) {
    console.log('\n  问真 says — paste into the fixture:');
    const shape = c.birth.hour === undefined ? '__ __ __ --' : '__ __ __ __';
    console.log(`    "wenzhen": { "pillars": "${shape}", "luckStartYears": 0, ` +
      `"luckStartMonths": 0, "firstLuck": "__", "firstLuckAge": null }`);
  }
}

interface Diff { field: string; ours: string; theirs: string }

function diff(c: Case): { label: string; diffs: Diff[] } | null {
  if (!c.wenzhen) return null;
  const chart = buildChart(c.birth);
  const diffs: Diff[] = [];

  const ours = pillarsOf(chart).split(/\s+/);
  const theirs = c.wenzhen.pillars.trim().split(/\s+/);
  const names = ['年柱', '月柱', '日柱', '时柱'];
  for (let i = 0; i < 4; i++) {
    if ((ours[i] ?? '') !== (theirs[i] ?? '')) {
      diffs.push({ field: names[i]!, ours: ours[i] ?? '--', theirs: theirs[i] ?? '--' });
    }
  }
  // Compared against the ELAPSED span, not the 大运 age. Comparing 起运 to
  // decades[0].startAge was the old bug: two different scales, so almost every
  // fixture would have reported a mismatch that was never there.
  const w = c.wenzhen;
  if (chart.luckStart.years !== w.luckStartYears
      || chart.luckStart.months !== w.luckStartMonths) {
    diffs.push({
      field: '起运',
      ours: `${chart.luckStart.years}年${chart.luckStart.months}个月`,
      theirs: `${w.luckStartYears}年${w.luckStartMonths}个月`,
    });
  }
  if (w.firstLuckAge != null) {
    const startAge = chart.decades[0]?.startAge ?? 0;
    if (startAge !== w.firstLuckAge) {
      diffs.push({ field: '大运首步虚岁', ours: String(startAge), theirs: String(w.firstLuckAge) });
    }
  }
  const first = chart.decades[0]?.ganZhi ?? '';
  if (first !== c.wenzhen.firstLuck) {
    diffs.push({ field: '大运一', ours: first, theirs: c.wenzhen.firstLuck });
  }
  return { label: c.label, diffs };
}

function main(): void {
  const argv = process.argv.slice(2);

  if (argv.includes('--todo')) {
    const blank = cases.filter((c) => !c.wenzhen);
    console.log(`\n${blank.length} of ${cases.length} still to transcribe:\n`);
    for (const c of blank) console.log(`  · ${c.label}`);
    console.log('');
    return;
  }

  if (argv.includes('--check')) {
    const results = cases.map(diff).filter((r): r is NonNullable<typeof r> => r !== null);
    if (results.length === 0) {
      console.log('\nNothing transcribed yet. Run `npm run verify` and fill in the ' +
        '`wenzhen` blocks from 问真.\n');
      return;
    }
    const bad = results.filter((r) => r.diffs.length > 0);
    console.log(`\nChecked ${results.length} of ${cases.length} fixtures.\n`);
    for (const r of bad) {
      console.log(`  ✗ ${r.label}`);
      for (const d of r.diffs) {
        console.log(`      ${pad(d.field, 8)}ours ${pad(d.ours, 8)}问真 ${d.theirs}`);
      }
    }
    console.log(bad.length === 0
      ? `  ✓ all ${results.length} agree with 问真\n`
      : `\n  ${bad.length} disagree. Each one is a real bug until shown otherwise.\n`);
    process.exitCode = bad.length > 0 ? 1 : 0;
    return;
  }

  cases.forEach(show);
  const blank = cases.filter((c) => !c.wenzhen).length;
  console.log(`\n${'━'.repeat(66)}`);
  console.log(`${cases.length} fixtures, ${blank} still blank.`);
  console.log('Fill the `wenzhen` blocks in test/fixtures/wenzhen.json, then:');
  console.log('  npm run verify -- --check\n');
}

main();
