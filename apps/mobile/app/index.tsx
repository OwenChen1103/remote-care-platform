import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    // Land on the auth group's index (welcome screen with brand logo +
    // 登入/註冊 CTA buttons), not directly on /login — first-install users
    // should see the brand before the form.
    return <Redirect href="/(auth)" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
