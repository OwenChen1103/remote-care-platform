import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

const STACK_SCREEN_OPTIONS = {
  headerTitle: '',
  headerBackTitle: '',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bgScreen },
  headerTintColor: colors.textPrimary,
} as const;

export default function AiStackLayout() {
  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
