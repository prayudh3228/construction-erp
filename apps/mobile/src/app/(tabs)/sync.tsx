import { formatDate } from '@erp/shared';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Badge, Button, Card } from '@/components/ui';
import { useConnectivity } from '@/state/network';
import { describeSync, useSyncStatus } from '@/state/sync';
import { colors, space } from '@/theme';

const CONNECTION_LABEL = { online: 'Online', offline: 'Offline', unknown: 'Checking…' } as const;

/** What is waiting to be sent, and the connection. The real queue arrives in Phase 28. */
export default function SyncScreen() {
  const connectivity = useConnectivity();
  const status = useSyncStatus();
  const summary = describeSync(status, connectivity);

  // There is no queue to send yet (Phase 28), so the button stays off and always says why.
  const reason =
    connectivity === 'offline'
      ? 'You are offline. Sync starts by itself when you are back online.'
      : status.state === 'syncing'
        ? 'Sending now…'
        : status.pending === 0 && status.state !== 'error'
          ? 'Nothing is waiting to be sent.'
          : 'Sending by hand arrives in phase 28. Until then, sync runs by itself.';

  return (
    <Screen title="Sync">
      <Card>
        <Badge label={summary.label} tone={summary.tone} />
        <AppText variant="body" accessibilityLiveRegion="polite">
          {summary.description}
        </AppText>
      </Card>

      <Card>
        <Row label="Connection" value={CONNECTION_LABEL[connectivity]} />
        <Row label="Waiting to send" value={String(status.pending)} />
        <Row
          label="Last synced"
          value={status.lastSyncedAt ? formatDate(new Date(status.lastSyncedAt)) : 'Never'}
        />
      </Card>

      <View style={styles.action}>
        <Button
          label="Sync now"
          icon="sync-outline"
          size="lg"
          disabled
          loading={status.state === 'syncing'}
          accessibilityHint={reason}
        />
        <AppText variant="small" style={styles.center}>
          {reason}
        </AppText>
      </View>

      <AppText variant="caption" style={styles.center}>
        Entries made on this phone are saved first and sent in order, never twice. (Phase 28)
      </AppText>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="small">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  action: { gap: space(2) },
  center: { textAlign: 'center' },
});
