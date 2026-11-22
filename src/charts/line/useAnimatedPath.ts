import * as React from 'react';
import {
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LineChartDimensionsContext } from './Chart';
import { interpolatePath } from './utils';
import { usePrevious } from '../../utils';

/**
 * The `d` for one path. When the chart draws its own curve, an animating path
 * reads the chart's shared geometry, so every path and decoration follows one
 * morph and the string is built once per frame. A path with transitions off
 * draws the target string. Other curves morph per path with
 * `interpolatePath`, which is slower.
 */
export default function useAnimatedPath({
  enabled = true,
  path,
  kind,
}: {
  enabled?: boolean;
  path: string;
  kind: 'line' | 'area';
}) {
  const { geometry } = React.useContext(LineChartDimensionsContext);
  const shared = enabled ? geometry : null;

  const transition = useSharedValue(0);

  const previousPath = usePrevious(path);

  useAnimatedReaction(
    () => {
      return path;
    },
    (result, previous) => {
      if (result !== previous && !shared) {
        transition.value = 0;
        transition.value = withTiming(1);
      }
    }
  );

  // Parsing both path strings is expensive (O(points)). Build the
  // interpolator once per path change on the JS thread; the returned
  // closure is a worklet, so the frame loop below only evaluates it.
  const pathInterpolator = React.useMemo(
    () =>
      previousPath && enabled && !shared
        ? interpolatePath(previousPath, path, null)
        : null,
    [enabled, path, previousPath, shared]
  );

  const animatedProps = useAnimatedProps(() => {
    if (shared) {
      return { d: shared.value[kind] };
    }
    let d = path || '';
    if (pathInterpolator) {
      d = pathInterpolator(transition.value);
    }
    return {
      d,
    };
  });

  return { animatedProps };
}
