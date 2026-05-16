import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

// Per-tab Stack — pushed (non-index) screens get a minimal nav header so
// users can always exit back. The `index` screen is headerless because
// each tab root has its own in-content custom header (and a `SafeAreaView`
// wrapper inside the screen to handle the status bar inset).
//
// Header style is intentionally bare: no title, no shadow, same background
// as the page — so it visually reads as just a floating back chevron.
const STACK_SCREEN_OPTIONS = {
  headerTitle: '',
  headerBackTitle: '',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bgScreen },
  headerTintColor: colors.textPrimary,
} as const;

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
