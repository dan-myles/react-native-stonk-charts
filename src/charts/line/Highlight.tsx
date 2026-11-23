import * as React from 'react';
import { AnimatedProps } from 'react-native-reanimated';
import { ClipPath, Defs, G, PathProps, Rect } from 'react-native-svg';
import { LineChartDimensionsContext } from './Chart';
import { LineChartPathContext } from './LineChartPathContext';
import { AnimatedChartPath } from './useAnimatedPath';
import { getXPositionForCurve } from './utils/getXPositionForCurve';

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
  const { parsedPath, height } = React.useContext(
    LineChartDimensionsContext
  );
  const { isTransitionEnabled, isInactive: _isInactive } =
    React.useContext(LineChartPathContext);
  const isInactive = showInactiveColor && _isInactive;

  ////////////////////////////////////////////////

  const clipStart = getXPositionForCurve(parsedPath, from);
  const clipEnd = getXPositionForCurve(parsedPath, to);

  return (
    <G>
      <Defs>
        <ClipPath id="clip">
          <Rect
            x={clipStart}
            y="0"
            width={clipEnd - clipStart}
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