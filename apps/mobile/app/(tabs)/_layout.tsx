import { Tabs } from 'expo-router';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

// ─── Tab Icons (SVG line style, 24×24) ────────────────────────

function TabIconHome({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconHealth({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12h4l3-7 4 14 3-7h6"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconAI({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconService({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconTasks({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 14l2 2 4-4"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconBell({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconUser({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <SvgCircle cx="12" cy="7" r="4"
        stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

function TabIconHeart({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TabIconCalendar({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Tab Layout ───────────────────────────────────────────────

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.role ?? 'caregiver';

  const hidden: { href: null } = { href: null };

  const visibleFor = (...roles: string[]): { href?: null } =>
    roles.includes(role) ? {} : hidden;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderDefault,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 20,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* ─── Caregiver tabs ─── */}
      <Tabs.Screen
        name="home/index"
        options={{
          title: '首頁',
          tabBarLabel: '首頁',
          tabBarIcon: ({ color }) => <TabIconHome color={color} />,
          ...visibleFor('caregiver'),
        }}
      />
      <Tabs.Screen
        name="health/index"
        options={{
          title: '健康',
          tabBarLabel: '健康',
          tabBarIcon: ({ color }) => <TabIconHealth color={color} />,
          ...visibleFor('caregiver'),
        }}
      />
      <Tabs.Screen
        name="ai/index"
        options={{
          title: 'AI 助理',
          tabBarLabel: 'AI 助理',
          tabBarIcon: ({ color }) => <TabIconAI color={color} />,
          ...visibleFor('caregiver'),
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: '服務',
          tabBarLabel: '服務',
          tabBarIcon: ({ color }) => <TabIconService color={color} />,
          ...visibleFor('caregiver'),
        }}
      />

      {/* ─── Provider tabs ─── */}
      <Tabs.Screen
        name="services/provider-tasks"
        options={{
          title: '我的任務',
          tabBarLabel: '任務',
          tabBarIcon: ({ color }) => <TabIconTasks color={color} />,
          ...visibleFor('provider'),
        }}
      />
      <Tabs.Screen
        name="home/notifications"
        options={{
          title: '通知',
          tabBarLabel: '通知',
          tabBarIcon: ({ color }) => <TabIconBell color={color} />,
          ...visibleFor('provider'),
        }}
      />
      <Tabs.Screen
        name="services/provider-profile"
        options={{
          title: '個人資料',
          tabBarLabel: '我的',
          tabBarIcon: ({ color }) => <TabIconUser color={color} />,
          ...visibleFor('provider'),
        }}
      />

      {/* ─── Patient tabs ─── */}
      <Tabs.Screen
        name="patient/summary"
        options={{
          title: '我的健康',
          tabBarLabel: '健康',
          tabBarIcon: ({ color }) => <TabIconHeart color={color} />,
          ...visibleFor('patient'),
        }}
      />
      <Tabs.Screen
        name="patient/schedule"
        options={{
          title: '提醒行程',
          tabBarLabel: '行程',
          tabBarIcon: ({ color }) => <TabIconCalendar color={color} />,
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
      <Tabs.Screen name="home/profile" options={{ href: null, title: '個人資料管理' }} />
      <Tabs.Screen name="home/appointments" options={{ href: null, title: '行程管理' }} />
      <Tabs.Screen name="home/add-appointment" options={{ href: null, title: '新增行程' }} />
    </Tabs>
  );
}
