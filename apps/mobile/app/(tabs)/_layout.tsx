import { Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.role ?? 'caregiver';

  const hidden: { href: null } = { href: null };

  // Helper: show tab only for specific roles
  const visibleFor = (...roles: string[]): { href?: null } =>
    roles.includes(role) ? {} : hidden;

  return (
    <Tabs>
      {/* ─── Caregiver tabs ─── */}
      <Tabs.Screen
        name="home/index"
        options={{
          title: '首頁',
          tabBarLabel: '首頁',
          ...visibleFor('caregiver'),
        }}
      />
      <Tabs.Screen
        name="health/index"
        options={{
          title: '健康',
          tabBarLabel: '健康',
          ...visibleFor('caregiver'),
        }}
      />
      <Tabs.Screen
        name="ai/index"
        options={{
          title: 'AI照護助理',
          tabBarLabel: 'AI照護助理',
          ...visibleFor('caregiver'),
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: '服務',
          tabBarLabel: '服務',
          ...visibleFor('caregiver'),
        }}
      />

      {/* ─── Provider tabs ─── */}
      <Tabs.Screen
        name="services/provider-tasks"
        options={{
          title: '我的任務',
          tabBarLabel: '我的任務',
          ...visibleFor('provider'),
        }}
      />
      <Tabs.Screen
        name="home/notifications"
        options={{
          title: '通知',
          tabBarLabel: '通知',
          ...visibleFor('provider'),
        }}
      />
      <Tabs.Screen
        name="services/provider-profile"
        options={{
          title: '個人資料',
          tabBarLabel: '個人資料',
          ...visibleFor('provider'),
        }}
      />

      {/* ─── Patient tabs ─── */}
      <Tabs.Screen
        name="patient/summary"
        options={{
          title: '我的健康',
          tabBarLabel: '我的健康',
          ...visibleFor('patient'),
        }}
      />
      <Tabs.Screen
        name="patient/schedule"
        options={{
          title: '提醒行程',
          tabBarLabel: '提醒行程',
          ...visibleFor('patient'),
        }}
      />

      {/* ─── Hidden sub-screens (all roles) ─── */}
      <Tabs.Screen name="services/new-request" options={{ href: null, title: '新增服務需求' }} />
      <Tabs.Screen name="services/[requestId]" options={{ href: null, title: '需求詳情' }} />
      <Tabs.Screen name="services/provider-confirm" options={{ href: null, title: '確認接案' }} />
      <Tabs.Screen name="services/provider-task-detail" options={{ href: null, title: '任務詳情' }} />
      <Tabs.Screen name="home/add-recipient" options={{ href: null, title: '新增被照護者' }} />
      <Tabs.Screen name="home/[recipientId]/index" options={{ href: null, title: '被照護者詳情' }} />
      <Tabs.Screen name="home/[recipientId]/edit" options={{ href: null, title: '編輯被照護者' }} />
      <Tabs.Screen name="health/add-measurement" options={{ href: null, title: '新增量測' }} />
      <Tabs.Screen name="health/trends" options={{ href: null, title: '趨勢分析' }} />
      <Tabs.Screen name="health/export" options={{ href: null, title: '匯出紀錄' }} />
      <Tabs.Screen name="health/ai-report" options={{ href: null, title: '安心報' }} />
      <Tabs.Screen name="home/appointments" options={{ href: null, title: '行程管理' }} />
      <Tabs.Screen name="home/add-appointment" options={{ href: null, title: '新增行程' }} />
    </Tabs>
  );
}
