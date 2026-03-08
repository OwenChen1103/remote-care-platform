import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, ApiError } from '@/lib/api-client';

interface Recipient {
  id: string;
  name: string;
}

type MeasurementType = 'blood_pressure' | 'blood_glucose';

export default function ExportScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [type, setType] = useState<MeasurementType>('blood_pressure');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecipients = useCallback(async () => {
    try {
      const result = await api.get<Recipient[]>('/recipients');
      setRecipients(result);
      const first = result[0];
      if (first) {
        setSelectedRecipientId(first.id);
      }
    } catch {
      setError('載入被照護者失敗');
    }
  }, []);

  useEffect(() => {
    void fetchRecipients();
    // Default date range: last 7 days
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(now.toISOString().slice(0, 10));
  }, [fetchRecipients]);

  async function handleGenerate() {
    if (!selectedRecipientId || !fromDate || !toDate) {
      setError('請選擇被照護者與日期範圍');
      return;
    }

    setLoading(true);
    setError('');
    setText('');

    try {
      const result = await api.get<{ text: string }>(
        `/measurements/export?recipient_id=${selectedRecipientId}&type=${type}&from=${fromDate}T00:00:00Z&to=${toDate}T23:59:59Z`,
      );
      setText(result.text);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('產生摘要失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(text);
  }

  async function handleShare() {
    await Share.share({ message: text });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>匯出分享</Text>

      {/* Recipient selector */}
      {recipients.length > 0 && (
        <View style={styles.chipRow}>
          {recipients.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, r.id === selectedRecipientId && styles.chipActive]}
              onPress={() => setSelectedRecipientId(r.id)}
            >
              <Text style={[styles.chipText, r.id === selectedRecipientId && styles.chipTextActive]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Type selector */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_pressure' && styles.toggleActive]}
          onPress={() => setType('blood_pressure')}
        >
          <Text style={[styles.toggleText, type === 'blood_pressure' && styles.toggleTextActive]}>血壓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, type === 'blood_glucose' && styles.toggleActive]}
          onPress={() => setType('blood_glucose')}
        >
          <Text style={[styles.toggleText, type === 'blood_glucose' && styles.toggleTextActive]}>血糖</Text>
        </TouchableOpacity>
      </View>

      {/* Date range */}
      <Text style={styles.label}>起始日期</Text>
      <TextInput
        style={styles.input}
        value={fromDate}
        onChangeText={setFromDate}
        placeholder="YYYY-MM-DD"
      />

      <Text style={styles.label}>結束日期</Text>
      <TextInput
        style={styles.input}
        value={toDate}
        onChangeText={setToDate}
        placeholder="YYYY-MM-DD"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.generateButton, loading && styles.buttonDisabled]}
        onPress={() => void handleGenerate()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateText}>產生摘要</Text>
        )}
      </TouchableOpacity>

      {/* Preview */}
      {text ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{text}</Text>
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareButton} onPress={() => void handleCopy()}>
              <Text style={styles.shareButtonText}>複製</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={() => void handleShare()}>
              <Text style={styles.shareButtonText}>分享</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  toggleButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#e5e7eb', alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#3b82f6' },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, padding: 12, fontSize: 16,
  },
  error: { color: '#dc2626', marginTop: 8, fontSize: 14 },
  generateButton: {
    backgroundColor: '#3b82f6', borderRadius: 8, padding: 16,
    alignItems: 'center', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  generateText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  previewBox: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  previewText: { fontSize: 14, color: '#1f2937', lineHeight: 22 },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shareButton: {
    flex: 1, backgroundColor: '#dbeafe', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  shareButtonText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
});
