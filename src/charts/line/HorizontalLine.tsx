import Animated, {
  useAnimatedProps,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { LineProps, Line as SVGLine } from 'react-native-svg';

import { LineChartDimensionsContext, LineChartGeometryContext } from './Chart';
import { LineChartPathContext } from './LineChartPathContext';
import React from 'react';
import { pointAt } from './utils/geometry';
import { useLineChart } from './useLineChart';

const AnimatedLine = Animated.createAnimatedComponent(SVGLine);

type HorizontalLineProps = {
  color?: string;
  lineProps?: Partial<LineProps>;
  offsetY?: number;
  /**
   * (Optional) A pixel value to nudge the line up or down.
   *
   * This may be useful to customize the line's position based on the thickness of your cursor or chart path.
   *
   * ```tsx
   * <LineChart.HorizontalLine
   *   at={{ index: 3 }}
   * />
   *
   * // or
   *
   * <LineChart.HorizontalLine
   *   at={{ value: 320.32}}
   * />
   * ```
   */
  at?:
    | {
        index: number;
        value?: never;
      }
    | {
        index?: never;
        value: number;
      }
    | number;
};

LineChartHorizontalLine.displayName = 'LineChartHorizontalLine';

export function LineChartHorizontalLine({
  color = 'gray',
  lineProps = {},
  at = { index: 0 },
  offsetY = 0,
}: HorizontalLineProps) {
  const { width, height, gutter } = React.useContext(
    LineChartDimensionsContext
  );
  const { geometry, end, points, curve } = React.useContext(
    LineChartGeometryContext
  );
  const { isTransitionEnabled } = React.useContext(LineChartPathContext);
  const source = isTransitionEnabled ? geometry : end;
  const shape = curve ?? 'linear';
  const { yDomain } = useLineChart();

  const y = useDerivedValue(() => {
    if (typeof at === 'number' || at.index != null) {
      // On the drawn shape, so the line follows the morph, or on the target
      // when the path doesn't morph.
      const index = typeof at === 'number' ? at : at.index;
      return pointAt(source.value, points.value, index, shape).y + offsetY;
    }
    /**
     * <gutter>
     * | ---------- | <- yDomain.max  |
     * |            |                 | offsetTop
     * |            | <- value        |
     * |            |
     * |            | <- yDomain.min
     * <gutter>
     */

    const offsetTop = yDomain.max - at.value;
    const percentageOffsetTop = offsetTop / (yDomain.max - yDomain.min);

    const heightBetweenGutters = height - gutter * 2;

    const offsetTopPixels = gutter + percentageOffsetTop * heightBetweenGutters;

    return withTiming(offsetTopPixels + offsetY);
  });

  const lineAnimatedProps = useAnimatedProps(
    () => ({
      x1: 0,
      x2: width,
      y1: y.value,
      y2: y.value,
    })
  );

  return (
    <AnimatedLine
      animatedProps={lineAnimatedProps}
      strokeWidth={2}
      stroke={color}
      strokeDasharray="3 3"
      {...lineProps}
    />
  );
}
