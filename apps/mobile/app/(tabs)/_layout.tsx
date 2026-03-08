import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home/index"
        options={{
          title: '首頁',
          tabBarLabel: '首頁',
        }}
      />
      <Tabs.Screen
        name="health/index"
        options={{
          title: '健康',
          tabBarLabel: '健康',
        }}
      />
      <Tabs.Screen name="home/add-recipient" options={{ href: null }} />
      <Tabs.Screen name="home/[recipientId]/index" options={{ href: null }} />
      <Tabs.Screen name="home/[recipientId]/edit" options={{ href: null }} />
      <Tabs.Screen name="health/add-measurement" options={{ href: null }} />
      <Tabs.Screen name="health/trends" options={{ href: null }} />
      <Tabs.Screen name="health/export" options={{ href: null }} />
    </Tabs>
  );
}
