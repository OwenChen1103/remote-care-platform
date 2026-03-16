import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

interface Recipient {
  id: string;
  name: string;
}

interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
}

const TIME_SLOTS = [
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

export default function NewServiceRequestScreen() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [recipientId, setRecipientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recipientResult, categoryResult] = await Promise.all([
        api.get<Recipient[]>('/recipients'),
        api.get<ServiceCategory[]>('/service-categories'),
      ]);
      setRecipients(recipientResult);
      setCategories(categoryResult);
      if (recipientResult[0]) setRecipientId(recipientResult[0].id);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!recipientId || !categoryId || !preferredDate || !location || !description) {
      Alert.alert('提示', '請填寫所有必填欄位');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/service-requests', {
        recipient_id: recipientId,
        category_id: categoryId,
        preferred_date: new Date(preferredDate).toISOString(),
        preferred_time_slot: timeSlot || undefined,
        location,
        description,
      });
      Alert.alert('成功', '服務需求已送出', [
        { text: '確定', onPress: () => router.back() },
      ]);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Recipient Selection */}
      <Text style={styles.label}>被照護者 *</Text>
      <View style={styles.chipRow}>
        {recipients.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.chip, recipientId === r.id && styles.chipActive]}
            onPress={() => setRecipientId(r.id)}
          >
            <Text style={[styles.chipText, recipientId === r.id && styles.chipTextActive]}>
              {r.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Selection */}
      <Text style={styles.label}>服務類別 *</Text>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryCard, categoryId === cat.id && styles.categoryCardActive]}
            onPress={() => setCategoryId(cat.id)}
          >
            <Text
              style={[
                styles.categoryName,
                categoryId === cat.id && styles.categoryNameActive,
              ]}
            >
              {cat.name}
            </Text>
            {cat.description && (
              <Text style={styles.categoryDesc} numberOfLines={2}>
                {cat.description}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Preferred Date */}
      <Text style={styles.label}>期望日期 * (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={preferredDate}
        onChangeText={setPreferredDate}
        placeholder="2026-04-01"
        placeholderTextColor="#9CA3AF"
      />

      {/* Time Slot */}
      <Text style={styles.label}>時段（選填）</Text>
      <View style={styles.chipRow}>
        {TIME_SLOTS.map((slot) => (
          <TouchableOpacity
            key={slot.value}
            style={[styles.chip, timeSlot === slot.value && styles.chipActive]}
            onPress={() => setTimeSlot(timeSlot === slot.value ? '' : slot.value)}
          >
            <Text style={[styles.chipText, timeSlot === slot.value && styles.chipTextActive]}>
              {slot.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Location */}
      <Text style={styles.label}>服務地點 *</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="台北市信義區..."
        placeholderTextColor="#9CA3AF"
      />

      {/* Description */}
      <Text style={styles.label}>需求描述 *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="請描述您的服務需求..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={() => void handleSubmit()}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>{submitting ? '送出中...' : '送出需求'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#DC2626', fontSize: 14 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 14, color: '#6B7280' },
  chipTextActive: { color: '#2563EB', fontWeight: '500' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48%' as unknown as number,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  categoryCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  categoryNameActive: { color: '#2563EB' },
  categoryDesc: { fontSize: 12, color: '#9CA3AF' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  textArea: { minHeight: 100 },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
