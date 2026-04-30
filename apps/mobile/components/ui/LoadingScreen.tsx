import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '@/lib/theme';

interface LoadingScreenProps {
  message?: string;
  hideMessage?: boolean;
}

const LOGO_SIZE = 100;
const BAR_WIDTH = 140;
const BAR_HEIGHT = 3;
const SHIMMER_WIDTH = 70;

/**
 * Minimal, elegant loading screen.
 * Static logo + a thin progress bar with gradient shimmer sweeping across.
 */
export function LoadingScreen({ message = '載入中', hideMessage = false }: LoadingScreenProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_WIDTH, BAR_WIDTH],
  });

  return (
    <LinearGradient colors={['#F8FAFC', '#E5F2FB', '#F8FAFC']} locations={[0, 0.5, 1]} style={styles.container}>
      <View style={styles.center}>

        {/* Logo (static) */}
        <Image
          source={require('@/assets/images/whocares-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Animated gradient bar */}
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.shimmerWrap,
              { transform: [{ translateX }] },
            ]}
          >
            <LinearGradient
              colors={['transparent', colors.primary, colors.accent, 'transparent']}
              locations={[0, 0.4, 0.6, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmer}
            />
          </Animated.View>
        </View>

        {/* Message */}
        {!hideMessage && <Text style={styles.message}>{message}</Text>}

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: spacing.xl + spacing.sm,
  },

  // Bar
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    backgroundColor: colors.primaryLight,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  shimmerWrap: {
    width: SHIMMER_WIDTH,
    height: BAR_HEIGHT,
  },
  shimmer: {
    flex: 1,
  },

  // Message
  message: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    letterSpacing: 2,
  },
});
