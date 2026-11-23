import React from 'react';
import type { TextProps as RNTextProps } from 'react-native';
import type { AnimatedProps } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import { useLineChartDatetime } from './useDatetime';
import type { TFormatterFn } from '../../types';
import { AnimatedText } from '../../components/AnimatedText';

type LineChartDatetimeProps = {
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
  format?: TFormatterFn<number>;
  variant?: 'formatted' | 'value';
  style?: AnimatedProps<RNTextProps>['style'];
  /** Whether the text scales with the system font size. Defaults to React Native's `true`. */
  allowFontScaling?: boolean;
};

LineChartDatetimeText.displayName = 'LineChartDatetimeText';

export function LineChartDatetimeText({
  locale,
  options,
  format,
  variant = 'formatted',
  style,
  allowFontScaling,
}: LineChartDatetimeProps) {
  const datetime = useLineChartDatetime({ format, locale, options });
  
  const text = useDerivedValue(() => {
    const value = datetime[variant];
    if (typeof value === 'number') {
      return value.toString();
    }
    return typeof value === 'object' && 'value' in value ? value.value : String(value);
  });
  
  return <AnimatedText text={text} style={style} allowFontScaling={allowFontScaling} />;
}