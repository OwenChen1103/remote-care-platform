import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

interface Recipient {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
}

export default function EditRecipientScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [medicalTags, setMedicalTags] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const data = await api.get<Recipient>(`/recipients/${recipientId}`);
      setName(data.name);
      setDateOfBirth(data.date_of_birth ?? '');
      setGender((data.gender as typeof gender) || '');
      setMedicalTags(data.medical_tags.join(', '));
      setEmergencyName(data.emergency_contact_name ?? '');
      setEmergencyPhone(data.emergency_contact_phone ?? '');
      setNotes(data.notes ?? '');
    } catch (e) {
      if (e instanceof ApiError) {
        setFetchError(e.message);
      } else {
        setFetchError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  async function handleSave() {
    if (!name.trim()) {
      setError('姓名為必填');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const data: Record<string, unknown> = { name: name.trim() };
      data.date_of_birth = dateOfBirth.trim() || null;
      data.gender = gender || null;
      data.medical_tags = medicalTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      data.emergency_contact_name = emergencyName.trim() || null;
      data.emergency_contact_phone = emergencyPhone.trim() || null;
      data.notes = notes.trim() || null;

      await api.put(`/recipients/${recipientId}`, data);
      Alert.alert('成功', '已更新被照護者資料', [{ text: '確定', onPress: () => router.back() }]);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('更新失敗，請稍後再試');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchRecipient()}>
          <Text style={styles.retryText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>編輯被照護者</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>姓名 *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例：王奶奶" />

      <Text style={styles.label}>生日</Text>
      <TextInput
        style={styles.input}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="YYYY-MM-DD"
      />

      <Text style={styles.label}>性別</Text>
      <View style={styles.genderRow}>
        {(['male', 'female', 'other'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderButton, gender === g && styles.genderActive]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
              {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>疾病標籤（以逗號分隔）</Text>
      <TextInput
        style={styles.input}
        value={medicalTags}
        onChangeText={setMedicalTags}
        placeholder="例：高血壓,糖尿病"
      />

      <Text style={styles.label}>緊急聯絡人姓名</Text>
      <TextInput style={styles.input} value={emergencyName} onChangeText={setEmergencyName} />

      <Text style={styles.label}>緊急聯絡人電話</Text>
      <TextInput
        style={styles.input}
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>備註</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.submitButton, saving && styles.submitDisabled]}
        onPress={() => void handleSave()}
        disabled={saving}
      >
        <Text style={styles.submitText}>{saving ? '儲存中...' : '儲存'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  genderActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  genderText: { color: '#374151', fontWeight: '500' },
  genderTextActive: { color: '#fff' },
  error: { color: '#dc2626', marginBottom: 12, fontSize: 14 },
  errorText: { fontSize: 16, color: '#dc2626', marginBottom: 12 },
  retryButton: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
