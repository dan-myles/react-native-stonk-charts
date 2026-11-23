import * as React from "react";
import flattenChildren from "react-keyed-flatten-children";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
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

/**
 * The glow: wider, fainter strokes of the same animated path under the line.
 * A layer shadow cost an offscreen pass on iOS every frame its content moved,
 * and Android's elevation drew nothing without a background.
 */
const HALOS = [7, 5.5, 4, 2.5, 1].map((spread) => ({ spread, opacity: 0.06 }));

/** The reveal at rest: wider than any chart, so a resting clip never cuts the line however far live ticks grow it. */
const REST = 1e6;

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
  const { height, width } = React.useContext(LineChartDimensionsContext);
  const { currentX, isActive } = useLineChart();

  ////////////////////////////////////////////////

  // The active layer is revealed up to `reveal` by two opposite translations:
  // a clipping view moves to end at `reveal` while the layer inside moves back
  // to x = 0. Scrubbing and lift then animate transforms only; the SVGs never
  // resize or redraw.
  const capacity = width + widthOffset;
  const reveal = useSharedValue(animateOnMount === "foreground" ? 0 : REST);

  React.useEffect(() => {
    if (animateOnMount === "foreground") {
      reveal.value = withTiming(
        capacity,
        Object.assign({ duration: mountAnimationDuration }, mountAnimationProps),
        (finished) => {
          if (finished) {
            reveal.value = REST;
          }
        },
      );
    }
    // Mount only.
  }, []);

  useAnimatedReaction(
    () => (isActive.value ? Math.max(currentX.value, 0) : -1),
    (target, previous) => {
      if (target >= 0) {
        reveal.value = target;
        return;
      }
      if (previous !== null && previous >= 0) {
        reveal.value = withTiming(
          capacity,
          Object.assign({ duration: animationDuration }, animationProps),
          (finished) => {
            if (finished) {
              reveal.value = REST;
            }
          },
        );
      }
    },
    [capacity, animationDuration],
  );

  const clipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(reveal.value, capacity) - capacity }],
  }));
  const layerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capacity - Math.min(reveal.value, capacity) }],
  }));

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
        <Animated.View
          style={[styles.clip, { width: capacity, height }, clipStyle]}
        >
          <Animated.View
            style={[{ width: capacity, height }, layerStyle]}
          >
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="lineGradient" x1="0" y1="0" x2="100%" y2="0">
                  <Stop offset="0%" stopColor={gradientColors[0]} />
                  <Stop offset="100%" stopColor={gradientColors[1]} />
                </LinearGradient>
              </Defs>

              {glow
                ? HALOS.map((halo) => (
                    <LineChartPath
                      key={halo.spread}
                      color={glow}
                      width={strokeWidth + halo.spread}
                      strokeOpacity={halo.opacity}
                      {...pathProps}
                    />
                  ))
                : null}
              <LineChartPath
                stroke="url(#lineGradient)" // use the gradient as the stroke
                width={strokeWidth}
                {...pathProps}
              />
            </Svg>

            <Svg
              width={width}
              height={height}
              style={StyleSheet.absoluteFill}
            >
              {foregroundChildren}
            </Svg>
          </Animated.View>
        </Animated.View>
      </LineChartPathContext.Provider>
    </>
  );
}
const styles = StyleSheet.create({
  clip: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
});
