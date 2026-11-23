import * as React from 'react';
import Animated, {
  AnimatedProps,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Path, PathProps } from 'react-native-svg';

import { LineChartDimensionsContext, LineChartGeometryContext } from './Chart';
import { interpolatePath } from './utils';
import { usePrevious } from '../../utils';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type ChartPathProps = AnimatedProps<PathProps> & {
  kind: 'line' | 'area';
  enabled: boolean;
};

/**
 * One of the chart's paths. With `curveBumpX` or `curveLinear` it reads the
 * chart's shared geometry: the morphing shape, or the target when transitions
 * are off. It never reads the data, so it doesn't re-render when the data
 * changes, and the string is built once per frame for every path. Other
 * curves morph per path with `interpolatePath`, which is slower.
 */
export function AnimatedChartPath(props: ChartPathProps) {
  const { curve } = React.useContext(LineChartGeometryContext);
  return curve
    ? React.createElement(SharedPath, props)
    : React.createElement(MorphingPath, props);
}

function SharedPath({ kind, enabled, ...props }: ChartPathProps) {
  const { geometry, target } = React.useContext(LineChartGeometryContext);
  const source = enabled ? geometry : target;
  const animatedProps = useAnimatedProps(() => ({ d: source.value[kind] }));
  return React.createElement(AnimatedPath, { animatedProps, ...props });
}

function MorphingPath({ kind, enabled, ...props }: ChartPathProps) {
  const { path, area } = React.useContext(LineChartDimensionsContext);
  const { animatedProps } = useAnimatedPath({
    enabled,
    path: kind === 'area' ? area : path,
  });
  return React.createElement(AnimatedPath, { animatedProps, ...props });
}

function useAnimatedPath({
  enabled = true,
  path,
}: {
  enabled?: boolean;
  path: string;
}) {
  const transition = useSharedValue(0);

  const previousPath = usePrevious(path);

  useAnimatedReaction(
    () => {
      return path;
    },
    (result, previous) => {
      if (result !== previous) {
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
      previousPath && enabled
        ? interpolatePath(previousPath, path, null)
        : null,
    [enabled, path, previousPath]
  );

  const animatedProps = useAnimatedProps(() => {
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
