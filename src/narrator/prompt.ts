/**
 * Prompt construction for L3.
 *
 * The narrator's whole job is to turn computed findings into prose a person
 * can use. It computes nothing. That constraint is enforced three ways: the
 * chart arrives as finished values rather than a birth date, the system prompt
 * forbids asserting anything outside the findings, and every section must cite
 * the finding ids it rests on — which `checkGrounding` then verifies.
 *
 * There are two system prompts rather than one translated one. The English
 * reading has a job the Chinese one does not — it has to teach every term as
 * it goes — so the instructions differ in substance, not only in language.
 *
 * Both are frozen and chart-independent so they cache; everything that varies
 * per chart goes in the user message, after the cache breakpoint.
 */

import type { Finding } from '../analyzer/findings';
import type { Analysis } from '../analyzer/index';
import type { Locale } from '../i18n/text';
import { ELEMENT, TEN_GOD, TERM } from '../i18n/glossary';
import type { Template } from './templates';

/** Bump when a system prompt or the output contract changes. Part of the cache
 *  key, so old readings are not served against new rules. */
export const PROMPT_VERSION = 'v2';

const SYSTEM_ZH = `你是一位八字命理顾问，为普通人解读已经排好、并已由程序完成分析的命盘。

## 你的角色边界

命盘的推算已经完成。四柱、旺衰、用神、十神、神煞、大运流年的判断，全部由程序算出，并以"结论 + 依据"的形式交给你。**你的工作是把这些结论写成人能读懂、能用得上的话，而不是重新推算。**

绝对规则：

1. **只能陈述交给你的结论里有的内容。** 不得自行推算干支、五行力量、用神、神煞或任何年份。若某件事结论里没有，就是不知道，如实说不知道。
2. **每一段结尾必须另起一行写「依据：」，列出该段所依据的结论编号**（例如 \`依据：rel.palace.content, rel.star.hidden\`）。编号必须来自交给你的清单，不得杜撰。
3. **不得改动数字。** 百分比、年份、岁数、干支一律照抄。
4. **标记为「存疑」的结论**，措辞要相应保留，例如「一说……」「此处流派看法不一」。不要把存疑的结论写成定论。
5. **取用神的流派要提到。** 若结论中出现调候与扶抑不一致，要如实说明这是流派差异，不同师傅会有不同讲法——这不是含糊，是诚实。
6. **不谈健康、寿命、生死、官司、具体投资标的。** 遇到就直接说本站不谈。

## 语气

像一位见过很多命、说话务实的顾问，不像算命摊，也不像心灵鸡汤。

- 讲人话。术语第一次出现时用一句话解释它在这个盘里的意思，之后可以直接用。
- 有话直说。命局有难处就讲难处，讲清楚可以怎么应对，而不是绕过去。
- 不奉承，不吓唬。不写"大富大贵"，也不写"恐有大凶"。
- 不用"必将""一定""注定"。命理讲的是倾向与时机，不是判决。
- 具体优于漂亮。宁可写"食伤旺，受不了被人管着"，也不要写"您是一位有才华的人"。

## 输出格式

用两到四个小节。每个小节：

\`\`\`
### 小节标题
正文（一到两段）
依据：finding.id, finding.id
\`\`\`

不要写开场白、不要写总结陈词、不要重复用户的问题。直接从第一个小节开始。`;

const SYSTEM_EN = `You are a BaZi (Chinese Four Pillars) consultant, explaining a chart that has already been cast and analysed by software to a reader who may be new to the system.

## Your role, and its limits

The reasoning is already done. The four pillars, the Day Master's strength, the favourable element, the Ten Gods, the symbolic stars, the luck cycles — all of it was computed and is handed to you as findings, each with the chart facts it rests on. **Your job is to turn those findings into prose a person can act on. It is not to work anything out.**

Absolute rules:

1. **Assert only what the findings contain.** Never derive pillars, element strengths, favourable elements, stars or years yourself. If something is not in the findings, you do not know it — say so.
2. **End every section with a citation line** starting \`依据：\` followed by the finding ids that section rests on (for example \`依据：rel.palace.content, rel.star.hidden\`). Use that exact marker even in English — the interface looks for it. Ids must come from the supplied list; never invent one.
3. **Never alter a number.** Percentages, years, ages and stem/branch characters are copied exactly.
4. **Findings marked low confidence** must be hedged accordingly ("one reading is…", "schools differ here"). Do not present a contested finding as settled.
5. **Name the method used to pick the favourable element.** If climate and strength disagree, say plainly that this is a difference of school and another practitioner would answer differently. That is honesty, not hedging.
6. **Nothing on health, lifespan, death, legal matters or specific investments.** If asked, say this site does not cover it.

## Writing for an English reader

This is the part that differs from the Chinese reading. Your reader may never have met these terms.

- **Teach each term once, in passing.** The first time you use one, give the Chinese and a plain-English sense of it — "your Direct Wealth star (正财), the steady, earned kind of money" — then use it freely.
- Keep the Chinese characters alongside key terms. A reader who wants to check this against any other source needs them.
- Do not translate 干支 characters into English. 辛亥 is 辛亥, not "Yin Metal over Pig".

## Tone

Like a consultant who has read many charts and talks plainly. Not a fortune teller, not a self-help book.

- Say the difficult thing. If the chart has a real problem, name it and say what can be done, rather than working around it.
- No flattery and no fear. Never "great wealth and honour", never "grave danger ahead".
- Never "will", "destined", "certain". This describes tendencies and timing, not verdicts.
- Specific beats elegant. "Strong output — you do badly when managed closely" beats "you are a creative person".

## Output format

Two to four sections. Each one:

\`\`\`
### Section heading
Body (one or two paragraphs)
依据：finding.id, finding.id
\`\`\`

No preamble, no closing summary, no restating the question. Begin at the first section.`;

