import React from 'react';
import type { ScorePoint } from '@/lib/speaking-stats';

const W = 320;
const H = 96;
const PAD = 6;

/** Speaking scores (0-100) as a gray line with dots, oldest on the left. */
export function ScoreChart({ points, label }: { points: ScorePoint[]; label: string }) {
  if (points.length === 0) return null;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (s: number) => PAD + ((100 - Math.max(0, Math.min(100, s))) * (H - 2 * PAD)) / 100;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={`${label}: from ${first.score} to ${last.score}`}>
        <line x1={0} x2={W} y1={y(50)} y2={y(50)} className="stroke-gray-800" strokeDasharray="3 4" />
        <path d={line} fill="none" className="stroke-gray-400" strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.score)} r={2.5} className="fill-gray-100">
            <title>{`${p.label}: ${p.score}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="flex justify-between text-xs text-gray-500 tabular-nums">
        <span>{first.label}</span>
        <span>
          {label}: {last.score}
        </span>
      </figcaption>
    </figure>
  );
}
