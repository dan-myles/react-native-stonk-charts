import * as React from "react";
import flattenChildren from "react-keyed-flatten-children";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  WithTimingConfig,
} from "react-native-reanimated";
import { Defs, LinearGradient, Stop, Svg } from "react-native-svg";

import { LineChartDimensionsContext } from "./Chart";
import { LineChartPathContext } from "./LineChartPathContext";
import { LineChartPath, LineChartPathProps } from "./Path";
import { useLineChart } from "./useLineChart";

const BACKGROUND_COMPONENTS = [
  "LineChartHighlight",
  "LineChartHorizontalLine",
  "LineChartGradient",
  "LineChartDot",
  "LineChartTooltip",
];
const FOREGROUND_COMPONENTS = ["LineChartHighlight", "LineChartDot"];

const AnimatedSVG = Animated.createAnimatedComponent(Svg);

type LineChartPathWrapperProps = {
  animationDuration?: number;
  animationProps?: Omit<Partial<WithTimingConfig>, "duration">;
  children?: React.ReactNode;
  color?: string;
  glow?: string;
  gradientColors?: string[];
  inactiveColor?: string;
  width?: number;
  widthOffset?: number;
  pathProps?: Partial<LineChartPathProps>;
  showInactivePath?: boolean;
  animateOnMount?: "foreground";
  mountAnimationDuration?: number;
  mountAnimationProps?: Partial<WithTimingConfig>;
};

LineChartPathWrapper.displayName = "LineChartPathWrapper";

export function LineChartPathWrapper({
  animationDuration = 300,
  animationProps = {},
  children,
  color = "black",
  glow,
  gradientColors = ["#7B61FF", "#02D1BFBD"],
  inactiveColor,
  width: strokeWidth = 3,
  widthOffset = 20,
  pathProps = {},
  showInactivePath = true,
  animateOnMount,
  mountAnimationDuration = animationDuration,
  mountAnimationProps = animationProps,
}: LineChartPathWrapperProps) {
  const { height, pathWidth, width } = React.useContext(
    LineChartDimensionsContext,
  );
  const { currentX, isActive } = useLineChart();
  const isMounted = useSharedValue(false);
  const hasMountedAnimation = useSharedValue(false);

  React.useEffect(() => {
    isMounted.value = true;
  }, []);

  ////////////////////////////////////////////////

  const svgProps = useAnimatedProps(() => {
    const shouldAnimateOnMount = animateOnMount === "foreground";
    const inactiveWidth =
      !isMounted.value && shouldAnimateOnMount ? 0 : pathWidth;

    let duration =
      shouldAnimateOnMount && !hasMountedAnimation.value
        ? mountAnimationDuration
        : animationDuration;
    const props =
      shouldAnimateOnMount && !hasMountedAnimation.value
        ? mountAnimationProps
        : animationProps;

    if (isActive.value) {
      duration = 0;
    }

    return {
      width: withTiming(
        isActive.value
          ? // on Web, <svg /> elements don't support negative widths
            // https://github.com/coinjar/react-native-wagmi-charts/issues/24#issuecomment-955789904
            Math.max(currentX.value, 0)
          : inactiveWidth + widthOffset,
        Object.assign({ duration }, props),
        () => {
          hasMountedAnimation.value = true;
        },
      ),
    };
  }, [
    animateOnMount,
    animationDuration,
    animationProps,
    currentX,
    hasMountedAnimation,
    isActive,
    isMounted,
    mountAnimationDuration,
    mountAnimationProps,
    pathWidth,
    widthOffset,
  ]);

  const viewSize = React.useMemo(() => ({ width, height }), [width, height]);

  ////////////////////////////////////////////////

  let backgroundChildren;
  let foregroundChildren;
  if (children) {
    const iterableChildren = flattenChildren(children);
    backgroundChildren = iterableChildren.filter((child) =>
      // @ts-ignore
      BACKGROUND_COMPONENTS.includes(child?.type?.displayName),
    );
    foregroundChildren = iterableChildren.filter((child) =>
      // @ts-ignore
      FOREGROUND_COMPONENTS.includes(child?.type?.displayName),
    );
  }

  ////////////////////////////////////////////////

  return (
    <>
      <LineChartPathContext.Provider
        value={{
          color,
          isInactive: showInactivePath,
          isTransitionEnabled: pathProps.isTransitionEnabled ?? true,
        }}
      >
        <View style={viewSize}>
          <Svg width={width} height={height}>
            <LineChartPath
              color={color}
              inactiveColor={inactiveColor}
              width={strokeWidth}
              {...pathProps}
            />
          </Svg>
          <Svg style={StyleSheet.absoluteFill}>{backgroundChildren}</Svg>
        </View>
      </LineChartPathContext.Provider>
      <LineChartPathContext.Provider
        value={{
          color,
          isInactive: false,
          isTransitionEnabled: pathProps.isTransitionEnabled ?? true,
        }}
      >
        <View style={[StyleSheet.absoluteFill, styles.glowWrapper, glow && { shadowColor: glow }]}>
          <AnimatedSVG animatedProps={svgProps} height={height}>
            <Defs>
              <LinearGradient id="lineGradient" x1="0" y1="0" x2="100%" y2="0">
                <Stop offset="0%" stopColor={gradientColors[0]} />
                <Stop offset="100%" stopColor={gradientColors[1]} />
              </LinearGradient>
            </Defs>

            <LineChartPath
              stroke="url(#lineGradient)" // use the gradient as the stroke
              width={strokeWidth}
              {...pathProps}
            />
          </AnimatedSVG>

          <AnimatedSVG
            animatedProps={svgProps}
            height={height}
            style={StyleSheet.absoluteFill}
          >
            {foregroundChildren}
          </AnimatedSVG>
        </View>
      </LineChartPathContext.Provider>
    </>
  );
}
const styles = StyleSheet.create({
  glowWrapper: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 10,
  },
});
