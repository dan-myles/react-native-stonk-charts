import * as React from 'react';
import Animated, {
  AnimatedProps,
  useAnimatedProps,
} from 'react-native-reanimated';
import { ClipPath, Defs, G, PathProps, Rect } from 'react-native-svg';
import { LineChartGeometryContext } from './Chart';
import { LineChartPathContext } from './LineChartPathContext';
import { AnimatedChartPath } from './useAnimatedPath';
import { pointAt } from './utils/geometry';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type LineChartColorProps = AnimatedProps<PathProps> & {
  color?: string;
  from: number;
  to: number;
  showInactiveColor?: boolean;
  inactiveColor?: string;
  width?: number;
};

LineChartHighlight.displayName = 'LineChartHighlight';

export function LineChartHighlight({
  color = 'black',
  inactiveColor,
  showInactiveColor = true,
  from,
  to,
  width: strokeWidth = 3,
  ...props
}: LineChartColorProps) {
  const { geometry, end, points, curve, height } = React.useContext(
    LineChartGeometryContext
  );
  const shape = curve ?? 'linear';
  const { isTransitionEnabled, isInactive: _isInactive } =
    React.useContext(LineChartPathContext);
  const isInactive = showInactiveColor && _isInactive;

  ////////////////////////////////////////////////

  // The clip follows the drawn shape through a morph, or sits on the target
  // when the path doesn't morph.
  const source = isTransitionEnabled ? geometry : end;
  const clipProps = useAnimatedProps(() => {
    const left = pointAt(source.value, points.value, from, shape).x;
    const right = pointAt(source.value, points.value, to, shape).x;
    return { x: left, width: Math.max(right - left, 0) };
  });

  return (
    <G>
      <Defs>
        <ClipPath id="clip">
          <AnimatedRect
            animatedProps={clipProps}
            y="0"
            height={height}
            fill="white"
          />
        </ClipPath>
      </Defs>
      <AnimatedChartPath
        kind="line"
        enabled={isTransitionEnabled}
        clipPath="url(#clip)"
        fill="transparent"
        stroke={isInactive ? inactiveColor || color : color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeOpacity={isInactive && !inactiveColor ? 0.5 : 1}
        {...props}
      />
    </G>
  );
}