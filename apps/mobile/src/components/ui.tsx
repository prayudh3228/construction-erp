import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';
import { PRIMARY_TOUCH_TARGET, TOUCH_TARGET, colors, radii, shadow, space, text } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TextVariant = keyof typeof text;

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: TextVariant }) {
  return <Text style={[text[variant], style]} {...props} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  /** Big (56dp) for the main action on a screen; 48dp otherwise. */
  size?: 'md' | 'lg';
  /** Explains a disabled button to screen readers, e.g. why it cannot be used yet. */
  accessibilityHint?: string;
}

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors['primary-foreground'], border: colors.primary },
  secondary: { bg: colors.secondary, fg: colors['secondary-foreground'], border: colors.border },
  outline: { bg: colors.surface, fg: colors.foreground, border: colors['border-strong'] },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
};

/** A button that is always at least 48dp tall, with a clear pressed state and a busy state. */
export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  size = 'md',
  disabled,
  ...props
}: ButtonProps) {
  const c = buttonColors[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: size === 'lg' ? PRIMARY_TOUCH_TARGET : TOUCH_TARGET,
          backgroundColor: c.bg,
          borderColor: c.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        icon && <Ionicons name={icon} size={22} color={c.fg} />
      )}
      <Text style={[text.bodyStrong, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const toneColors = {
  neutral: { bg: colors['surface-muted'], fg: colors['muted-foreground'], border: colors.border },
  success: {
    bg: colors['success-subtle'],
    fg: colors['success-foreground'],
    border: colors.success,
  },
  warning: {
    bg: colors['warning-subtle'],
    fg: colors['warning-foreground'],
    border: colors.warning,
  },
  danger: { bg: colors['danger-subtle'], fg: colors['danger-foreground'], border: colors.danger },
  info: { bg: colors['info-subtle'], fg: colors['info-foreground'], border: colors.info },
} as const;
export type Tone = keyof typeof toneColors;

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[text.caption, { color: c.fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function toneOf(tone: Tone) {
  return toneColors[tone];
}

interface StateProps {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}

/** Nothing to show: says why and what to do next. */
export function EmptyState({ title, description, icon = 'file-tray-outline', action }: StateProps) {
  return (
    <View style={styles.state}>
      <Ionicons name={icon} size={32} color={colors['muted-foreground']} />
      <AppText variant="subheading" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {description && (
        <AppText variant="small" style={styles.center}>
          {description}
        </AppText>
      )}
      {action}
    </View>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: Omit<StateProps, 'icon' | 'action'> & { onRetry?: () => void }) {
  return (
    <View style={[styles.state, styles.error]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
      <AppText variant="subheading" style={[styles.center, { color: colors['danger-foreground'] }]}>
        {title}
      </AppText>
      {description && (
        <AppText variant="small" style={[styles.center, { color: colors['danger-foreground'] }]}>
          {description}
        </AppText>
      )}
      {onRetry && <Button label="Try again" variant="outline" icon="refresh" onPress={onRetry} />}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View
      style={styles.state}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText variant="small">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingHorizontal: space(5),
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
    gap: space(3),
    ...shadow.card,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space(2),
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  state: {
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(8),
    paddingHorizontal: space(5),
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors['border-strong'],
  },
  error: {
    borderStyle: 'solid',
    borderColor: colors.danger,
    backgroundColor: colors['danger-subtle'],
  },
  center: { textAlign: 'center' },
});
