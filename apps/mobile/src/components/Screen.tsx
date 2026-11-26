import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnectivity } from '@/state/network';
import { describeSync, useSyncStatus } from '@/state/sync';
import { colors, space, text } from '@/theme';
import { OfflineBanner, SyncStatusPill } from './StatusBits';
import { AppText } from './ui';

/**
 * Frame for every signed-in screen: title + sync pill, the offline banner when needed, then
 * scrolling content. The tab bar sits below, within thumb reach.
 */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const connectivity = useConnectivity();
  const sync = useSyncStatus();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.header}>
        <AppText style={text.title} accessibilityRole="header">
          {title}
        </AppText>
        <SyncStatusPill summary={describeSync(sync, connectivity)} />
      </View>
      <OfflineBanner connectivity={connectivity} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: { padding: space(4), gap: space(4), paddingBottom: space(8) },
});
