import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { TOUCH_TARGET, colors, radii, space, text } from '@/theme';
import { AppText } from './ui';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
}

/** Labelled input, 48dp tall, with the error read out as part of the field. */
export function TextField({ label, error, required, onFocus, onBlur, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="label">
        {label}
        {required && <AppText style={{ color: colors.danger }}> *</AppText>}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={!!error}
        placeholderTextColor={colors['muted-foreground']}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          text.body,
          {
            borderColor: error ? colors.danger : focused ? colors.ring : colors.input,
            borderWidth: focused || error ? 2 : 1,
          },
        ]}
        {...props}
      />
      {error && (
        <AppText variant="small" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1.5) },
  input: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: space(3),
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
});
