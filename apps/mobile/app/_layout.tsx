import { useEffect, useCallback } from 'react';
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      setDefaultFont();
    }
    void onLayoutRootView();
  }, [fontsLoaded, fontError, onLayoutRootView]);

  if (!fontsLoaded && !fontError) {
    return null; // Splash screen still visible
  }

  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
