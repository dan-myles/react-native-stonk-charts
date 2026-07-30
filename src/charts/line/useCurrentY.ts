import { useContext } from 'react';
import { LineChartDimensionsContext } from './Chart';

export function useCurrentY() {
  const { currentY } = useContext(LineChartDimensionsContext);
  return currentY;
}
