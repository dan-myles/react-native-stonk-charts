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
  getPointXs,
  getVertices,
  getXScale,
  lerpVertices,
  resample,
  sampleCurve,
  sameVertices,
  Vertices,
  XScale,
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

type Shapes = { line: string; area: string };

/**
 * What the chart's own paths and cursor read. Its value changes only with
 * the chart's size or curve, never with the data, so those components don't
 * re-render on a live tick or a range switch; the data reaches them through
 * the shared values.
 */
export const LineChartGeometryContext = React.createContext({
  width: 0,
  height: 0,
  curve: 'bumpX' as Curve | null,
  /** The drawn vertices, line and area, morphing. With another curve the strings are empty and only the vertices morph. */
  geometry: { value: { xs: [], ys: [], line: '', area: '' } } as unknown as SharedValue<Geometry>,
  /** The line and area the morph is heading to, for paths with transitions off. */
  target: { value: { line: '', area: '' } } as SharedValue<Shapes>,
  /** The vertices the morph is heading to, for decorations with transitions off. */
  end: { value: { xs: [], ys: [] } } as unknown as SharedValue<Vertices>,
  currentY: { value: -1 } as SharedValue<number>,
  /** Each data point's X, by index. */
  points: { value: [] } as unknown as SharedValue<number[]>,
  scale: { value: { start: 0, end: 0, width: 0 } } as SharedValue<XScale>,
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
    if (!data || data.length === 0) {
      return EMPTY_VERTICES;
    }
    if (!curve) {
      return sampleCurve(parsedPath);
    }
    return getVertices({
      data,
      width: pathWidth,
      height: chartDrawingHeight,
      gutter: yGutter,
      yDomain,
      xDomain,
    });
  }, [curve, parsedPath, data, pathWidth, chartDrawingHeight, yGutter, yDomain, xDomain]);

  const xScale = React.useMemo(
    () => getXScale(data ?? [], pathWidth, xDomain),
    [data, pathWidth, xDomain]
  );
  const pointXs = React.useMemo(
    () => getPointXs(data ?? [], xScale, xDomain),
    [data, xScale, xDomain]
  );

  // One morph per chart. JS only writes `pending`; the reaction owns
  // `from`, `to`, `end` and `progress`, so the derived geometry never draws
  // the new target for a frame before the morph starts. A switch mid-morph
  // starts from the shape on screen. Everything starts at the first render's
  // data, so the first frame already draws the line.
  const pending = useSharedValue<Vertices>(vertices);
  const from = useSharedValue<Vertices>(vertices);
  const to = useSharedValue<Vertices>(vertices);
  /** The real target. `to` holds it resampled while a morph runs to fewer vertices. */
  const end = useSharedValue<Vertices>(vertices);
  const progress = useSharedValue(1);

  const points = useSharedValue<number[]>(pointXs);
  const scale = useSharedValue<XScale>(xScale);

  React.useEffect(() => {
    pending.value = vertices;
  }, [pending, vertices]);

  React.useEffect(() => {
    scale.value = xScale;
    points.value = pointXs;
  }, [xScale, pointXs, points, scale]);

  useAnimatedReaction(
    () => pending.value,
    (next) => {
      if (sameVertices(next, end.value)) {
        return;
      }
      const drawn = lerpVertices(from.value, to.value, progress.value);
      end.value = next;
      if (drawn.xs.length < 2 || next.xs.length < 2) {
        from.value = next;
        to.value = next;
        progress.value = 1;
        return;
      }
      // Both sides of the morph get the larger vertex count, so neither
      // shape loses detail. A morph to fewer vertices runs on the target
      // resampled to the drawn count and swaps in the real target at the end.
      const shape = curve ?? 'linear';
      if (next.xs.length >= drawn.xs.length) {
        from.value = resample(drawn, next, shape);
        to.value = next;
      } else {
        from.value = drawn;
        to.value = resample(next, drawn, shape);
      }
      progress.value = 0;
      progress.value = withTiming(1, undefined, (finished) => {
        if (finished) {
          from.value = end.value;
          to.value = end.value;
        }
      });
    }
  );

  const geometry = useDerivedValue<Geometry>(() => {
    const drawn = lerpVertices(from.value, to.value, progress.value);
    // Every curve keeps the drawn vertices, for the cursor and decorations;
    // only the fast curves draw their strings from them.
    const line = curve ? buildLine(drawn.xs, drawn.ys, curve) : '';
    return {
      xs: drawn.xs,
      ys: drawn.ys,
      line,
      area: curve ? buildArea(line, drawn.xs, drawn.ys, chartDrawingHeight) : '',
    };
  });
  const target = useDerivedValue<Shapes>(() => {
    if (!curve) {
      return { line: '', area: '' };
    }
    const line = buildLine(end.value.xs, end.value.ys, curve);
    return {
      line,
      area: buildArea(line, end.value.xs, end.value.ys, chartDrawingHeight),
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

  const geometryValue = React.useMemo(
    () => ({
      width,
      height,
      curve,
      geometry,
      target,
      end,
      currentY,
      points,
      scale,
    }),
    [width, height, curve, geometry, target, end, currentY, points, scale]
  );

  return (
    <LineChartIdProvider id={id}>
      <LineChartGeometryContext.Provider value={geometryValue}>
        <LineChartDimensionsContext.Provider value={contextValue}>
          <View {...props} style={[absolute && styles.absolute, props.style]}>
            {children}
          </View>
        </LineChartDimensionsContext.Provider>
      </LineChartGeometryContext.Provider>
    </LineChartIdProvider>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
});
