import React from 'react';

import { LineChartContext, LineChartCursorContext } from './Context';
import { useLineChartData, useLineChartId } from './Data';
import { useCurrentY } from './useCurrentY';

export function useLineChart() {
  const lineChartContext = React.useContext(LineChartContext);
  const maybeId = useLineChartId();
  const dataContext = useLineChartData({
    id: maybeId,
  });
  const currentY = useCurrentY();

  return React.useMemo(
    () => ({ ...lineChartContext, ...dataContext, currentY }),
    [lineChartContext, dataContext, currentY]
  );
}

/**
 * The cursor's shared values and the drawn Y under it. Unlike `useLineChart`,
 * which also returns the data, its result never changes, so a component that
 * needs only these does not re-render when the data does.
 */
export function useLineChartCursor() {
  const cursor = React.useContext(LineChartCursorContext);
  const currentY = useCurrentY();
  return React.useMemo(() => ({ ...cursor, currentY }), [cursor, currentY]);
}
