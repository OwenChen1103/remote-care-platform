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
      <Tabs.Screen
        name="ai/index"
        options={{
          title: '安心報',
          tabBarLabel: '安心報',
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: '服務',
          tabBarLabel: '服務',
        }}
      />
      <Tabs.Screen name="services/new-request" options={{ href: null, title: '新增服務需求' }} />
      <Tabs.Screen name="services/[requestId]" options={{ href: null, title: '需求詳情' }} />
      <Tabs.Screen name="services/provider-confirm" options={{ href: null, title: '確認接案' }} />
      <Tabs.Screen name="home/notifications" options={{ href: null, title: '通知' }} />
      <Tabs.Screen name="home/add-recipient" options={{ href: null, title: '新增被照護者' }} />
      <Tabs.Screen name="home/[recipientId]/index" options={{ href: null, title: '被照護者詳情' }} />
      <Tabs.Screen name="home/[recipientId]/edit" options={{ href: null, title: '編輯被照護者' }} />
      <Tabs.Screen name="health/add-measurement" options={{ href: null, title: '新增量測' }} />
      <Tabs.Screen name="health/trends" options={{ href: null, title: '趨勢分析' }} />
      <Tabs.Screen name="health/export" options={{ href: null, title: '匯出紀錄' }} />
      <Tabs.Screen name="health/ai-report" options={{ href: null, title: '安心報' }} />
    </Tabs>
  );
}
