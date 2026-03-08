import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

export default function AddRecipientScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [medicalTags, setMedicalTags] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) {
      setError('姓名為必填');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data: Record<string, unknown> = { name: name.trim() };
      if (dateOfBirth.trim()) data.date_of_birth = dateOfBirth.trim();
      if (gender) data.gender = gender;
      if (medicalTags.trim()) {
        data.medical_tags = medicalTags.split(',').map((t) => t.trim()).filter(Boolean);
      }
      if (emergencyName.trim()) data.emergency_contact_name = emergencyName.trim();
      if (emergencyPhone.trim()) data.emergency_contact_phone = emergencyPhone.trim();
      if (notes.trim()) data.notes = notes.trim();

      await api.post('/recipients', data);
      Alert.alert('成功', '已新增被照護者', [{ text: '確定', onPress: () => router.back() }]);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('新增失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>新增被照護者</Text>

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
        style={[styles.submitButton, loading && styles.submitDisabled]}
        onPress={() => void handleSubmit()}
        disabled={loading}
      >
        <Text style={styles.submitText}>{loading ? '新增中...' : '新增'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
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
