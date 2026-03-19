import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api, ApiError } from '@/lib/api-client';

interface ProviderProfile {
  id: string;
  name: string;
  review_status: string;
  level: string;
  phone: string;
  email: string;
  experience_years: number;
  specialties: string[];
  service_areas: string[];
  availability_status: string;
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '審核中',
  approved: '已核准',
  rejected: '未通過',
};

const AVAILABILITY_OPTIONS: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'available', label: '可接案', color: '#15803D', bg: '#DCFCE7' },
  { key: 'busy', label: '忙碌中', color: '#C2410C', bg: '#FFEDD5' },
  { key: 'offline', label: '離線', color: '#6B7280', bg: '#F3F4F6' },
];

export default function ProviderProfileScreen() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ProviderProfile>('/provider/me');
      setProfile(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleAvailability = async (status: string) => {
    if (!profile || profile.availability_status === status) return;
    setUpdating(true);
    try {
      const result = await api.put<ProviderProfile>('/provider/me', {
        availability_status: status,
      });
      setProfile(result);
    } catch (e) {
      if (e instanceof ApiError) Alert.alert('錯誤', e.message);
      else Alert.alert('錯誤', '更新失敗');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  if (error || !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => void fetchProfile()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本資訊</Text>
        <InfoRow label="姓名" value={profile.name} />
        <InfoRow
          label="審核狀態"
          value={REVIEW_STATUS_LABELS[profile.review_status] ?? profile.review_status}
        />
        <InfoRow label="等級" value={profile.level} />
        <InfoRow label="電話" value={profile.phone} />
        <InfoRow label="信箱" value={profile.email} />
        <InfoRow label="經驗年數" value={`${profile.experience_years} 年`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>專長項目</Text>
        <View style={styles.tagRow}>
          {profile.specialties.length > 0 ? (
            profile.specialties.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyTag}>尚未設定</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服務地區</Text>
        <View style={styles.tagRow}>
          {profile.service_areas.length > 0 ? (
            profile.service_areas.map((a) => (
              <View key={a} style={styles.tag}>
                <Text style={styles.tagText}>{a}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyTag}>尚未設定</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>接案狀態</Text>
        <View style={styles.availabilityRow}>
          {AVAILABILITY_OPTIONS.map((opt) => {
            const isActive = profile.availability_status === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.availabilityCard,
                  { backgroundColor: opt.bg },
                  isActive && styles.availabilityCardActive,
                  isActive && { borderColor: opt.color },
                ]}
                onPress={() => void handleAvailability(opt.key)}
                disabled={updating}
              >
                <Text
                  style={[
                    styles.availabilityLabel,
                    { color: opt.color },
                    isActive && styles.availabilityLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#DC2626', fontSize: 14, marginBottom: 8 },
  retryText: { color: '#2563EB', fontSize: 14, textDecorationLine: 'underline' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    maxWidth: '60%' as unknown as number,
    textAlign: 'right',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { color: '#1D4ED8', fontSize: 13, fontWeight: '500' },
  emptyTag: { color: '#9CA3AF', fontSize: 14 },
  availabilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  availabilityCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  availabilityCardActive: {
    borderWidth: 2,
  },
  availabilityLabel: { fontSize: 14, fontWeight: '500' },
  availabilityLabelActive: { fontWeight: '700' },
});
