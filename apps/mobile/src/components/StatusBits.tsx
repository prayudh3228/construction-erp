import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnnounce } from '@/lib/announce';
import { type Connectivity } from '@/state/network';
import { type SyncSummary } from '@/state/sync';
import { TOUCH_TARGET, colors, radii, space, text } from '@/theme';
import { toneOf } from './ui';

/** Full-width warning shown on every screen while the phone has no internet. */
const OFFLINE_MESSAGE =
  'You are offline. Keep working; entries are saved on this phone and sent later.';

export function OfflineBanner({ connectivity }: { connectivity: Connectivity }) {
  useAnnounce(connectivity === 'offline' ? OFFLINE_MESSAGE : null);
  if (connectivity !== 'offline') return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={20} color={colors['warning-foreground']} />
      <Text style={[text.small, styles.bannerText]}>{OFFLINE_MESSAGE}</Text>
    </View>
  );
}

const icons = {
  neutral: 'cloud-outline',
  success: 'cloud-done-outline',
  warning: 'cloud-offline-outline',
  danger: 'alert-circle-outline',
  info: 'sync-outline',
} as const;

/** Sync status pill in every screen header. Tapping it opens the Sync tab. */
export function SyncStatusPill({ summary }: { summary: SyncSummary }) {
  const router = useRouter();
  const c = toneOf(summary.tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${summary.description}`}
      accessibilityHint="Opens the Sync screen"
      onPress={() => router.navigate('/sync')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: c.bg, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icons[summary.tone]} size={16} color={c.fg} />
      <Text style={[text.caption, { color: c.fg, fontWeight: '600' }]}>{summary.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    backgroundColor: colors['warning-subtle'],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
  },
  bannerText: { flex: 1, color: colors['warning-foreground'] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    minHeight: TOUCH_TARGET - 12,
    paddingHorizontal: space(3),
    borderRadius: radii.full,
    borderWidth: 1,
  },
});
