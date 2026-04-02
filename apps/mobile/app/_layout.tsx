import { useEffect, useCallback } from 'react';
import { Text, TextInput, Platform } from 'react-native';
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

  // Override Text default style
  const origTextRender = (Text as any).render;
  if (origTextRender) {
    (Text as any).render = function (props: any, ref: any) {
      return origTextRender.call(this, {
        ...props,
        style: [{ fontFamily }, props.style],
      }, ref);
    };
  } else {
    // Fallback: override defaultProps
    (Text as any).defaultProps = (Text as any).defaultProps || {};
    (Text as any).defaultProps.style = [{ fontFamily }, (Text as any).defaultProps.style];
  }

  // Override TextInput default style
  const origInputRender = (TextInput as any).render;
  if (origInputRender) {
    (TextInput as any).render = function (props: any, ref: any) {
      return origInputRender.call(this, {
        ...props,
        style: [{ fontFamily }, props.style],
      }, ref);
    };
  } else {
    (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
    (TextInput as any).defaultProps.style = [{ fontFamily }, (TextInput as any).defaultProps.style];
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
