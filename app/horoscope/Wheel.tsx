/**
 * The chart wheel: zodiac ring, whole-sign houses, planet glyphs, aspect lines.
 *
 * Signs are coloured by element with the 五行 palette the rest of the app
 * already uses (fire, earth, water; air borrows metal), so the eye reads the
 * same hue as the same idea across pages. Aspects: hard ones in fire, soft
 * ones in water, conjunctions in gold — the three things a reader wants to
 * tell apart at a glance.
 */

import type { SVGProps } from 'react';
import { SIGN_GLYPHS } from '../../src/astro/natal';
import { point, screenAngle, spreadAngles } from '../../src/astro/wheel';

export interface WheelPlanet { key: string; glyph: string; lon: number; retrograde: boolean }
export interface WheelAspect { a: string; b: string; kind: string }

interface Props {
  planets: WheelPlanet[];
  ascendant: number | null;
  midheaven: number | null;
  aspects: WheelAspect[];
}

const C = 180;
const R_OUT = 168, R_SIGN = 142, R_HOUSE = 118, R_PLANET = 100, R_ASPECT = 84;
const ELEMENT = ['var(--fire)', 'var(--earth)', 'var(--metal)', 'var(--water)'];
const ASPECT_STYLE: Record<string, { stroke: string; width: number; dash?: string }> = {
  conjunction: { stroke: 'var(--gold)', width: 1.4 },
  opposition: { stroke: 'var(--fire)', width: 1.2 },
  square: { stroke: 'var(--fire)', width: 1.2 },
  trine: { stroke: 'var(--water)', width: 1.2 },
  sextile: { stroke: 'var(--water)', width: 0.8, dash: '3 3' },
};

const P = (r: number, a: number) => point(C, C, r, a);
const line = (r1: number, r2: number, a: number, extra: SVGProps<SVGLineElement> = {}, key?: string) => {
  const [x1, y1] = P(r1, a); const [x2, y2] = P(r2, a);
  return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line)" strokeWidth={1} {...extra} />;
};

export default function Wheel({ planets, ascendant, midheaven, aspects }: Props) {
  const timeKnown = ascendant !== null;
  const base = timeKnown ? Math.floor(ascendant / 30) * 30 : 0;
  const ang = (lon: number) => screenAngle(lon, base);

  const trueAngles = planets.map((p) => ang(p.lon));
  const glyphAngles = spreadAngles(trueAngles, 11);
  const byKey = new Map(planets.map((p, i) => [p.key, trueAngles[i]!]));

  return (
    <svg className="wheel" viewBox="0 0 360 360" role="img" aria-hidden="true">
      {/* rings */}
      <circle cx={C} cy={C} r={R_OUT} fill="var(--surface-2)" stroke="var(--line)" />
      <circle cx={C} cy={C} r={R_SIGN} fill="var(--surface)" stroke="var(--line)" />
      {timeKnown && <circle cx={C} cy={C} r={R_HOUSE} fill="none" stroke="var(--line-soft)" />}
      <circle cx={C} cy={C} r={R_ASPECT} fill="var(--ink)" stroke="var(--line-soft)" />

      {/* angles */}
      {timeKnown && midheaven !== null && (
        <g fontSize={8} fill="var(--text-dim)" letterSpacing="0.06em">
          {line(R_ASPECT, R_OUT, ang(ascendant), { stroke: 'var(--gold)', strokeWidth: 1.4 })}
          {line(R_ASPECT, R_OUT, ang(midheaven), { stroke: 'var(--gold-dim)', strokeWidth: 1.2 })}
          <text {...xy(P(R_OUT + 8, ang(ascendant)))} textAnchor="middle" dominantBaseline="central">ASC</text>
          <text {...xy(P(R_OUT + 8, ang(midheaven)))} textAnchor="middle" dominantBaseline="central">MC</text>
        </g>
      )}

      {/* sign divisions + glyphs; whole-sign house numbers share the same cusps */}
      {SIGN_GLYPHS.map((g, s) => {
        const a0 = ang(s * 30);
        const [gx, gy] = P((R_OUT + R_SIGN) / 2, a0 + 15);
        const house = timeKnown ? ((s - base / 30 + 12) % 12) + 1 : null;
        const [hx, hy] = P((R_SIGN + R_HOUSE) / 2, a0 + 15);
        return (
          <g key={s}>
            {line(R_SIGN, R_OUT, a0)}
            {timeKnown && line(R_HOUSE, R_SIGN, a0, { stroke: 'var(--line-soft)' })}
            <text x={gx} y={gy} fontSize={13} textAnchor="middle" dominantBaseline="central" fill={ELEMENT[s % 4]}>{g}</text>
            {house !== null && (
              <text x={hx} y={hy} fontSize={9} textAnchor="middle" dominantBaseline="central" fill="var(--text-faint)">{house}</text>
            )}
          </g>
        );
      })}

      {/* aspects */}
      {aspects.map((asp, i) => {
        const a = byKey.get(asp.a); const b = byKey.get(asp.b);
        const st = ASPECT_STYLE[asp.kind];
        if (a === undefined || b === undefined || !st) return null;
        const [x1, y1] = P(R_ASPECT, a); const [x2, y2] = P(R_ASPECT, b);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} opacity={0.85} />;
      })}

      {/* planets: tick at the true degree, glyph nudged clear of its neighbours */}
      {planets.map((p, i) => {
        const [gx, gy] = P(R_PLANET, glyphAngles[i]!);
        return (
          <g key={p.key}>
            {line(R_ASPECT, R_ASPECT + 5, trueAngles[i]!, { stroke: 'var(--text-dim)' })}
            <text x={gx} y={gy} fontSize={14} textAnchor="middle" dominantBaseline="central" fill="var(--text)">{p.glyph}</text>
            {p.retrograde && <text x={gx + 8} y={gy - 6} fontSize={7} fill="var(--text-faint)">R</text>}
          </g>
        );
      })}
    </svg>
  );
}

const xy = ([x, y]: [number, number]) => ({ x, y });
