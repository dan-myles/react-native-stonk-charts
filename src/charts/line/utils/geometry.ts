// @ts-ignore
import * as d3Shape from 'd3-shape';
// @ts-ignore
import { scaleLinear } from 'd3-scale';

import type { TLineChartData, YDomain } from '../types';

/** A series in pixels: one X and one Y per vertex, X ascending. */
export type Vertices = { xs: number[]; ys: number[] };

/** The curves the shared morph draws itself. Any other `shape` keeps the per-path `interpolatePath` morph. */
export type Curve = 'linear' | 'bumpX';

export type Geometry = Vertices & { line: string; area: string };

export const EMPTY_VERTICES: Vertices = { xs: [], ys: [] };

export function getCurve(shape: unknown): Curve | null {
  if (shape === d3Shape.curveBumpX) {
    return 'bumpX';
  }
  if (shape === d3Shape.curveLinear) {
    return 'linear';
  }
  return null;
}

/** The scale `getPath` uses for X: timestamps across `xDomain`, else indices across the data. */
export type XScale = { start: number; end: number; width: number };

export function getXScale(
  data: TLineChartData,
  width: number,
  xDomain?: [number, number]
): XScale {
  if (xDomain) {
    return { start: xDomain[0], end: xDomain[1], width };
  }
  return { start: 0, end: Math.max(data.length - 1, 0), width };
}

/** Each data point's X in pixels, by index, for snapping and indexed decorations. */
export function getPointXs(
  data: TLineChartData,
  scale: XScale,
  xDomain?: [number, number]
): number[] {
  const span = scale.end - scale.start;
  return data.map(({ timestamp }, i) => {
    const t = xDomain ? timestamp : i;
    return span === 0 ? 0 : ((t - scale.start) / span) * scale.width;
  });
}

/** Index of the point nearest `x`; `xs` ascending and non-empty. */
export function nearestIndex(xs: number[], x: number): number {
  'worklet';
  let low = 0;
  let high = xs.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (xs[mid]! < x) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  if (low > 0 && x - xs[low - 1]! <= xs[low]! - x) {
    return low - 1;
  }
  return low;
}

/**
 * Each data point's pixel position, with the same scales as `getPath`, so a
 * partial day keeps its true start and end X.
 *
 * A series denser than one point per pixel is decimated with M4: per 1 pt
 * bucket it keeps the first, lowest, highest, and last point. Every extreme
 * stays an exact vertex, so a one-minute spike keeps its full height.
 */
export function getVertices({
  data,
  width,
  height,
  gutter,
  yDomain,
  xDomain,
}: {
  data: TLineChartData;
  width: number;
  height: number;
  gutter: number;
  yDomain: YDomain;
  xDomain?: [number, number];
}): Vertices {
  const timestamps = data.map(({ timestamp }, i) => (xDomain ? timestamp : i));
  const scaleX = scaleLinear()
    .domain(xDomain ?? [Math.min(...timestamps), Math.max(...timestamps)])
    .range([0, width]);
  const scaleY = scaleLinear()
    .domain([yDomain.min, yDomain.max])
    .range([height - gutter, gutter]);

  const xs: number[] = [];
  const ys: number[] = [];
  let bucket = NaN;
  let first = 0;
  let low = 0;
  let high = 0;
  let last = 0;
  const pointX = (i: number): number => scaleX(timestamps[i]!);
  const pointY = (i: number): number => scaleY(data[i]!.value);
  const flush = () => {
    const kept = [first, low, high, last]
      .sort((a, b) => a - b)
      .filter((index, i, all) => i === 0 || index !== all[i - 1]);
    for (const index of kept) {
      xs.push(round(pointX(index)));
      ys.push(round(pointY(index)));
    }
  };

  for (let i = 0; i < data.length; i++) {
    const column = Math.floor(pointX(i));
    if (column !== bucket) {
      if (i > 0) {
        flush();
      }
      bucket = column;
      first = i;
      low = i;
      high = i;
    }
    if (data[i]!.value < data[low]!.value) {
      low = i;
    }
    if (data[i]!.value > data[high]!.value) {
      high = i;
    }
    last = i;
  }
  if (data.length > 0) {
    flush();
  }

  return { xs, ys };
}

/** Two decimals keep the strings short for the native path parser; 0.01 pt is invisible. */
function round(value: number): number {
  'worklet';
  return Math.round(value * 100) / 100;
}

