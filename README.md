# 八字排盘 · BaZi Chart

A BaZi (Chinese Four Pillars) app. The aim is 问真八字's chart accuracy with
灵机八字's readability, scoped to two subjects: relationships (姻缘) and career
(事业).

Bilingual 中文 / English. Works with no API key.

## Why it is built this way

Three layers, kept strictly apart:

| | | |
|---|---|---|
| **L1 engine** | `src/engine/` | birth input → chart. Deterministic, wraps `tyme4ts`. |
| **L2 analyzer** | `src/analyzer/` | chart → findings. Deterministic rules, pure functions. |
| **L3 narrator** | `src/narrator/` | findings → prose. Never computes. |

An LLM never computes anything. Ask one for 四柱 and it will get them wrong with
total confidence, because the month pillar turns on 节气 and the year turns on
立春, not on any date a model has memorised. And if a model decides 日主强弱 or
用神, two runs on the same chart contradict each other.

So L2 does every judgement and hands L3 finished claims. Each section of a
reading must cite the finding ids it rests on, and `checkGrounding` verifies
those ids exist. A reading with an invented citation is never cached.

That split has a payoff beyond correctness: the model is doing the least
demanding job in the system, so a free one costs fluency rather than accuracy.

## Running it

```bash
npm run dev          # Next.js
npm run check        # typecheck + 196 tests
npm run chart -- 1990-06-15 14:30 male --lon 103.82            # print a chart
npm run read  -- 1990-06-15 14:30 male --lon 103.82 --lang en  # full analysis
```

Set `APP_PIN` and `AUTH_SECRET` to use the PIN gate. Readings need no key at
all: with none set, `src/narrator/compose.ts` writes them from the findings in
code. Adding any of `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` or `GROQ_API_KEY`
switches to that model instead.

## Things that are easy to get wrong, and are handled

- **Singapore ran on UTC+07:30 until 1981-12-31**, moving to +08:00 on
  1982-01-01. Malaysia changed the same day. A fixed +08:00 puts much of the
  parent generation half an hour out, enough to move the hour pillar a whole
  时辰.
- **Offsets can carry seconds.** Pre-1901 Singapore is `GMT+06:55:25`. An
  `HH:MM` parser crashes on those births, so offsets are tracked in seconds.
- **真太阳时 for Singapore is about −65 minutes** (103.8°E against a 120°E zone),
  and about −35 minutes pre-1982. Japan, sitting on the 135°E meridian its clock
  is built from, comes out at +7. Derived from the real offset, never a
  hardcoded meridian.
- **Chinese cities are all on Beijing time**, Ürümqi and Lhasa included, because
  civil records there are written that way. The longitude carries the ~−130
  minute correction instead.
- **China observed DST 1986–1991.**
- **年柱 turns at 立春**, not at lunar new year; 月柱 follows 节气.
- **晚子时**: births from 23:00 advance the day pillar.
- **Unknown birth time** yields three pillars and a null hour pillar. Every
  hour-dependent finding is suppressed rather than quietly weakened, and no
  true-solar correction is applied to a guessed hour.

## The 用神 question

扶抑, 调候, 通关 and the 新派 格局 school disagree with each other. This commits to
**扶抑 primary with 调候 as a modifier**, names that school in the UI, shows the
旺衰 score, and reports it when the two methods point at different elements. A
user's own 师傅 may say otherwise; that should read as a difference of method
rather than a bug.

## What it refuses to do

- **No single compatibility score.** 合婚 reports both supply directions
  separately, because one person can be fed by the other's chart while giving
  little back, and that asymmetry is the most useful thing the reading has.
- **No dressed-up day forecasts.** 流日 is the lightest layer in the system, so
  the short-range outlook is computed rather than narrated, grades days
  notable/mild/quiet rather than good/bad, and leaves most of them quiet.
- **No health, lifespan, legal or investment questions.** Declined outright.

## Testing

`test/engine.test.ts` proves the derivation by sweeping classical invariants
(五虎遁, 五鼠遁, day-cycle continuity, the 立春 turn) across 1900–2100, plus the
edge cases above. Invariant sweeps beat transcribed fixtures: a fixture proves
one chart, a sweep proves the rule, and the sweep is what caught the
sub-minute-offset crash.

Every L2 rule has a fixture and a negative control. `test/bilingual.test.ts`
asserts both languages are genuinely written, that no Chinese prose leaks into
an English reading, and that numbers match across the two. The forecast suite
asserts most days stay quiet, since one that fires daily is measuring nothing.

**Still outstanding:** cross-checking ~30 charts by hand against 问真八字. The
invariant suite proves internal correctness. Only that comparison proves
agreement with the tool practitioners already trust.

## Stack

Next.js 16, TypeScript, [`tyme4ts`](https://github.com/6tail/tyme4ts) for the
calendar. No database. Birth details are remembered in `localStorage` on the
device and never sent anywhere.
