import React, { createContext, useMemo } from 'react';

import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { TLineChartData, TLineChartDataProp } from './types';
import { LineChartDataProvider } from './Data';

import type { TLineChartContext, YRangeProp } from './types';
import { getDomain, lineChartDataPropToArray } from './utils';

/**
 * The gesture's shared values, created once per provider. Its value never
 * changes, so components that read only these never re-render on new data.
 */
export const LineChartCursorContext = createContext<
  Pick<TLineChartContext, 'currentX' | 'currentIndex' | 'isActive'>
>({
  currentX: { value: -1 } as TLineChartContext['currentX'],
  currentIndex: { value: -1 } as TLineChartContext['currentIndex'],
  isActive: { value: false } as TLineChartContext['isActive'],
});

export const LineChartContext = createContext<TLineChartContext>({
  currentX: { value: -1 } as TLineChartContext['currentX'],
  currentIndex: { value: -1 } as TLineChartContext['currentIndex'],
  domain: [0, 0],
  isActive: { value: false } as TLineChartContext['isActive'],
  yDomain: {
    min: 0,
    max: 0,
  },
  xDomain: undefined,
  xLength: 0,
});

type LineChartProviderProps = {
  children: React.ReactNode;
  data: TLineChartDataProp;
  yRange?: YRangeProp;
  onCurrentIndexChange?: (x: number) => void;
  xLength?: number;
  xDomain?: [number, number];
};

export function LineChartProvider({
  children,
  data = [],
  yRange,
  onCurrentIndexChange,
  xLength,
  xDomain,
}: LineChartProviderProps) {
  const currentX = useSharedValue(-1);
  const currentIndex = useSharedValue(-1);
  const isActive = useSharedValue(false);

  const domain = useMemo(
    () => getDomain(
      Array.isArray(data) ? data : Object.values(data)[0] as TLineChartData
    ),
    [data]
  );

  const values = useMemo(() => 
    lineChartDataPropToArray(data).map(({ value }) => value), 
    [data]
  );

  const yDomainValues = useMemo(() => ({
    min: yRange?.min ?? Math.min(...values),
    max: yRange?.max ?? Math.max(...values),
  }), [values, yRange?.min, yRange?.max]);

  const contextValue = useMemo<TLineChartContext>(() => {
    const domainRows =
      Array.isArray(data) ? data : Object.values(data)[0] as TLineChartData;

    return {
      currentX,
      currentIndex,
      isActive,
      domain,
      yDomain: yDomainValues,
      xDomain,
      xLength: xLength ?? domainRows.length,
    };
  }, [
    currentIndex,
    currentX,
    data,
    domain,
    isActive,
    yDomainValues,
    xLength,
    xDomain,
  ]);

  const cursorValue = useMemo(
    () => ({ currentX, currentIndex, isActive }),
    [currentX, currentIndex, isActive]
  );

  useAnimatedReaction(
    () => currentIndex.value,
    (x, prevX) => {
      if (x !== prevX && onCurrentIndexChange) {
        scheduleOnRN(onCurrentIndexChange, x);
      }
    }
  );

  return (
    <LineChartDataProvider data={data}>
      <LineChartCursorContext.Provider value={cursorValue}>
        <LineChartContext.Provider value={contextValue}>
          {children}
        </LineChartContext.Provider>
      </LineChartCursorContext.Provider>
    </LineChartDataProvider>
  );
}

LineChartProvider.displayName = 'LineChartProvider';