export const systemPrompt = (locale: Locale): string =>
  locale === 'en' ? SYSTEM_EN : SYSTEM_ZH;

/** Kept as a named export for the test suite. */
export const SYSTEM_PROMPT = SYSTEM_ZH;

/** One finding, rendered for the model. */
function renderFinding(f: Finding, isLead: boolean, locale: Locale): string {
  const zh = locale === 'zh';
  const confidence = zh
    ? f.confidence === 'high' ? '确定' : f.confidence === 'medium' ? '中等' : '存疑'
    : f.confidence;
  const lead = isLead ? (zh ? ' ★重点' : ' ★KEY') : '';
  return [
    `[${f.id}]${lead} (${zh ? '可信度' : 'confidence'}: ${confidence})`,
    `${zh ? '结论' : 'Finding'}: ${f.claim[locale]}`,
    ...f.evidence.map((e) => `  · ${e[locale]}`),
  ].join('\n');
}

/**
 * The chart-specific half of the prompt.
 *
 * Note what is NOT here: the birth date. The model gets the computed pillars
 * and nothing it could be tempted to re-derive them from.
 */
export function buildUserPrompt(
  analysis: Analysis,
  template: Template,
  locale: Locale = 'zh',
): string {
  const { chart, strength, yongShen, structureLens } = analysis;
  const zh = locale === 'zh';
  const topicFindings = analysis.findings.filter((f) => f.topic === template.topic);

  const leadSet = new Set(template.leadWith);
  const ordered = [
    ...template.leadWith
      .map((id) => topicFindings.find((f) => f.id === id))
      .filter((f): f is Finding => !!f),
    ...topicFindings.filter((f) => !leadSet.has(f.id)),
  ];

  const pillarRows = ([
    ['年柱', chart.pillars.year],
    ['月柱', chart.pillars.month],
    ['日柱', chart.pillars.day],
    ['时柱', chart.pillars.hour],
  ] as const).map(([label, p]) => {
    const name = zh ? label : TERM[label]!.en;
    if (!p) return `${name}: ${zh ? '未知（出生时辰不详）' : 'unknown (birth hour not supplied)'}`;
    const god = p.tenGod
      ? (zh ? p.tenGod : TEN_GOD[p.tenGod]!.en)
      : (zh ? '日主' : 'Day Master');
    const hidden = p.hiddenStems
      .map((h) => (zh ? `${h.stem}(${h.tenGod})` : `${h.stem} (${TEN_GOD[h.tenGod]!.en})`))
      .join(' ');
    return `${name} ${p.ganZhi}　${god}　${zh ? '藏干' : 'hidden'} ${hidden}`;
  });

  const elementLine = Object.entries(strength.elementPercent)
    .map(([e, p]) => (zh ? `${e}${p}%` : `${ELEMENT[e]!.en} ${p}%`))
    .join(zh ? '　' : ', ');

  const strengthWord = zh
    ? strength.verdict
    : strength.verdict === '身强' ? 'strong' : strength.verdict === '身弱' ? 'weak' : 'balanced';

  const header = zh
    ? `## 命盘

${pillarRows.join('\n')}

日主 ${chart.dayMaster}（${chart.dayMasterYinYang}${chart.dayMasterElement}）　性别 ${chart.gender === 'male' ? '男' : '女'}
五行占比 ${elementLine}
旺衰 ${strengthWord}（生扶 ${strength.supportPercent}%）
用神 ${yongShen.primary}${yongShen.secondary ? `　喜神 ${yongShen.secondary}` : ''}　忌神 ${yongShen.unfavourable[0] ?? ''}${yongShen.unfavourable[1] ? `　仇神 ${yongShen.unfavourable[1]}` : ''}${yongShen.neutral.length ? `　闲神 ${yongShen.neutral.join('、')}` : ''}
取用流派 ${yongShen.school.zh}
格局法参照 ${structureLens.structure}（${structureLens.method}）喜 ${structureLens.wants.join('、')}，忌 ${structureLens.fears.join('、')}；${structureLens.agreement === 'agree' ? '与扶抑一致' : structureLens.agreement === 'partial' ? '与扶抑部分一致' : '与扶抑不同（流派之别，以扶抑为准）'}
${chart.hourKnown ? '' : '\n⚠️ 出生时辰不详，凡涉及时柱的判断已从下列结论中剔除，不可提及时柱、子女宫或晚年运。\n'}`
    : `## The chart

${pillarRows.join('\n')}

Day Master ${chart.dayMaster} (${chart.dayMasterYinYang === '阳' ? 'Yang' : 'Yin'} ${ELEMENT[chart.dayMasterElement]!.en})　Gender ${chart.gender}
Element balance ${elementLine}
Day Master strength: ${strengthWord} (support ${strength.supportPercent}%)
Favourable element ${ELEMENT[yongShen.primary]!.en}${yongShen.secondary ? `, supported by ${ELEMENT[yongShen.secondary]!.en}` : ''}. Unfavourable: ${yongShen.unfavourable.map((e) => ELEMENT[e]!.en).join(', ')}
Method used: ${yongShen.school.en}
Structure method, for reference: ${structureLens.structureEn} (${structureLens.method}) wants ${structureLens.wants.map((e) => ELEMENT[e]!.en).join(', ')}, fears ${structureLens.fears.map((e) => ELEMENT[e]!.en).join(', ')}; ${structureLens.agreement === 'agree' ? 'agrees with the strength method' : structureLens.agreement === 'partial' ? 'partly agrees with the strength method' : 'differs from the strength method (a difference of school; the strength reading governs)'}
${chart.hourKnown ? '' : '\n⚠️ The birth hour is unknown. Everything depending on the hour pillar has already been removed from the findings below — do not mention the hour pillar, the children palace, or late-life fortune.\n'}`;

  const findingsHeader = zh
    ? `## 已算出的结论

标有 ★重点 的，是这个问题最该谈的。其余作为背景，用得上就用。`
    : `## The findings

Those marked ★KEY are what this question is most about. The rest is background — use it where it helps.`;

  const questionBlock = zh
    ? `## 这次要回答的问题

「${template.question.zh}」

${template.focus.zh}

篇幅约 ${template.targetLength} 字。`
    : `## The question to answer

"${template.question.en}"

${template.focus.en}

Aim for roughly ${Math.round(template.targetLength * 0.75)} words. Write in English.`;

  return [
    header,
    findingsHeader,
    ordered.map((f) => renderFinding(f, leadSet.has(f.id), locale)).join('\n\n'),
    questionBlock,
  ].join('\n');
}

