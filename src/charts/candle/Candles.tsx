import React from 'react';
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Path, Svg, SvgProps } from 'react-native-svg';

import { CandlestickChartDimensionsContext } from './Chart';
import { useCandlestickChart } from './useCandlestickChart';
import { getY } from './utils';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Every candle's wick ends and body edges in pixels, and whether it closed up.
 * Positions along x come from the candle's index, so only y morphs.
 */
type Shape = {
  high: number[];
  low: number[];
  top: number[];
  bottom: number[];
  up: boolean[];
};

type CandlestickChartCandlesProps = SvgProps & {
  width?: number;
  height?: number;
  /** Space between a candle's body and its slot's edge, in pixels. */
  margin?: number;
  positiveColor?: string;
  negativeColor?: string;
  useAnimations?: boolean;
};

/**
 * Draws all candles as two paths, one per color. A data change morphs every
 * candle on the UI thread from what is on screen; when the candle count
 * changes, the old candles are resampled to the new count by position first.
 */
export function CandlestickChartCandles({
  positiveColor = '#10b981',
  negativeColor = '#ef4444',
  margin = 2,
  useAnimations = true,
  ...props
}: CandlestickChartCandlesProps) {
  const { width, height } = React.useContext(CandlestickChartDimensionsContext);
  const { data, domain } = useCandlestickChart();

  const shape = React.useMemo<Shape>(() => {
    const next: Shape = { high: [], low: [], top: [], bottom: [], up: [] };
    for (const { open, high, low, close } of data) {
      next.high.push(getY({ maxHeight: height, value: high, domain }));
      next.low.push(getY({ maxHeight: height, value: low, domain }));
      next.top.push(getY({ maxHeight: height, value: Math.max(open, close), domain }));
      next.bottom.push(getY({ maxHeight: height, value: Math.min(open, close), domain }));
      next.up.push(close > open);
    }
    return next;
  }, [data, domain, height]);

  // JS only writes `pending`; the reaction owns `from`, `to` and `progress`,
  // so a frame never draws the new candles before the morph starts. They
  // start at the first render's candles, so the first frame draws them.
  const pending = useSharedValue<Shape>(shape);
  const from = useSharedValue<Shape>(shape);
  const to = useSharedValue<Shape>(shape);
  const progress = useSharedValue(1);

  React.useEffect(() => {
    pending.value = shape;
  }, [pending, shape]);

  useAnimatedReaction(
    () => pending.value,
    (next) => {
      if (next === to.value) {
        return;
      }
      const drawn = lerpShape(from.value, to.value, progress.value);
      if (!useAnimations || drawn.high.length === 0 || next.high.length === 0) {
        from.value = next;
        to.value = next;
        progress.value = 1;
        return;
      }
      from.value = resampleShape(drawn, next.high.length);
      to.value = next;
      progress.value = 0;
      progress.value = withTiming(1);
    }
  );

  const paths = useDerivedValue(() =>
    buildCandles(lerpShape(from.value, to.value, progress.value), width, margin)
  );
  const upProps = useAnimatedProps(() => ({ d: paths.value.up }));
  const downProps = useAnimatedProps(() => ({ d: paths.value.down }));

  return (
    <Svg width={width} height={height} {...props}>
      <AnimatedPath animatedProps={upProps} fill={positiveColor} />
      <AnimatedPath animatedProps={downProps} fill={negativeColor} />
    </Svg>
  );
}

/**
 * Each candle is a 1 pt wick rectangle and a body rectangle, both wound the
 * same way so they fill as one shape. The color comes from the target candle,
 * so a candle never jumps between paths mid-morph. Each slot's width comes
 * from the drawn candle count, not the data, so a new count never squeezes
 * the old candles for a frame before the morph starts.
 */
function buildCandles(shape: Shape, width: number, margin: number) {
  'worklet';
  const step = width / shape.high.length;
  const bodyWidth = step - margin * 2;
  let up = '';
  let down = '';
  for (let i = 0; i < shape.high.length; i++) {
    const center = i * step + step / 2;
    let candle = `M${center - 0.5} ${shape.high[i]}H${center + 0.5}V${shape.low[i]}H${center - 0.5}Z`;
    if (bodyWidth > 0) {
      const left = i * step + margin;
      candle += `M${left} ${shape.top[i]}H${left + bodyWidth}V${shape.bottom[i]}H${left}Z`;
    }
    if (shape.up[i]) {
      up += candle;
    } else {
      down += candle;
    }
  }
  return { up, down };
}

function lerpShape(from: Shape, to: Shape, progress: number): Shape {
  'worklet';
  if (progress >= 1 || from.high.length !== to.high.length) {
    return to;
  }
  const lerp = (a: number[], b: number[]) => a.map((value, i) => value + (b[i]! - value) * progress);
  return {
    high: lerp(from.high, to.high),
    low: lerp(from.low, to.low),
    top: lerp(from.top, to.top),
    bottom: lerp(from.bottom, to.bottom),
    up: to.up,
  };
}

/**
 * Stretches `shape` to `count` candles, reading each new candle at the same
 * fraction of the chart. Colors are left out: a morph takes them from its target.
 */
function resampleShape(shape: Shape, count: number): Shape {
  'worklet';
  const last = shape.high.length - 1;
  const read = (values: number[], position: number) => {
    const below = Math.floor(position);
    const above = Math.min(below + 1, last);
    return values[below]! + (values[above]! - values[below]!) * (position - below);
  };
  const next: Shape = { high: [], low: [], top: [], bottom: [], up: [] };
  for (let i = 0; i < count; i++) {
    const position = count === 1 ? 0 : (i / (count - 1)) * last;
    next.high.push(read(shape.high, position));
    next.low.push(read(shape.low, position));
    next.top.push(read(shape.top, position));
    next.bottom.push(read(shape.bottom, position));
  }
  return next;
}
