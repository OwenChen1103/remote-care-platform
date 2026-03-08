import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{
          title: '首頁',
          tabBarLabel: '首頁',
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: '健康',
          tabBarLabel: '健康',
        }}
      />
    </Tabs>
  );
}