/** The same commands d3 emits for `curveLinear` and `curveBumpX`. */
export function buildLine(xs: number[], ys: number[], curve: Curve): string {
  'worklet';
  if (xs.length === 0) {
    return '';
  }
  if (xs.length === 1) {
    return `M${xs[0]},${ys[0]}Z`;
  }

  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    if (curve === 'bumpX') {
      const mid = (xs[i - 1]! + xs[i]!) / 2;
      d += `C${mid},${ys[i - 1]},${mid},${ys[i]},${xs[i]},${ys[i]}`;
      continue;
    }
    d += `L${xs[i]},${ys[i]}`;
  }
  return d;
}

/** The line closed down to `bottom` at its own first and last X, so a partial day's fill stops where the series stops. */
export function buildArea(
  line: string,
  xs: number[],
  ys: number[],
  bottom: number
): string {
  'worklet';
  if (xs.length === 0) {
    return '';
  }
  if (xs.length === 1) {
    return `M${xs[0]},${ys[0]}L${xs[0]},${bottom}Z`;
  }
  return `${line}L${xs[xs.length - 1]},${bottom}L${xs[0]},${bottom}Z`;
}

/** Index of the last vertex at or left of `x`, clamped to the segments. */
function segmentAt(xs: number[], x: number): number {
  'worklet';
  let low = 0;
  let high = xs.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (xs[mid]! <= x) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * Y on the drawn curve at `x`, clamped to the series' ends.
 *
 * A bumpX segment is a cubic with both control points at the mid X, so its
 * X runs `s = t³ − 1.5t² + 1.5t` across the segment and its Y eases with
 * `3t² − 2t³`. With `t = u + ½` the X cubic becomes `u³ + 0.75u + (½ − s)`,
 * which has one real root (Cardano).
 */
export function yForX(xs: number[], ys: number[], x: number, curve: Curve): number {
  'worklet';
  if (xs.length === 0) {
    return -1;
  }
  if (xs.length === 1 || x <= xs[0]!) {
    return ys[0]!;
  }
  if (x >= xs[xs.length - 1]!) {
    return ys[ys.length - 1]!;
  }

  const i = segmentAt(xs, x);
  const x0 = xs[i]!;
  const x1 = xs[i + 1]!;
  const y0 = ys[i]!;
  const y1 = ys[i + 1]!;
  const s = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
  if (curve === 'linear') {
    return y0 + (y1 - y0) * s;
  }

  const q = 0.5 - s;
  const root = Math.sqrt((q * q) / 4 + 0.75 ** 3 / 27);
  const t = Math.cbrt(-q / 2 + root) + Math.cbrt(-q / 2 - root) + 0.5;
  return y0 + (y1 - y0) * (3 * t * t - 2 * t * t * t);
}

/**
 * `shape` redrawn with `target`'s vertex count: each target vertex takes the
 * point at the same fraction of `shape`'s own X span. The morph starts from
 * this, so a range switch, a live tick, or a resize keeps both ends anchored.
 */
export function resample(shape: Vertices, target: Vertices, curve: Curve): Vertices {
  'worklet';
  const start = shape.xs[0]!;
  const span = shape.xs[shape.xs.length - 1]! - start;
  const targetStart = target.xs[0]!;
  const targetSpan = target.xs[target.xs.length - 1]! - targetStart;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < target.xs.length; i++) {
    const fraction = targetSpan === 0 ? 0 : (target.xs[i]! - targetStart) / targetSpan;
    const x = start + fraction * span;
    xs.push(x);
    ys.push(yForX(shape.xs, shape.ys, x, curve));
  }
  return { xs, ys };
}

export function lerpVertices(from: Vertices, to: Vertices, progress: number): Vertices {
  'worklet';
  if (progress >= 1 || from.xs.length !== to.xs.length) {
    return to;
  }
  if (progress <= 0) {
    return from;
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < to.xs.length; i++) {
    xs.push(round(from.xs[i]! + (to.xs[i]! - from.xs[i]!) * progress));
    ys.push(round(from.ys[i]! + (to.ys[i]! - from.ys[i]!) * progress));
  }
  return { xs, ys };
}

export function sameVertices(a: Vertices, b: Vertices): boolean {
  'worklet';
  if (a.xs.length !== b.xs.length) {
    return false;
  }
  for (let i = 0; i < a.xs.length; i++) {
    if (a.xs[i] !== b.xs[i] || a.ys[i] !== b.ys[i]) {
      return false;
    }
  }
  return true;
}
