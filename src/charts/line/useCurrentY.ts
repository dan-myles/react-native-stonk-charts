import { useContext } from 'react';
import { LineChartGeometryContext } from './Chart';

export function useCurrentY() {
  const { currentY } = useContext(LineChartGeometryContext);
  return currentY;
}
