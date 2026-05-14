/**
 * Edit appointment screen (Section 4.2.2).
 *
 * Reads existing appointment via GET /appointments/[id] (added in Phase 2 Section 4),
 * prefills the form, submits via PUT /appointments/[id]. DELETE via danger zone.
 *
 * UI mirrors add-appointment.tsx exactly + appends a 危險區域 delete section
 * (consistent with recipient edit page pattern).
 */
import { useEffect, useState, useCallback } from 'react';
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
import { LoadingScreen } from '@/components/ui/LoadingScreen';

interface Appointment {
  id: string;
  recipient_id: string;
  title: string;
  hospital_name: string | null;
  department: string | null;
  doctor_name: string | null;
  appointment_date: string;
  note: string | null;
}

// ─── Icons ────────────────────────────────────────────────────

function IconCalendarEdit({ color = colors.primaryText, size = 32 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M11 17l5-5 2 2-5 5h-2v-2z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
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

export default function EditAppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [title, setTitle] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchAppointment = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const data = await api.get<Appointment>(`/appointments/${id}`);
      setTitle(data.title);
      setHospitalName(data.hospital_name ?? '');
      setDepartment(data.department ?? '');
      setDoctorName(data.doctor_name ?? '');
      setAppointmentDate(new Date(data.appointment_date));
      setNote(data.note ?? '');
    } catch (e) {
      setFetchError(e instanceof ApiError ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAppointment();
  }, [fetchAppointment]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '請輸入行程標題');
      return;
    }
    if (!appointmentDate) {
      Alert.alert('提示', '請選擇就診日期與時間');
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/appointments/${id}`, {
        title: title.trim(),
        hospital_name: hospitalName.trim() || null,
        department: department.trim() || null,
        doctor_name: doctorName.trim() || null,
        appointment_date: appointmentDate.toISOString(),
        note: note.trim() || null,
      });

      Alert.alert('成功', '行程已更新', [
        { text: '確定', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('錯誤', err.message);
      } else {
        Alert.alert('錯誤', '更新失敗，請稍後再試');
      }
    } finally {
      setSubmitting(false);
    }
  };

  function confirmDelete() {
    Alert.alert(
      '刪除行程',
      `確定要刪除「${title || '此行程'}」？此動作無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/appointments/${id}`);
              Alert.alert('已刪除', '行程已從列表移除', [
                { text: '確定', onPress: () => router.back() },
              ]);
            } catch (e) {
              Alert.alert('錯誤', e instanceof ApiError ? e.message : '刪除失敗');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) return <LoadingScreen />;

  if (fetchError) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{fetchError}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => void fetchAppointment()} activeOpacity={0.7}>
          <Text style={s.retryBtnText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formattedDate = appointmentDate
    ? appointmentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const formattedTime = appointmentDate
    ? appointmentDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ── Hero ──────────────────────────────────────────────── */}
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
            <IconCalendarEdit />
          </View>
          <Text style={s.heroTitle}>編輯就醫行程</Text>
          <Text style={s.heroSubtitle}>更新時間、醫療資訊或備註</Text>
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
              value={appointmentDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selected) {
                  const next = appointmentDate ? new Date(appointmentDate) : new Date();
                  next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
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
        accessibilityLabel={submitting ? '儲存中' : '儲存變更'}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.submitBtn}
        >
          <Text style={s.submitText}>{submitting ? '儲存中...' : '儲存變更'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Danger Zone ──────────────────────────────────────── */}
      <View style={s.dangerZone}>
        <Text style={s.dangerLabel}>危險區域</Text>
        <TouchableOpacity
          style={[s.deleteBtn, deleting && { opacity: 0.6 }]}
          onPress={confirmDelete}
          activeOpacity={0.85}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="刪除行程"
        >
          <Text style={s.deleteBtnText}>{deleting ? '刪除中...' : '刪除行程'}</Text>
        </TouchableOpacity>
        <Text style={s.dangerHint}>刪除後此筆行程將從列表移除，無法復原。</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] + spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },

  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryBtnText: { color: colors.white, fontWeight: '600' },

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

  // Danger zone — mirrors recipient edit page pattern
  dangerZone: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
  },
  dangerLabel: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '700',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  deleteBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
  },
  dangerHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
