import React from 'react';
// @ts-ignore
import * as d3Shape from 'd3-shape';

import { Dimensions, StyleSheet, View, ViewProps } from 'react-native';
import { LineChartIdProvider, useLineChartData } from './Data';
import { getYForX, Path, parse } from 'react-native-redash';
import type { SharedValue } from 'react-native-reanimated';
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getArea, getPath } from './utils';
import {
  buildArea,
  buildLine,
  Curve,
  EMPTY_VERTICES,
  Geometry,
  getCurve,
  getVertices,
  lerpVertices,
  resample,
  sameVertices,
  Vertices,
  yForX,
} from './utils/geometry';

import { LineChartContext } from './Context';

export const LineChartDimensionsContext = React.createContext({
  width: 0,
  height: 0,
  pointWidth: 0,
  parsedPath: {} as Path,
  path: '',
  area: '',
  shape: d3Shape.curveBumpX,
  gutter: 0,
  pathWidth: 0,
  currentY: { value: -1 } as SharedValue<number>,
  /**
   * The drawn line and area, shared by every path that animates. It morphs
   * once per chart on a data or size change. `null` when `shape` is not
   * `curveBumpX` or `curveLinear`; those paths morph on their own.
   */
  geometry: null as SharedValue<Geometry> | null,
  curve: 'bumpX' as Curve | null,
});

type LineChartProps = ViewProps & {
  children: React.ReactNode;
  yGutter?: number;
  width?: number;
  height?: number;
  shape?: unknown;
  /**
   * If your `LineChart.Provider` uses a dictionary with multiple IDs for multiple paths, then this field is required.
   */
  id?: string;
  absolute?: boolean;
};

const { width: screenWidth } = Dimensions.get('window');

LineChart.displayName = 'LineChart';

export function LineChart({
  children,
  yGutter = 16,
  width = screenWidth,
  height = screenWidth,
  shape = d3Shape.curveBumpX,
  id,
  absolute,
  ...props
}: LineChartProps) {
  const { yDomain, xLength, xDomain, currentX } =
    React.useContext(LineChartContext);
  const { data } = useLineChartData({
    id,
  });

  // Reserve space at the bottom for x-axis cursor labels
  const X_AXIS_LABEL_RESERVED_HEIGHT = 40;
  const chartDrawingHeight = height - X_AXIS_LABEL_RESERVED_HEIGHT;

  const pathWidth = React.useMemo(() => {
    let allowedWidth = width;
    if (data && xLength > data.length) {
      allowedWidth = (width * data.length) / xLength;
    }
    return allowedWidth;
  }, [data, width, xLength]);

  const path = React.useMemo(() => {
    if (data && data.length > 0) {
      return getPath({
        data,
        width: pathWidth,
        height: chartDrawingHeight,
        gutter: yGutter,
        shape,
        yDomain,
        xDomain,
      });
    }
    return '';
  }, [data, pathWidth, chartDrawingHeight, yGutter, shape, yDomain, xDomain]);

  const area = React.useMemo(() => {
    if (data && data.length > 0) {
      return getArea({
        data,
        width: pathWidth,
        height: chartDrawingHeight,
        gutter: yGutter,
        shape,
        yDomain,
        xDomain,
      });
    }
    return '';
  }, [data, pathWidth, chartDrawingHeight, yGutter, shape, yDomain, xDomain]);

  const parsedPath = React.useMemo(() => parse(path), [path]);

  const curve = getCurve(shape);
  const vertices = React.useMemo(() => {
    if (!curve || !data || data.length === 0) {
      return EMPTY_VERTICES;
    }
    return getVertices({
      data,
      width: pathWidth,
      height: chartDrawingHeight,
      gutter: yGutter,
      yDomain,
      xDomain,
    });
  }, [curve, data, pathWidth, chartDrawingHeight, yGutter, yDomain, xDomain]);

  // One morph per chart. JS only writes `pending`; the reaction owns
  // `from`, `to` and `progress`, so the derived geometry never draws the new
  // target for a frame before the morph starts. A switch mid-morph starts
  // from the shape on screen.
  const pending = useSharedValue<Vertices>(EMPTY_VERTICES);
  const from = useSharedValue<Vertices>(EMPTY_VERTICES);
  const to = useSharedValue<Vertices>(EMPTY_VERTICES);
  const progress = useSharedValue(1);

  React.useEffect(() => {
    pending.value = vertices;
  }, [pending, vertices]);

  useAnimatedReaction(
    () => pending.value,
    (next) => {
      if (!curve || sameVertices(next, to.value)) {
        return;
      }
      const drawn = lerpVertices(from.value, to.value, progress.value);
      if (drawn.xs.length < 2 || next.xs.length < 2) {
        from.value = next;
        to.value = next;
        progress.value = 1;
        return;
      }
      from.value = resample(drawn, next, curve);
      to.value = next;
      progress.value = 0;
      progress.value = withTiming(1);
    },
    [curve]
  );

  const geometry = useDerivedValue<Geometry>(() => {
    const drawn = lerpVertices(from.value, to.value, progress.value);
    const line = curve ? buildLine(drawn.xs, drawn.ys, curve) : '';
    return {
      xs: drawn.xs,
      ys: drawn.ys,
      line,
      area: buildArea(line, drawn.xs, drawn.ys, chartDrawingHeight),
    };
  });
  const pointWidth = React.useMemo(
    () => width / (data ? data.length - 1 : 1),
    [data, width]
  );

  // One derived cursor Y per chart. Every useLineChart() consumer used to
  // build its own copy (re-parsing the path and solving the curve per
  // frame), multiplying UI-thread work by the number of consumers.
  const hasPath = path !== '';
  const currentY = useDerivedValue(() => {
    if (!hasPath) {
      return -1;
    }
    const boundedX = Math.min(width, currentX.value);
    if (curve) {
      return yForX(geometry.value.xs, geometry.value.ys, boundedX, curve);
    }
    return getYForX(parsedPath, boundedX) || 0;
  });

  const contextValue = React.useMemo(
    () => ({
      gutter: yGutter,
      parsedPath,
      pointWidth,
      area,
      path,
      width,
      height,
      pathWidth,
      shape,
      currentY,
      geometry: curve ? geometry : null,
      curve,
    }),
    [
      yGutter,
      parsedPath,
      pointWidth,
      area,
      path,
      width,
      height,
      pathWidth,
      shape,
      currentY,
      geometry,
      curve,
    ]
  );

  return (
    <LineChartIdProvider id={id}>
      <LineChartDimensionsContext.Provider value={contextValue}>
        <View {...props} style={[absolute && styles.absolute, props.style]}>
          {children}
        </View>
      </LineChartDimensionsContext.Provider>
    </LineChartIdProvider>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
});
