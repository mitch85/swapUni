import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useApp } from '@/lib/app-state';

const icon = (name: IconName, active: IconName) =>
  function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={focused ? active : name} size={24} color={color as string} />;
  };

export default function TabLayout() {
  const { unreadCount, matches } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="swap"
        options={{
          title: 'Tauschen',
          tabBarIcon: icon('swap-horizontal-outline', 'swap-horizontal'),
          tabBarBadge: matches.length || undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.success },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Nachrichten',
          tabBarIcon: icon('chatbubble-ellipses-outline', 'chatbubble-ellipses'),
          tabBarBadge: unreadCount || undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.primary },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
