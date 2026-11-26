import { defaultBranding, visibleDepartments } from '@erp/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Badge, Button, Card } from '@/components/ui';
import { isDemoMode } from '@/lib/demo';
import { signOut, useSession } from '@/state/session';
import { currentSiteStore } from '@/state/site';
import { colors, space } from '@/theme';

export default function MoreScreen() {
  const session = useSession();
  const router = useRouter();
  if (!session) return null;
  const departments = visibleDepartments(session.access);

  return (
    <Screen title="More">
      <Card>
        <AppText variant="subheading">{session.user.name}</AppText>
        <AppText variant="small">{session.user.roleLabel}</AppText>
        {isDemoMode() && <Badge label="Demo data" tone="warning" />}
      </Card>

      <View style={styles.section}>
        <AppText variant="subheading" accessibilityRole="header">
          Office departments
        </AppText>
        <AppText variant="small">
          The phone app is for site work. Use the web app in the office for:
        </AppText>
        <Card style={styles.list}>
          {departments.map((d) => (
            <AppText key={d.id} variant="body" style={styles.item}>
              {d.label}
            </AppText>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <AppText variant="caption">
          {defaultBranding.productName} · version {Constants.expoConfig?.version ?? 'unknown'}
        </AppText>
        <Button
          label="Sign out"
          variant="danger"
          icon="log-out-outline"
          onPress={() => {
            signOut();
            currentSiteStore.set(null);
            router.replace('/login');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space(2) },
  list: { gap: 0, paddingVertical: space(1) },
  item: {
    paddingVertical: space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
