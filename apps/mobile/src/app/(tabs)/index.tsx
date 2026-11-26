import {
  PROJECT_TYPE_LABELS,
  type ProjectSummary,
  formatDate,
  toIsoDateInIndia,
} from '@erp/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '@/components/Screen';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  type IconName,
  LoadingState,
} from '@/components/ui';
import { useProjects } from '@/data/projects';
import { useSession } from '@/state/session';
import { currentSiteStore, useCurrentSiteId } from '@/state/site';
import { TOUCH_TARGET, colors, radii, space } from '@/theme';

/** Site actions. Each arrives in a later phase; the tiles show where they will live. */
const ACTIONS: { label: string; icon: IconName; phase: number }[] = [
  { label: 'Mark attendance', icon: 'people-outline', phase: 28 },
  { label: 'Receive goods', icon: 'cube-outline', phase: 29 },
  { label: 'Issue material', icon: 'arrow-redo-outline', phase: 29 },
  { label: 'Site voucher', icon: 'receipt-outline', phase: 29 },
  { label: 'Progress photo', icon: 'images-outline', phase: 29 },
];

export default function TodayScreen() {
  const session = useSession();
  const projects = useProjects();
  const siteId = useCurrentSiteId();
  const [picking, setPicking] = useState(false);
  const today = formatDate(toIsoDateInIndia(new Date()));

  const site =
    projects.status === 'success' ? projects.data.find((p) => p.id === siteId) : undefined;

  return (
    <Screen title="Today">
      <View>
        <AppText variant="small">{today}</AppText>
        <AppText variant="heading">Hello, {session?.user.name.split(' ')[0] ?? 'there'}</AppText>
      </View>

      {projects.status === 'loading' && <LoadingState label="Loading your sites…" />}
      {projects.status === 'error' && (
        <ErrorState
          title="Could not load your sites"
          description="Check your connection and try again."
          onRetry={projects.retry}
        />
      )}
      {projects.status === 'success' && projects.data.length === 0 && (
        <EmptyState
          icon="business-outline"
          title="No sites assigned yet"
          description="Ask the office to assign you to a project."
        />
      )}
      {projects.status === 'success' && projects.data.length > 0 && (
        <Card>
          <AppText variant="caption">Your site</AppText>
          {site ? (
            <View style={styles.siteRow}>
              <View style={styles.flex}>
                <AppText variant="subheading">{site.name}</AppText>
                <AppText variant="small">
                  {site.code} · {site.city}
                </AppText>
              </View>
              <Badge
                label={PROJECT_TYPE_LABELS[site.type]}
                tone={site.type === 'development' ? 'info' : 'neutral'}
              />
            </View>
          ) : (
            <AppText variant="small">Choose the site you are working on today.</AppText>
          )}
          <Button
            label={site ? 'Change site' : 'Choose site'}
            variant={site ? 'outline' : 'primary'}
            icon="location-outline"
            onPress={() => setPicking(true)}
          />
        </Card>
      )}

      <View style={styles.section}>
        <AppText variant="subheading" accessibilityRole="header">
          Site actions
        </AppText>
        <View style={styles.grid}>
          {ACTIONS.map((a) => (
            <View
              key={a.label}
              style={styles.tile}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${a.label}. Coming in phase ${a.phase}.`}
            >
              <Ionicons name={a.icon} size={28} color={colors['muted-foreground']} />
              <AppText variant="bodyStrong" style={styles.tileLabel}>
                {a.label}
              </AppText>
              <AppText variant="caption">Coming in phase {a.phase}</AppText>
            </View>
          ))}
        </View>
      </View>

      {projects.status === 'success' && (
        <SitePicker
          visible={picking}
          projects={projects.data}
          selectedId={siteId}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            currentSiteStore.set(id);
            setPicking(false);
          }}
        />
      )}
    </Screen>
  );
}

function SitePicker({
  visible,
  projects,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean;
  projects: readonly ProjectSummary[];
  selectedId: string | null;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <AppText variant="heading" accessibilityRole="header">
            Choose your site
          </AppText>
          <Button label="Close" variant="outline" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.sheetList}>
          {projects.map((p) => {
            const selected = p.id === selectedId;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${p.code} ${p.name}, ${p.city}, ${PROJECT_TYPE_LABELS[p.type]}`}
                onPress={() => onPick(p.id)}
                style={({ pressed }) => [
                  styles.siteOption,
                  selected && styles.siteOptionSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{p.name}</AppText>
                  <AppText variant="small">
                    {p.code} · {p.city}
                  </AppText>
                </View>
                <Badge
                  label={PROJECT_TYPE_LABELS[p.type]}
                  tone={p.type === 'development' ? 'info' : 'neutral'}
                />
                {selected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  section: { gap: space(3) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: TOUCH_TARGET * 2,
    padding: space(4),
    gap: space(1),
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors['surface-muted'],
  },
  tileLabel: { color: colors['muted-foreground'] },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetList: { padding: space(4), gap: space(3) },
  siteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: TOUCH_TARGET + 16,
    padding: space(4),
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  siteOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.accent,
  },
});
