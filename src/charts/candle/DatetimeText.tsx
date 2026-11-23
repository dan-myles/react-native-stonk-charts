import React from 'react';
import type { TextProps as RNTextProps } from 'react-native';
import type { AnimatedProps } from 'react-native-reanimated';

import { useCandlestickChartDatetime } from './useDatetime';
import type { TFormatterFn } from '../../types';
import { AnimatedText } from '../../components/AnimatedText';

type CandlestickChartPriceTextProps = {
  locale?: string;
  options?: { [key: string]: string };
  format?: TFormatterFn<number>;
  variant?: 'formatted' | 'value';
  style?: AnimatedProps<RNTextProps>['style'];
  /** Whether the text scales with the system font size. Defaults to React Native's `true`. */
  allowFontScaling?: boolean;
};

export function CandlestickChartDatetimeText({
  locale,
  options,
  format,
  variant = 'formatted',
  style,
  allowFontScaling,
}: CandlestickChartPriceTextProps) {
  const datetime = useCandlestickChartDatetime({ format, locale, options });
  return <AnimatedText text={datetime[variant]} style={style} allowFontScaling={allowFontScaling} />;
}
