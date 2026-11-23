import React from 'react';

import Animated, {
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  GestureDetector,
  LongPressGestureEvent,
  useLongPressGesture,
} from 'react-native-gesture-handler';

import { LineChartGeometryContext } from './Chart';
import { StyleSheet } from 'react-native';
import { useLineChartCursor } from './useLineChart';
import { nearestIndex } from './utils/geometry';

export type LineChartCursorProps = {
  children: React.ReactNode;
  type: 'line' | 'crosshair';
  snapToPoint?: boolean;
  at?: number;
  shouldCancelWhenOutside?: boolean;
  minDurationMs?: number;
  onActivated?: () => void;
  onEnded?: () => void;
  /** Called when the cursor moves onto a new data point, at most every 50ms, such as to play a haptic. */
  onHaptic?: () => void;
  orientation?: 'horizontal' | 'vertical';
};

export const CursorContext = React.createContext({ type: '' });

LineChartCursor.displayName = 'LineChartCursor';

export function LineChartCursor({
  children,
  snapToPoint,
  type,
  at,
  shouldCancelWhenOutside = false,
  minDurationMs = 0,
  onActivated,
  onEnded,
  onHaptic,
}: LineChartCursorProps) {
  // Only shared values: the gesture is built once and never rebuilt when the
  // data changes, and snapping runs on the UI thread.
  const { points, scale } = React.useContext(LineChartGeometryContext);
  const { currentX, currentIndex, isActive } = useLineChartCursor();
  const lastHapticAt = useSharedValue(0);

  // `at` is a timestamp when the provider has an `xDomain`, else an index.
  // It moves the cursor when `at` or the X scale changes, not on every tick.
  useAnimatedReaction(
    () => {
      const { start, end, width } = scale.value;
      return `${points.value.length}:${start}:${end}:${width}`;
    },
    () => {
      const xs = points.value;
      if (at === undefined || xs.length === 0) {
        return;
      }
      const { start, end, width } = scale.value;
      const x = end === start ? width / 2 : ((at - start) / (end - start)) * width;
      const index = nearestIndex(xs, x);
      currentIndex.value = index;
      currentX.value = xs[index]!;
      isActive.value = true;
    }
  );

  const updatePosition = (x: number) => {
    'worklet';
    const xs = points.value;
    if (xs.length === 0) {
      return;
    }
    // on Web, we could drag the cursor to be negative, breaking it
    // https://github.com/coinjar/react-native-wagmi-charts/issues/24
    const xPosition = Math.max(0, Math.min(x, scale.value.width));
    const index = nearestIndex(xs, xPosition);

    // Haptic only when the cursor crosses onto a new data point, at most
    // every 50ms. Firing per touch-move event floods the JS thread and the
    // haptic engine (~60+ calls/sec at 120Hz).
    if (onHaptic && index !== currentIndex.value) {
      const now = Date.now();
      if (now - lastHapticAt.value >= 50) {
        lastHapticAt.value = now;
        scheduleOnRN(onHaptic);
      }
    }

    currentIndex.value = index;
    currentX.value = snapToPoint ? xs[index]! : xPosition;
  };

  const longPressGesture = useLongPressGesture({
    minDuration: minDurationMs ?? 0,
    maxDistance: 999999,
    shouldCancelWhenOutside,
    onActivate: (event: LongPressGestureEvent) => {
      'worklet';
      if (points.value.length > 0) {
        isActive.value = true;
        updatePosition(event.x);

        if (onActivated) {
          scheduleOnRN(onActivated);
        }
      }
    },
    onTouchesMove: (event) => {
      'worklet';
      if (isActive.value && event.allTouches.length > 0) {
        updatePosition(event.allTouches[0]!.x);
      }
    },
    onDeactivate: () => {
      'worklet';
      isActive.value = false;
      currentIndex.value = -1;

      if (onEnded) {
        scheduleOnRN(onEnded);
      }
    },
  });

  return (
    <CursorContext.Provider value={{ type }}>
      <GestureDetector gesture={longPressGesture}>
        <Animated.View style={StyleSheet.absoluteFill}>
          {children}
        </Animated.View>
      </GestureDetector>
    </CursorContext.Provider>
  );
}
