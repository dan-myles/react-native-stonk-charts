import * as React from 'react';
import { AnimatedProps } from 'react-native-reanimated';
import { Defs, LinearGradient, Stop, PathProps } from 'react-native-svg';
import { LineChartPathContext } from './LineChartPathContext';
import { AnimatedChartPath } from './useAnimatedPath';

export type LineChartGradientProps = AnimatedProps<PathProps> & {
  color?: string;
  children?: React.ReactNode;
};

let id = 0;

LineChartGradient.displayName = 'LineChartGradient';

export function LineChartGradient({
  color: overrideColor = undefined,
  children,
  ...props
}: LineChartGradientProps) {
  const { color: contextColor, isTransitionEnabled } =
    React.useContext(LineChartPathContext);
  const color = overrideColor || contextColor;

  ////////////////////////////////////////////////

  const localId = React.useRef(++id);

  ////////////////////////////////////////////////

  return (
    <>
      {children ? (
        <Defs>
          <LinearGradient
            id={`${localId.current}`}
            x1="0"
            x2="0"
            y1="0"
            y2="100%"
          >
            {/*@ts-ignore*/}
            {children}
          </LinearGradient>
        </Defs>
      ) : (
        <Defs>
          <LinearGradient
            id={`${localId.current}`}
            x1="0"
            x2="0"
            y1="0"
            y2="100%"
          >
            <Stop offset="20%" stopColor={color} stopOpacity={0.15} />
            <Stop offset="40%" stopColor={color} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
      )}
      <AnimatedChartPath
        kind="area"
        enabled={isTransitionEnabled}
        fill={`url(#${localId.current})`}
        {...props}
      />
    </>
  );
}