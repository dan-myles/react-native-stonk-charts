import * as React from 'react';
import {
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { interpolatePath } from './utils';
import { usePrevious } from '../../utils';

export default function useAnimatedPath({
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
    },
    [path]
  );

  // Parsing both path strings is expensive (O(points)). Build the
  // interpolator once per path change on the JS thread; the returned
  // closure is a worklet, so the frame loop below only evaluates it.
  const pathInterpolator = React.useMemo(
    () => (previousPath && enabled ? interpolatePath(previousPath, path, null) : null),
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
