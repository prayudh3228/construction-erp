import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Button, Card, type IconName } from '@/components/ui';
import { colors, space } from '@/theme';

const KINDS: { label: string; hint: string; icon: IconName }[] = [
  { label: 'Bill or voucher photo', hint: 'For site expenses', icon: 'receipt-outline' },
  { label: 'Delivery challan', hint: 'When goods arrive', icon: 'cube-outline' },
  { label: 'Progress photo', hint: 'Work done today', icon: 'images-outline' },
];

/** Camera-first capture. The camera itself arrives with the site tools in Phase 29. */
export default function CaptureScreen() {
  return (
    <Screen title="Capture">
      <Card style={styles.hero}>
        <View style={styles.cameraIcon}>
          <Ionicons name="camera" size={40} color={colors['muted-foreground']} />
        </View>
        <AppText variant="subheading" style={styles.center}>
          Take a photo first, add details after
        </AppText>
        <AppText variant="small" style={styles.center}>
          Photos are kept on this phone and sent to the office when you are online.
        </AppText>
        <Button
          label="Open camera"
          icon="camera-outline"
          size="lg"
          disabled
          accessibilityHint="Camera capture arrives in phase 29."
        />
        <AppText variant="caption" style={styles.center}>
          Camera capture arrives in phase 29.
        </AppText>
      </Card>

      <View style={styles.list}>
        <AppText variant="subheading" accessibilityRole="header">
          What you will capture here
        </AppText>
        {KINDS.map((k) => (
          <View
            key={k.label}
            style={styles.row}
            accessible
            accessibilityLabel={`${k.label}. ${k.hint}.`}
          >
            <Ionicons name={k.icon} size={24} color={colors.primary} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{k.label}</AppText>
              <AppText variant="small">{k.hint}</AppText>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'stretch' },
  cameraIcon: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors['surface-muted'],
  },
  center: { textAlign: 'center' },
  list: { gap: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
  },
  flex: { flex: 1 },
});
