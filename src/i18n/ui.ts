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
    '排盘可以核对，姻缘与事业两个主题的解读都附上推导依据。',
    'A chart you can check, and readings on relationships and career that show ' +
      'their working.',
  ),

  // form
  birthDate: t('出生日期（公历）', 'Date of birth'),
  birthTime: t('出生时间', 'Time of birth'),
  gender: t('性别', 'Gender'),
  male: t('男', 'Male'),
  female: t('女', 'Female'),
  birthPlace: t('出生地', 'Place of birth'),
  placeSearch: t('搜索城市／地区…', 'Search city or region…'),
  placeNoMatch: t('没有相符的城市。试试国家名，或邻近的大城市。',
    'No match. Try the country, or the nearest large city.'),
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
  whyThis: t('看推导过程', 'Show the working'),
  showEvidence: t('依据', 'Evidence'),
  basedOn: t('依据', 'Based on'),
  termsUsed: t('用语说明', 'Terms used here'),

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

  // forecast
  forecast: t('近期运势 · 感情', 'Short-range outlook'),
  headlineLabel: t('概要', 'At a glance'),
  trackYours: t('你', 'You'),
  trackTheirs: t('对方', 'Them'),
  trackBetween: t('两人之间', 'Between you'),
  jointHint: t('已记住对方生辰，重新排一次即可看两人对照。',
    "Partner details are remembered — run this again to see both of you side by side."),
  nothingInPlay: t('这一天没有牵动。', 'Nothing in play on this day.'),
  hoursTitle: t('时辰', 'Hours of the day'),
  hoursGood: t('阻力最小', 'Least friction'),
  hoursAvoid: t('容易起冲突', 'Most abrasive'),
  hoursNone: t('这天没有特别顺的时辰', 'no hour stands out today'),

  // compatibility
  compatibility: t('合婚 · 两人对照', 'Compatibility'),
  addPartner: t('加入对方的生辰', "Add your partner's birth details"),
  addPartnerHint: t('两盘对照，看彼此补益与夫妻宫相合', 'Reads both charts against each other'),
  partnerName: t('称呼（可留空）', 'Name (optional)'),
  partnerNamePlaceholder: t('例如：阿明', 'e.g. Karin'),
  compare: t('对照', 'Compare'),
  comparePartner: t('对照对方的盘', "Compare with your partner's chart"),
  rememberedShort: t('已记住，仅存本机', 'remembered on this device'),
  theyGiveYou: t('对方补你', 'They supply you'),
  youGiveThem: t('你补对方', 'You supply them'),
  supplyExplainer: t(
    '这两个数字，是对方命局里你所需五行的占比，以及反过来的占比。' +
      '两人的补益少有对等，所以分开列。压成一个「匹配度」，就看不出补益往哪边走了。',
    'Each figure is how much of one chart is made of the elements the other ' +
      'needs. We keep them apart because the benefit is rarely equal, and one ' +
      'blended score would hide which direction it runs.',
  ),
  you: t('你', 'You'),
  them: t('对方', 'Them'),

  // remembered data
  remembered: t('已记住这份生辰（仅存在本机）', 'Birth details remembered on this device only'),
  forget: t('清除', 'Forget'),

  // narrator provenance
  writtenBy: t('本文由', 'Written by'),
  composedLabel: t('程序据结论直接组稿，未使用模型', 'composed from the findings in code, with no model'),
  modelHint: t('Gemini 与 Groq 都有免费额度。设定任一金钥，行文会更流畅。',
    'Gemini and Groq both have free tiers. Add either key for more fluent prose.'),

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
