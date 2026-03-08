import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  created_at: string;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchRecipients()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>你好，{user?.name ?? ''}！</Text>

      {recipients.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>尚無被照護者，請點擊右下角新增。</Text>
        </View>
      ) : (
        <FlatList
          data={recipients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(tabs)/home/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.date_of_birth && (
                  <Text style={styles.cardAge}>{calculateAge(item.date_of_birth)} 歲</Text>
                )}
              </View>
              {item.medical_tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {item.medical_tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/home/add-recipient')}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  welcome: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, paddingBottom: 8 },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardName: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  cardAge: { fontSize: 14, color: '#6b7280', marginLeft: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#dbeafe', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 12, color: '#1d4ed8' },
  emptyText: { fontSize: 16, color: '#9ca3af', textAlign: 'center' },
  errorText: { fontSize: 16, color: '#dc2626', marginBottom: 12 },
  retryButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
