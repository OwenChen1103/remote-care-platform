import { useEffect, useCallback, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  NotoSansTC_300Light,
  NotoSansTC_400Regular,
  NotoSansTC_500Medium,
  NotoSansTC_700Bold,
} from '@expo-google-fonts/noto-sans-tc';
import { AuthProvider } from '@/lib/auth-context';

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// Set default font for ALL Text and TextInput components globally
function setDefaultFont() {
  const fontFamily = 'NotoSansTC_400Regular';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textProto = (Text as any);
  const origTextRender = textProto.render;
  if (origTextRender) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textProto.render = function (props: Record<string, unknown>, ref: unknown) {
      return origTextRender.call(this, {
        ...props,
        style: [{ fontFamily }, props.style],
      }, ref);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputProto = (TextInput as any);
  const origInputRender = inputProto.render;
  if (origInputRender) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputProto.render = function (props: Record<string, unknown>, ref: unknown) {
      return origInputRender.call(this, {
        ...props,
        style: [{ fontFamily }, props.style],
      }, ref);
    };
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansTC_300Light,
    NotoSansTC_400Regular,
    NotoSansTC_500Medium,
    NotoSansTC_700Bold,
  });
  // Safety net: regardless of font loading state, force-hide the splash after
  // 8 seconds. Without this, a stuck `useFonts` call (or any pre-render hang)
  // would leave the user stranded on the native splash with no feedback —
  // testers have reported this happening for over a minute on cold installs.
  // 8s is a generous buffer over the ~1-2s typical startup; healthy launches
  // never hit this timeout. When it does fire we accept the system fallback
  // font for a beat until NotoSansTC catches up.
  const [splashForceTimedOut, setSplashForceTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setSplashForceTimedOut(true);
      void SplashScreen.hideAsync();
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError || splashForceTimedOut) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, splashForceTimedOut]);

  useEffect(() => {
    if (fontsLoaded) {
      setDefaultFont();
    }
    void onLayoutRootView();
  }, [fontsLoaded, fontError, onLayoutRootView]);

  if (!fontsLoaded && !fontError && !splashForceTimedOut) {
    return null; // Splash screen still visible
  }

  return (
    <AuthProvider>
      {/* Default headerShown: false covers the bare `index` route (auth-gate
          spinner) and any future top-level route — without it, a Stack-default
          header showing the segment name (e.g. "index") flashes during auth
          loading. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
