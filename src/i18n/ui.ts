/**
 * Interface chrome.
 *
 * Only the strings the page frame needs. Everything with 命理 content in it
 * lives in the glossary or is authored alongside the finding that makes the
 * claim — a UI catalogue is the wrong place for domain language, because the
 * wording has to sit next to the reasoning it describes.
 */

import { t, type LocalizedText } from './text';

export const UI = {
  title: t('八字排盘', 'BaZi Chart'),
  tagline: t(
    '可核对的排盘，与姻缘、事业两个主题的解读。每一句话都附上它所依据的命理事实。',
    'A chart you can check, with readings on two subjects: relationships and ' +
      'career. Every claim carries the chart facts it rests on.',
  ),

  // form
  birthDate: t('出生日期（公历）', 'Date of birth'),
  birthTime: t('出生时间', 'Time of birth'),
  gender: t('性别', 'Gender'),
  male: t('男', 'Male'),
  female: t('女', 'Female'),
  birthPlace: t('出生地', 'Place of birth'),
  knowTime: t('知道出生时辰', 'I know my birth time'),
  useTrueSolar: t('使用真太阳时（各派做法不同）', 'Use true solar time (schools differ)'),
  cast: t('排盘', 'Cast chart'),
  casting: t('排盘中…', 'Casting…'),

  // sections
  pillars: t('四柱', 'The Four Pillars'),
  basis: t('排盘依据', 'How this was cast'),
  balance: t('五行强弱', 'Element balance'),
  luck: t('大运', 'Luck pillars'),
  reading: t('解读', 'Reading'),
  findings: t('已算出的结论', 'Computed findings'),

  // pillar labels
  yearPillar: t('年柱', 'Year'),
  monthPillar: t('月柱', 'Month'),
  dayPillar: t('日柱', 'Day'),
  hourPillar: t('时柱', 'Hour'),
  dayMaster: t('日主', 'Day Master'),
  timeUnknown: t('时辰未知', 'hour unknown'),
  void: t('空', 'void'),

  // basis card
  chartedAt: t('实际起盘时刻', 'Charted at'),

  // yongshen card
  favourable: t('用神', 'Favourable'),
  supporting: t('喜神', 'Supporting'),
  methodUsed: t('取用流派', 'Method'),

  // tabs
  relationships: t('姻缘 · 婚姻', 'Relationships'),
  career: t('事业 · 财运', 'Career'),

  // reading
  generating: t('生成中', 'writing'),
  groundedOk: t('处引用均对应到已算出的结论', 'citations all resolve to computed findings'),
  groundedBadPrefix: t('处引用不在结论清单中：', 'citations are not in the findings list: '),
  noFindings: t('没有可报告的结论。', 'No findings to report.'),

  // confidence chips
  confHigh: t('确', 'firm'),
  confMedium: t('中', 'likely'),
  confLow: t('存疑', 'contested'),

  // errors
  errConnect: t('无法连线，请稍后再试。', 'Could not connect. Try again shortly.'),
  errCast: t('排盘失败。', 'Could not cast the chart.'),
  errReading: t('生成解读失败。', 'Could not generate the reading.'),
  errStreamCut: t('连线中断，解读未完成。', 'The connection dropped; the reading is incomplete.'),

  // gate
  enterPin: t('请输入通行码', 'Enter passcode'),
  clear: t('清除', 'Clear'),
  verifying: t('验证中…', 'Checking…'),
  pinWrong: t('通行码不对。', 'Wrong passcode.'),
} as const satisfies Record<string, LocalizedText>;

export type UiKey = keyof typeof UI;
