# 八字排盘 · 姻缘与事业

A BaZi (八字) reading app. Product thesis: **问真八字's auditable chart accuracy
with 灵机八字's readability**, scoped to two topics — relationships (姻缘/婚姻)
and career (事业/财运).

## Architecture

Three layers, strictly separated. The separation is the product:

| | | |
|---|---|---|
| **L1 engine** | `src/engine/` | birth input → chart. Deterministic, wraps `tyme4ts`. |
| **L2 analyzer** | `src/analyzer/` | chart → findings. Deterministic rules, pure functions. |
| **L3 narrator** | *not built yet* | findings → prose. An LLM, allowed to assert nothing outside the findings it is handed. |

An LLM never computes. It gets 四柱 wrong reliably, and if it decides 日主强弱
or 用神 then two runs on the same chart contradict each other. Every claim L2
makes carries the chart facts it rests on, so a disagreement lands on a specific
derivation rather than on the app.

## Run it

```bash
npm run dev            # Next.js on :3000
npm test               # 70 tests
npm run chart -- 1990-06-15 14:30 male --lon 103.82   # print a chart
npm run read  -- 1990-06-15 14:30 male --lon 103.82   # print the full analysis
```

## Things that are easy to get wrong, and are handled

- **Singapore ran on UTC+07:30 until 1981-12-31**, moving to +08:00 on
  1982-01-01. Malaysia changed the same day. A naive fixed +08:00 puts a large
  part of the parent generation half an hour out — enough to move the hour
  pillar a whole 时辰.
- **Offsets can carry seconds.** Pre-1901 Singapore is `GMT+06:55:25`. An
  `HH:MM`-only parser crashes on those births. Offsets are tracked in seconds.
- **真太阳时 for Singapore is about −65 minutes**, not a rounding detail
  (103.8°E against a 120°E zone), and about −35 minutes pre-1982. Derived from
  the real offset, never a hardcoded meridian.
- **China observed DST 1986–1991.**
- **年柱 rolls at 立春**, not at lunar new year; 月柱 follows 节气.
- **晚子时** — births 23:00–23:59 advance the day pillar.
- **Unknown birth time** yields three pillars and a null hour pillar. Every
  hour-dependent finding is suppressed rather than quietly weakened, and no
  true-solar correction is applied to a guessed hour.

## The 用神 question

扶抑, 调候, 通关 and the 新派 格局 school genuinely disagree. This app commits to
**扶抑 primary with 调候 as a modifier**, labels that school in the UI, exposes
the 旺衰 score, and reports it when 调候 and 扶抑 point at different elements
rather than silently resolving the conflict. A user's own 师傅 may say otherwise;
that should read as a difference of method, not as a bug.

## Testing

`test/engine.test.ts` proves the derivation by sweeping classical invariants
(五虎遁, 五鼠遁, day-cycle continuity, the 立春 roll) across 1900–2100, plus the
specific edge cases above. Invariant sweeps beat transcribed fixtures: a fixture
proves one chart, a sweep proves the rule — and the sweep is what caught the
sub-minute-offset crash.

`test/analyzer.test.ts` gives every L2 rule a fixture and a negative control.

**Still outstanding:** cross-checking ~30 charts by hand against 问真八字. The
invariant suite proves internal correctness; only that comparison proves
agreement with the tool practitioners actually trust.
