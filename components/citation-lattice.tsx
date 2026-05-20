"use client";

import { useId } from "react";

/**
 * Ambient background for /auth/signin.
 * A sparse "knowledge graph": [n] citation glyphs slowly drifting,
 * with thin indigo lines briefly connecting nearby pairs.
 *
 * Two layers:
 *   1. HTML <span> glyphs absolutely positioned in % so text never distorts
 *   2. A stretched SVG with non-scaling-stroke lines between the same coords
 */
export function CitationLattice() {
  const uid = useId();

  // Deterministic positions so it never looks random / flickers on refresh.
  const nodes: { x: number; y: number; n: number; delay: number; dur: number; drift: number }[] = [
    { x: 7,  y: 16, n: 1,  delay: 0,   dur: 14, drift: 14 },
    { x: 22, y: 70, n: 2,  delay: 1.4, dur: 17, drift: 18 },
    { x: 34, y: 28, n: 3,  delay: 0.6, dur: 13, drift: 12 },
    { x: 16, y: 86, n: 4,  delay: 2.0, dur: 19, drift: 16 },
    { x: 47, y: 11, n: 5,  delay: 1.0, dur: 16, drift: 14 },
    { x: 62, y: 60, n: 6,  delay: 0.3, dur: 15, drift: 20 },
    { x: 78, y: 22, n: 7,  delay: 1.8, dur: 18, drift: 14 },
    { x: 86, y: 78, n: 8,  delay: 0.9, dur: 14, drift: 18 },
    { x: 92, y: 46, n: 9,  delay: 2.4, dur: 20, drift: 12 },
    { x: 54, y: 90, n: 10, delay: 1.2, dur: 16, drift: 16 },
    { x: 72, y: 8,  n: 11, delay: 2.6, dur: 17, drift: 14 },
    { x: 4,  y: 48, n: 12, delay: 0.5, dur: 18, drift: 20 },
  ];

  const edges: { a: number; b: number; delay: number; dur: number }[] = [
    { a: 0,  b: 2,  delay: 0.4, dur: 7 },
    { a: 2,  b: 4,  delay: 2.0, dur: 8 },
    { a: 4,  b: 6,  delay: 3.6, dur: 9 },
    { a: 5,  b: 8,  delay: 1.2, dur: 7 },
    { a: 7,  b: 8,  delay: 4.4, dur: 8 },
    { a: 9,  b: 5,  delay: 2.8, dur: 9 },
    { a: 11, b: 1,  delay: 5.2, dur: 7 },
    { a: 3,  b: 1,  delay: 0.8, dur: 8 },
    { a: 6,  b: 9,  delay: 6.0, dur: 8 },
    { a: 10, b: 7,  delay: 3.0, dur: 9 },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="citation-lattice"
    >
      {/* Edges — stretched SVG */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
            <stop offset="50%" stopColor="#818CF8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {edges.map((e, i) => {
          const a = nodes[e.a];
          const b = nodes[e.b];
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={`url(#${uid}-edge)`}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="lattice-edge"
              style={{
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.dur}s`,
              }}
            />
          );
        })}
      </svg>

      {/* Nodes — HTML glyphs, never distort */}
      {nodes.map((p, i) => (
        <span
          key={i}
          className="lattice-glyph absolute font-mono text-zinc-500 select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: 12,
            transform: "translate(-50%, -50%)",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            // @ts-ignore custom prop for drift amplitude
            "--drift": `${p.drift}px`,
          }}
        >
          [{p.n}]
        </span>
      ))}
    </div>
  );
}
