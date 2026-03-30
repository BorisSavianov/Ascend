// Type stub for @react-native-community/datetimepicker
// The real package has types at src/index.d.ts but the scoped package path
// is not resolved by TypeScript on this Windows setup.
declare module '@react-native-community/datetimepicker' {
  import { FC } from 'react';

  type Mode = 'date' | 'time' | 'datetime' | 'countdown';
  type Display = 'spinner' | 'default' | 'clock' | 'calendar' | 'compact' | 'inline';

  interface DateTimePickerEvent {
    type: 'set' | 'neutralButtonPressed' | 'dismissed';
    nativeEvent: { timestamp: number };
  }

  interface DateTimePickerProps {
    value: Date;
    mode?: Mode;
    display?: Display;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    is24Hour?: boolean;
    minimumDate?: Date;
    maximumDate?: Date;
    minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
    locale?: string;
    textColor?: string;
    accentColor?: string;
    themeVariant?: 'light' | 'dark';
    style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
    testID?: string;
  }

  const DateTimePicker: FC<DateTimePickerProps>;
  export default DateTimePicker;
  export type { DateTimePickerEvent };
}
