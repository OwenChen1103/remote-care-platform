/**
 * Add appointment screen (Section 4.2.1).
 *
 * Replaces manual YYYY-MM-DD text entry with two native DateTimePickers (date then time).
 * Date defaults to 7 days from now at 09:00 local. Server stores ISO 8601 (UTC); we send
 * `appointment_date.toISOString()` so backend gets the precise instant including time.
 *
 * UI follows the same hero + section-card pattern as add-recipient.tsx / profile.tsx —
 * gradient hero, iconified section headers, LinearGradient submit button.
 */
import { useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';

// ─── Icons ────────────────────────────────────────────────────

function IconCalendarPlus({ color = colors.primaryText, size = 32 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4M12 13v6M9 16h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconCalendar({ color = colors.primary, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconClock({ color = colors.textTertiary, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconHospital({ color = colors.accent, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21V8l9-5 9 5v13" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 9v6M9 12h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 21v-4h6v4" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconNote({ color = colors.textTertiary, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v6h6M8 13h8M8 17h5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function AddAppointmentScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('');
  const [doctorName, setDoctorName] = useState('');
  // Section 4.2.1: combined date+time as a single Date object. Null → not yet picked.
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '請輸入行程標題');
      return;
    }
    if (!appointmentDate) {
      Alert.alert('提示', '請選擇就診日期與時間');
      return;
    }
    if (!recipientId) {
      Alert.alert('錯誤', '缺少被照護者資訊');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/appointments', {
        recipient_id: recipientId,
        title: title.trim(),
        hospital_name: hospitalName.trim() || undefined,
        department: department.trim() || undefined,
        doctor_name: doctorName.trim() || undefined,
        appointment_date: appointmentDate.toISOString(),
        note: note.trim() || undefined,
      });

      Alert.alert('成功', '行程已新增', [
        { text: '確定', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('錯誤', err.message);
      } else {
        Alert.alert('錯誤', '新增失敗，請稍後再試');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = appointmentDate
    ? appointmentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const formattedTime = appointmentDate
    ? appointmentDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ── Welcome Hero ──────────────────────────────────────── */}
      <View style={s.hero}>
        <LinearGradient
          colors={['#E5F2FB', '#EDF7E8', '#F8FAFC']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.heroHaloTopRight} />
        <View style={s.heroHaloBottomLeft} />
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        <View style={s.heroContent}>
          <View style={s.heroIconWrap}>
            <IconCalendarPlus />
          </View>
          <Text style={s.heroTitle}>新增就醫行程</Text>
          <Text style={s.heroSubtitle}>為被照護者安排回診時間與醫療資訊</Text>
        </View>
      </View>

      {/* ── Section: 行程資訊 ────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconCalendar />
        <Text style={s.sectionTitle}>行程資訊</Text>
      </View>
      <View style={s.card}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>行程標題 <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="例：台大醫院回診"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>就診日期 <Text style={s.required}>*</Text></Text>
          <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <View style={s.dateRow}>
              <Text style={[s.inputText, !formattedDate && { color: colors.textDisabled }]}>
                {formattedDate || '選擇日期'}
              </Text>
              <IconCalendar size={18} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={appointmentDate ?? (() => {
                const d = new Date();
                d.setDate(d.getDate() + 7);
                d.setHours(9, 0, 0, 0);
                return d;
              })()}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selected) {
                  // Preserve existing time if user already picked one; otherwise default to 09:00.
                  const next = appointmentDate ? new Date(appointmentDate) : new Date();
                  next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                  if (!appointmentDate) next.setHours(9, 0, 0, 0);
                  setAppointmentDate(next);
                }
              }}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity style={s.dateConfirm} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
              <Text style={s.dateConfirmText}>完成</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>就診時間 <Text style={s.required}>*</Text></Text>
          <TouchableOpacity
            style={[s.input, !appointmentDate && s.inputDisabled]}
            onPress={() => appointmentDate && setShowTimePicker(true)}
            activeOpacity={0.7}
            disabled={!appointmentDate}
          >
            <View style={s.dateRow}>
              <Text style={[s.inputText, !formattedTime && { color: colors.textDisabled }]}>
                {formattedTime || '請先選擇日期'}
              </Text>
              <IconClock size={18} />
            </View>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={appointmentDate ?? new Date()}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowTimePicker(false);
                if (selected && appointmentDate) {
                  const next = new Date(appointmentDate);
                  next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                  setAppointmentDate(next);
                }
              }}
            />
          )}
          {Platform.OS === 'ios' && showTimePicker && (
            <TouchableOpacity style={s.dateConfirm} onPress={() => setShowTimePicker(false)} activeOpacity={0.7}>
              <Text style={s.dateConfirmText}>完成</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Section: 醫療資訊 ────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconHospital />
        <Text style={s.sectionTitle}>醫療資訊</Text>
      </View>
      <View style={s.card}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>醫院名稱</Text>
          <TextInput
            style={s.input}
            value={hospitalName}
            onChangeText={setHospitalName}
            placeholder="例：台大醫院"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>科別</Text>
          <TextInput
            style={s.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="例：心臟內科"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={[s.field, { marginBottom: 0 }]}>
          <Text style={s.fieldLabel}>醫師姓名</Text>
          <TextInput
            style={s.input}
            value={doctorName}
            onChangeText={setDoctorName}
            placeholder="例：陳醫師"
            placeholderTextColor={colors.textDisabled}
          />
        </View>
      </View>

      {/* ── Section: 備註 ────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconNote />
        <Text style={s.sectionTitle}>備註</Text>
      </View>
      <View style={s.card}>
        <View style={[s.field, { marginBottom: 0 }]}>
          <TextInput
            style={[s.input, s.textArea]}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            placeholder="其他備註事項，例如：需要陪同、空腹等..."
            placeholderTextColor={colors.textDisabled}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* ── Submit ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.submitWrap, submitting && { opacity: 0.6 }]}
        onPress={() => void handleSubmit()}
        disabled={submitting}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={submitting ? '新增中' : '新增行程'}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.submitBtn}
        >
          <Text style={s.submitText}>{submitting ? '新增中...' : '完成新增'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },

  // Hero
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.12)',
    marginBottom: spacing.sm,
  },
  heroHaloTopRight: {
    position: 'absolute',
    top: -40, right: -50,
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroHaloBottomLeft: {
    position: 'absolute',
    bottom: -50, left: -30,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroContent: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: 'rgba(46,141,201,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTitle: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // Field
  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  required: { color: colors.danger },
  input: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    minHeight: 46,
    justifyContent: 'center',
  },
  inputText: { fontSize: typography.bodyMd.fontSize, color: colors.textPrimary },
  inputDisabled: {
    opacity: 0.45,
    backgroundColor: colors.bgSurfaceAlt,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Date picker confirm (iOS)
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: { color: colors.primaryText, fontSize: typography.captionSm.fontSize, fontWeight: '600' },

  // Submit
  submitWrap: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtn: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
