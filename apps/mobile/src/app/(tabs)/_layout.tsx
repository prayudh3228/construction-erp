import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, usePathname } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { type IconName } from '@/components/ui';
import { useSession } from '@/state/session';
import { TOUCH_TARGET, colors } from '@/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline', iconActive: 'today' },
  { name: 'capture', title: 'Capture', icon: 'camera-outline', iconActive: 'camera' },
  { name: 'sync', title: 'Sync', icon: 'cloud-upload-outline', iconActive: 'cloud-upload' },
  { name: 'more', title: 'More', icon: 'menu-outline', iconActive: 'menu' },
];

/** Signed-in area: four tabs at the bottom, within thumb reach. Signed-out users go to login. */
export default function TabsLayout() {
  const session = useSession();
  const pathname = usePathname();
  // Remember where a deep link was going, so sign-in can return there.
  if (!session) return <Redirect href={{ pathname: '/login', params: { next: pathname } }} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors['muted-foreground'],
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: TOUCH_TARGET + 16,
        },
        tabBarItemStyle: { minHeight: TOUCH_TARGET },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={26} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
