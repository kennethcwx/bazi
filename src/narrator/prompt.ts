/**
 * Prompt construction for L3.
 *
 * The narrator's whole job is to turn computed findings into prose a person
 * can use. It computes nothing. That constraint is enforced three ways: the
 * chart arrives as finished values rather than a birth date, the system prompt
 * forbids asserting anything outside the findings, and every section must cite
 * the finding ids it rests on — which `checkGrounding` then verifies.
 *
 * The system prompt is deliberately frozen and chart-independent so it caches;
 * everything that varies per chart goes in the user message, after the
 * cache breakpoint.
 */

import type { Finding } from '../analyzer/findings';
import type { Analysis } from '../analyzer/index';
import type { Template } from './templates';

/** Bump when the system prompt or output contract changes. Part of the cache
 *  key, so old readings are not served against new rules. */
export const PROMPT_VERSION = 'v1';

export const SYSTEM_PROMPT = `你是一位八字命理顾问，为普通人解读已经排好、并已由程序完成分析的命盘。

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

/** One finding, rendered for the model. */
function renderFinding(f: Finding, isLead: boolean): string {
  const confidence =
    f.confidence === 'high' ? '确定' : f.confidence === 'medium' ? '中等' : '存疑';
  return [
    `[${f.id}]${isLead ? ' ★重点' : ''} （可信度：${confidence}）`,
    `结论：${f.claim}`,
    ...f.evidence.map((e) => `  · ${e}`),
  ].join('\n');
}

/**
 * The chart-specific half of the prompt.
 *
 * Note what is NOT here: the birth date. The model gets the computed pillars
 * and nothing it could be tempted to re-derive them from.
 */
export function buildUserPrompt(analysis: Analysis, template: Template): string {
  const { chart, strength, yongShen } = analysis;
  const topicFindings = analysis.findings.filter((f) => f.topic === template.topic);

  const leadSet = new Set(template.leadWith);
  const ordered = [
    ...template.leadWith
      .map((id) => topicFindings.find((f) => f.id === id))
      .filter((f): f is Finding => !!f),
    ...topicFindings.filter((f) => !leadSet.has(f.id)),
  ];

  const pillars = [
    ['年柱', chart.pillars.year],
    ['月柱', chart.pillars.month],
    ['日柱', chart.pillars.day],
    ['时柱', chart.pillars.hour],
  ] as const;

  return `## 命盘

${pillars.map(([label, p]) =>
  p
    ? `${label} ${p.ganZhi}　${p.tenGod ?? '日主'}　藏干 ${p.hiddenStems.map((h) => `${h.stem}(${h.tenGod})`).join(' ')}`
    : `${label} 未知（出生时辰不详）`,
).join('\n')}

日主 ${chart.dayMaster}（${chart.dayMasterYinYang}${chart.dayMasterElement}）　性别 ${chart.gender === 'male' ? '男' : '女'}
五行占比 ${Object.entries(strength.elementPercent).map(([e, p]) => `${e}${p}%`).join('　')}
旺衰 ${strength.verdict}（生扶 ${strength.supportPercent}%）
用神 ${yongShen.primary}${yongShen.secondary ? `　喜神 ${yongShen.secondary}` : ''}　忌神 ${yongShen.unfavourable.join('、')}
取用流派 ${yongShen.school}
${chart.hourKnown ? '' : '\n⚠️ 出生时辰不详，凡涉及时柱的判断已从下列结论中剔除，不可提及时柱、子女宫或晚年运。\n'}
## 已算出的结论

标有 ★重点 的，是这个问题最该谈的。其余作为背景，用得上就用。

${ordered.map((f) => renderFinding(f, leadSet.has(f.id))).join('\n\n')}

## 这次要回答的问题

「${template.question}」

${template.focus}

篇幅约 ${template.targetLength} 字。`;
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
 */
export function checkGrounding(
  text: string,
  analysis: Analysis,
  template: Template,
): GroundingReport {
  const valid = new Set(analysis.findings.map((f) => f.id));

  const cited = new Set<string>();
  for (const line of text.split('\n')) {
    const m = /^\s*依据[:：]\s*(.+)$/.exec(line);
    if (!m) continue;
    for (const raw of m[1]!.split(/[,，、\s]+/)) {
      const id = raw.trim().replace(/[。.]$/, '');
      if (id) cited.add(id);
    }
  }

  const sections = (text.match(/^###\s/gm) ?? []).length;
  const citationLines = (text.match(/^\s*依据[:：]/gm) ?? []).length;

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
