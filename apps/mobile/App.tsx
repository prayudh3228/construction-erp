import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/** Phase 0 placeholder. The site-staff shell (offline banner, sync status) arrives in Phase 1. */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Construction ERP</Text>
      <Text style={styles.subtitle}>Site app placeholder</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#475569' },
});
