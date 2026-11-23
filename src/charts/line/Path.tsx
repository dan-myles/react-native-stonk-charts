import * as React from 'react';
import { AnimatedProps } from 'react-native-reanimated';
import { PathProps } from 'react-native-svg';
import { LineChartPathContext } from './LineChartPathContext';
import { AnimatedChartPath } from './useAnimatedPath';

export type LineChartPathProps = AnimatedProps<PathProps> & {
  color?: string;
  inactiveColor?: string;
  width?: number;
  isInactive?: boolean;
  /**
   * Default: `true`.
   *
   * If `false`, changes in the chart's path will not animate.
   *
   * While this use case is rare, it may be useful on web, where animations might not work as well.
   *
   ***Example**
   *
   * ```tsx
   * <LineChart.Path
   *   pathProps={{ isTransitionEnabled: Platform.OS !== 'web' }}
   * />
   * ```
   */
  isTransitionEnabled?: boolean;
};

/** Memoized: it reads the chart through shared values, so a parent's re-render on new data skips it. */
export const LineChartPath = React.memo(function LineChartPath({
  color = 'black',
  inactiveColor,
  width: strokeWidth = 3,
  ...props
}: LineChartPathProps) {
  const { isTransitionEnabled, isInactive } =
    React.useContext(LineChartPathContext);

  return (
    <AnimatedChartPath
      kind="line"
      enabled={isTransitionEnabled}
      fill="transparent"
      stroke={isInactive ? inactiveColor || color : color}
      strokeOpacity={isInactive && !inactiveColor ? 0.2 : 1}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      {...props}
    />
  );
});
LineChartPath.displayName = 'LineChartPath';