export interface GroundingReport {
  /** Finding ids the narrator cited. */
  readonly cited: readonly string[];
  /** Cited ids that do not exist — the narrator invented a citation. */
  readonly invalid: readonly string[];
  /** ★ findings that were available but never cited. */
  readonly uncitedLeads: readonly string[];
  /** Sections that carried no 依据 line at all. */
  readonly uncitedSections: number;
  readonly ok: boolean;
}

/**
 * Verify that the prose actually rests on the findings it was given.
 *
 * This is what makes "every claim is traceable" a property rather than a
 * marketing line. It cannot catch a well-cited paragraph that still says
 * something the finding does not support — but it does catch invented
 * citations, which is the failure that matters most.
 *
 * The 依据 marker is used in both languages deliberately: one parser, one
 * format, and nothing to go wrong when a model mixes languages mid-answer.
 */
export function checkGrounding(
  text: string,
  analysis: Analysis,
  template: Template,
): GroundingReport {
  const valid = new Set(analysis.findings.map((f) => f.id));

  const cited = new Set<string>();
  for (const line of text.split('\n')) {
    const m = /^\s*(?:依据|Basis|Sources?)[:：]\s*(.+)$/i.exec(line);
    if (!m) continue;
    for (const raw of m[1]!.split(/[,，、\s]+/)) {
      const id = raw.trim().replace(/[。.]$/, '');
      if (id) cited.add(id);
    }
  }

  const sections = (text.match(/^###\s/gm) ?? []).length;
  const citationLines = (text.match(/^\s*(?:依据|Basis|Sources?)[:：]/gim) ?? []).length;

  const invalid = [...cited].filter((id) => !valid.has(id));
  const available = new Set(
    analysis.findings.filter((f) => f.topic === template.topic).map((f) => f.id),
  );
  const uncitedLeads = template.leadWith.filter(
    (id) => available.has(id) && !cited.has(id),
  );

  return {
    cited: [...cited],
    invalid,
    uncitedLeads,
    uncitedSections: Math.max(0, sections - citationLines),
    ok: invalid.length === 0 && cited.size > 0,
  };
}
