import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// ─── Types ────────────────────────────────────────────────────

interface TaskDetail {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  provider_note: string | null;
  provider_report: ProviderReport | null;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

interface ProviderReport {
  service_date?: string;
  health_data?: {
    blood_pressure?: { systolic: number; diastolic: number };
    heart_rate?: number;
    blood_glucose?: number;
    blood_oxygen?: number;
    height_cm?: number;
    weight_kg?: number;
    body_fat_pct?: number;
    muscle_mass_kg?: number;
    cholesterol?: number;
  };
  medication_notes?: string;
  doctor_instructions?: string;
  next_visit_date?: string;
  additional_notes?: string;
}

// ─── Status mapping (brand-aligned, matches provider-tasks) ───

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  candidate_proposed: { label: '待確認', color: colors.warning,      bg: colors.warningLight },
  provider_confirmed: { label: '已確認', color: colors.primaryText,  bg: colors.primaryLight },
  arranged:           { label: '已安排', color: colors.primaryText,  bg: colors.primaryLight },
  in_service:         { label: '服務中', color: colors.secondaryText, bg: colors.accentLight },
  completed:          { label: '已完成', color: colors.success,      bg: colors.successLight },
  cancelled:          { label: '已取消', color: colors.textTertiary,  bg: colors.bgSurfaceAlt },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

// ─── Service icons + colors (shared with provider-tasks) ──────

const SERVICE_ICONS: Record<string, (props: { size: number; color: string }) => React.ReactElement> = {
  escort_visit: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2v8m-4-4h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x="3" y="14" width="18" height="8" rx="2" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  ),
  functional_assessment: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12h4l3-7 4 14 3-7h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  exercise_program: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="5" r="2.5" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M12 9v5m-3 3l3-3 3 3m-6-5l-2-1m6 1l2-1" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  home_cleaning: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12l9-8 9 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  ),
  pre_visit_consult: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  ),
  daily_living_support: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 11c-1.5 0-3 1-3 3s1.5 3 3 3m10-6c1.5 0 3 1 3 3s-1.5 3-3 3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M12 7v10m-3-5h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
  nutrition_consult: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2c-3 4-6 6-6 10a6 6 0 0012 0c0-4-3-6-6-10z" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M12 16v-4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  ),
  shopping_assist: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M3 6h18M16 10a4 4 0 01-8 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  ),
};

const SERVICE_COLORS: Record<string, { icon: string; bg: string; accent: string }> = {
  escort_visit:          { icon: '#E8707E', bg: '#FFF2F4', accent: '#FFD4DB' },
  functional_assessment: { icon: '#7B71D4', bg: '#F2F0FF', accent: '#DDD8FF' },
  exercise_program:      { icon: '#5BB98B', bg: '#F0F9F3', accent: '#C8ECD6' },
  home_cleaning:         { icon: '#E8A44E', bg: '#FFF8EF', accent: '#FFE4C2' },
  pre_visit_consult:     { icon: '#9B8FD8', bg: '#F5F3FF', accent: '#DDD8FF' },
  daily_living_support:  { icon: '#6BAFCF', bg: '#F0F7FC', accent: '#C8E2F0' },
  nutrition_consult:     { icon: '#6DB88A', bg: '#F0F8F2', accent: '#C8ECD6' },
  shopping_assist:       { icon: '#D4789B', bg: '#FFF0F5', accent: '#FFD4E4' },
};

// ─── Section icons ────────────────────────────────────────────

function IconInfo() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="10" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M12 8h.01M11 12h1v4h1" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconNote() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v6h6M8 13h8M8 17h5" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconHeart() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" stroke={colors.danger} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconStethoscope() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3v6a4 4 0 008 0V3M10 3v0M10 13c0 4 3 6 6 6s6-2 6-6v-2" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <SvgCircle cx="20" cy="9" r="2" stroke={colors.accent} strokeWidth={1.8} />
    </Svg>
  );
}
function IconReport() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="3" width="16" height="18" rx="2" stroke={colors.success} strokeWidth={1.8} />
      <Path d="M9 8h6M9 12h6M9 16h4" stroke={colors.success} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconCalendarSm() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.textTertiary} strokeWidth={1.8} />
      <Path d="M3 9h18M8 3v4M16 3v4" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconPlay() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 3l14 9-14 9V3z" fill={colors.white} />
    </Svg>
  );
}
function IconCheck() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={colors.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function ProviderTaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerNote, setProviderNote] = useState('');

  // Structured report fields (for completion)
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [bloodOxygen, setBloodOxygen] = useState('');
  const [medicationNotes, setMedicationNotes] = useState('');
  const [doctorInstructions, setDoctorInstructions] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<TaskDetail>(`/provider/tasks/${taskId}`);
      setTask(result);
      if (result.provider_note) setProviderNote(result.provider_note);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  function buildProviderReport(): Record<string, unknown> | undefined {
    const healthData: Record<string, unknown> = {};
    if (systolic && diastolic) {
      healthData.blood_pressure = { systolic: Number(systolic), diastolic: Number(diastolic) };
    }
    if (heartRate) healthData.heart_rate = Number(heartRate);
    if (bloodGlucose) healthData.blood_glucose = Number(bloodGlucose);
    if (bloodOxygen) healthData.blood_oxygen = Number(bloodOxygen);

    const report: Record<string, unknown> = {};
    if (Object.keys(healthData).length > 0) report.health_data = healthData;
    if (medicationNotes.trim()) report.medication_notes = medicationNotes.trim();
    if (doctorInstructions.trim()) report.doctor_instructions = doctorInstructions.trim();
    if (nextVisitDate.trim()) report.next_visit_date = nextVisitDate.trim();

    return Object.keys(report).length > 0 ? report : undefined;
  }

  const handleProgress = (nextStatus: 'in_service' | 'completed') => {
    const isStart = nextStatus === 'in_service';
    const title = isStart ? '開始服務' : '完成服務';
    const message = isStart ? '確定要開始此服務嗎？' : '確定已完成此服務嗎？';

    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: title,
        onPress: async () => {
          setSubmitting(true);
          try {
            const payload: Record<string, unknown> = {
              status: nextStatus,
              provider_note: providerNote || undefined,
            };
            if (nextStatus === 'completed') {
              payload.provider_report = buildProviderReport();
            }
            await api.put(`/provider/tasks/${taskId}/progress`, payload);
            Alert.alert('完成', isStart ? '已開始服務' : '服務已完成', [
              { text: '確定', onPress: () => void fetchDetail() },
            ]);
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '操作失敗');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  if (error || !task) {
    return (
      <View style={s.errorContainer}>
        <Text style={s.errorText}>{error || '載入失敗'}</Text>
        <View style={s.errorBtnRow}>
          <TouchableOpacity onPress={() => void fetchDetail()} style={s.errorBtn} activeOpacity={0.7}>
            <Text style={s.errorBtnText}>重試</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={s.errorBtn} activeOpacity={0.7}>
            <Text style={s.errorBtnText}>返回</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const status = STATUS_CONFIG[task.status] ?? { label: task.status, color: colors.textTertiary, bg: colors.bgSurfaceAlt };
  const clr = SERVICE_COLORS[task.category.code] ?? { icon: colors.primary, bg: colors.primaryLight, accent: colors.primaryLight };
  const HeroIcon = SERVICE_ICONS[task.category.code];
  const dateStr = new Date(task.preferred_date).toLocaleDateString('zh-TW');
  const timeStr = task.preferred_time_slot
    ? TIME_SLOT_LABELS[task.preferred_time_slot] ?? task.preferred_time_slot
    : '';

  const dateValue = nextVisitDate ? new Date(nextVisitDate) : new Date();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ─── Hero Card ─────────────────────────────────────── */}
      <View style={s.hero}>
        <LinearGradient
          colors={[clr.bg, '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.heroHaloTopRight} />
        <View style={s.heroHaloBottomLeft} />
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        <View style={s.heroTop}>
          <View style={[s.heroIconCircle, { backgroundColor: clr.accent }]}>
            {HeroIcon ? <HeroIcon size={26} color={clr.icon} /> : null}
          </View>
          <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={s.heroName}>{task.category.name}</Text>
        <View style={s.heroMetaRow}>
          <Text style={s.heroRecipient}>{task.recipient.name}</Text>
          <Text style={s.heroDot}>·</Text>
          <Text style={s.heroDate}>{dateStr}{timeStr ? ` ${timeStr}` : ''}</Text>
        </View>
      </View>

      {/* ─── Case Info ─────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconInfo />
        <Text style={s.sectionLabel}>案件資訊</Text>
      </View>
      <View style={s.card}>
        <InfoRow label="服務類別" value={task.category.name} />
        <InfoRow label="被照護者" value={task.recipient.name} />
        <InfoRow label="服務日期" value={`${dateStr}${timeStr ? ` ${timeStr}` : ''}`} />
        <InfoRow label="服務地點" value={task.location} isLast />
      </View>

      {/* ─── Description ───────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconNote />
        <Text style={s.sectionLabel}>需求描述</Text>
      </View>
      <View style={s.card}>
        <Text style={s.descriptionText}>{task.description}</Text>
      </View>

      {/* ─── Status: arranged → start service ─────────────── */}
      {task.status === 'arranged' && (
        <>
          <View style={s.sectionHeader}>
            <IconNote />
            <Text style={s.sectionLabel}>服務備註（選填）</Text>
          </View>
          <View style={s.card}>
            <TextInput
              style={s.textArea}
              multiline
              numberOfLines={3}
              value={providerNote}
              onChangeText={setProviderNote}
              placeholder="填寫備註，例如預計到達時間..."
              placeholderTextColor={colors.textDisabled}
              textAlignVertical="top"
            />
          </View>
          <TouchableOpacity
            style={[s.actionWrap, submitting && { opacity: 0.6 }]}
            onPress={() => handleProgress('in_service')}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.actionBtn}
            >
              <IconPlay />
              <Text style={s.actionText}>{submitting ? '處理中...' : '開始服務'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ─── Status: in_service → record + complete ───────── */}
      {task.status === 'in_service' && (
        <>
          {/* Health Data */}
          <View style={s.sectionHeader}>
            <IconHeart />
            <Text style={s.sectionLabel}>健康數據紀錄（選填）</Text>
          </View>
          <View style={s.card}>
            {/* BP row — sys + dia side by side */}
            <View style={s.bpRow}>
              <View style={s.bpField}>
                <Text style={s.fieldLabel}>收縮壓</Text>
                <TextInput
                  style={s.inputLarge}
                  value={systolic}
                  onChangeText={setSystolic}
                  keyboardType="numeric"
                  placeholder="120"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={3}
                />
                <Text style={s.unit}>mmHg</Text>
              </View>
              <View style={s.bpField}>
                <Text style={s.fieldLabel}>舒張壓</Text>
                <TextInput
                  style={s.inputLarge}
                  value={diastolic}
                  onChangeText={setDiastolic}
                  keyboardType="numeric"
                  placeholder="80"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={3}
                />
                <Text style={s.unit}>mmHg</Text>
              </View>
            </View>

            {/* HR + BG row */}
            <View style={s.dualRow}>
              <View style={s.dualField}>
                <Text style={s.fieldLabel}>心率</Text>
                <View style={s.inlineInput}>
                  <TextInput
                    style={s.inputSmall}
                    value={heartRate}
                    onChangeText={setHeartRate}
                    keyboardType="numeric"
                    placeholder="72"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={3}
                  />
                  <Text style={s.unitInline}>bpm</Text>
                </View>
              </View>
              <View style={s.dualField}>
                <Text style={s.fieldLabel}>血糖</Text>
                <View style={s.inlineInput}>
                  <TextInput
                    style={s.inputSmall}
                    value={bloodGlucose}
                    onChangeText={setBloodGlucose}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={3}
                  />
                  <Text style={s.unitInline}>mg/dL</Text>
                </View>
              </View>
            </View>

            {/* BO single */}
            <View style={[s.field, { marginBottom: 0 }]}>
              <Text style={s.fieldLabel}>血氧</Text>
              <View style={s.inlineInput}>
                <TextInput
                  style={s.inputSmall}
                  value={bloodOxygen}
                  onChangeText={setBloodOxygen}
                  keyboardType="numeric"
                  placeholder="98"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={3}
                />
                <Text style={s.unitInline}>%</Text>
              </View>
            </View>
          </View>

          {/* Doctor Instructions */}
          <View style={s.sectionHeader}>
            <IconStethoscope />
            <Text style={s.sectionLabel}>醫囑與備註</Text>
          </View>
          <View style={s.card}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>用藥備註</Text>
              <TextInput
                style={s.textArea}
                multiline
                numberOfLines={2}
                value={medicationNotes}
                onChangeText={setMedicationNotes}
                placeholder="選填"
                placeholderTextColor={colors.textDisabled}
                textAlignVertical="top"
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>醫生交辦事項</Text>
              <TextInput
                style={s.textArea}
                multiline
                numberOfLines={2}
                value={doctorInstructions}
                onChangeText={setDoctorInstructions}
                placeholder="選填"
                placeholderTextColor={colors.textDisabled}
                textAlignVertical="top"
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>下次看診日期</Text>
              <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <Text style={[s.dateBtnText, !nextVisitDate && { color: colors.textDisabled }]}>
                  {nextVisitDate
                    ? new Date(nextVisitDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '選擇日期（選填）'}
                </Text>
                <IconCalendarSm />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={dateValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (selected) {
                      const yyyy = selected.getFullYear();
                      const mm = String(selected.getMonth() + 1).padStart(2, '0');
                      const dd = String(selected.getDate()).padStart(2, '0');
                      setNextVisitDate(`${yyyy}-${mm}-${dd}`);
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
              <Text style={s.fieldLabel}>服務備註</Text>
              <TextInput
                style={s.textArea}
                multiline
                numberOfLines={3}
                value={providerNote}
                onChangeText={setProviderNote}
                placeholder="填寫備註..."
                placeholderTextColor={colors.textDisabled}
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[s.actionWrap, submitting && { opacity: 0.6 }]}
            onPress={() => handleProgress('completed')}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.actionBtn}
            >
              <IconCheck />
              <Text style={s.actionText}>{submitting ? '處理中...' : '完成服務'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ─── Status: completed → readonly summary ─────────── */}
      {task.status === 'completed' && (
        <>
          <View style={s.sectionHeader}>
            <IconReport />
            <Text style={s.sectionLabel}>服務報告</Text>
          </View>
          <View style={s.card}>
            {task.provider_report?.health_data ? (
              <View style={s.reportGrid}>
                {task.provider_report.health_data.blood_pressure && (
                  <View style={s.reportItem}>
                    <Text style={s.reportItemLabel}>血壓</Text>
                    <Text style={s.reportItemValue}>
                      {task.provider_report.health_data.blood_pressure.systolic}/{task.provider_report.health_data.blood_pressure.diastolic}
                    </Text>
                    <Text style={s.reportItemUnit}>mmHg</Text>
                  </View>
                )}
                {task.provider_report.health_data.heart_rate != null && (
                  <View style={s.reportItem}>
                    <Text style={s.reportItemLabel}>心率</Text>
                    <Text style={s.reportItemValue}>{task.provider_report.health_data.heart_rate}</Text>
                    <Text style={s.reportItemUnit}>bpm</Text>
                  </View>
                )}
                {task.provider_report.health_data.blood_glucose != null && (
                  <View style={s.reportItem}>
                    <Text style={s.reportItemLabel}>血糖</Text>
                    <Text style={s.reportItemValue}>{task.provider_report.health_data.blood_glucose}</Text>
                    <Text style={s.reportItemUnit}>mg/dL</Text>
                  </View>
                )}
                {task.provider_report.health_data.blood_oxygen != null && (
                  <View style={s.reportItem}>
                    <Text style={s.reportItemLabel}>血氧</Text>
                    <Text style={s.reportItemValue}>{task.provider_report.health_data.blood_oxygen}</Text>
                    <Text style={s.reportItemUnit}>%</Text>
                  </View>
                )}
              </View>
            ) : null}

            {task.provider_report?.medication_notes && (
              <View style={s.summaryBlock}>
                <Text style={s.summaryLabel}>用藥備註</Text>
                <Text style={s.summaryText}>{task.provider_report.medication_notes}</Text>
              </View>
            )}
            {task.provider_report?.doctor_instructions && (
              <View style={s.summaryBlock}>
                <Text style={s.summaryLabel}>醫生交辦事項</Text>
                <Text style={s.summaryText}>{task.provider_report.doctor_instructions}</Text>
              </View>
            )}
            {task.provider_report?.next_visit_date && (
              <View style={s.summaryBlock}>
                <Text style={s.summaryLabel}>下次看診</Text>
                <Text style={s.summaryText}>{task.provider_report.next_visit_date}</Text>
              </View>
            )}
            {task.provider_note && (
              <View style={[s.summaryBlock, { marginBottom: 0 }]}>
                <Text style={s.summaryLabel}>服務備註</Text>
                <Text style={s.summaryText}>{task.provider_note}</Text>
              </View>
            )}

            {!task.provider_report && !task.provider_note && (
              <Text style={s.emptyReport}>此服務無詳細紀錄</Text>
            )}
          </View>
        </>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[s.infoRow, isLast && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  // ─── Error ────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
    gap: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, marginBottom: spacing.sm },
  errorBtnRow: { flexDirection: 'row', gap: spacing.sm },
  errorBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
  },
  errorBtnText: { color: colors.primaryText, fontSize: typography.bodySm.fontSize, fontWeight: '700' },

  // ─── Hero ─────────────────────────────────────────────────
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(46,141,201,0.15)',
    paddingVertical: spacing.lg + 2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  heroHaloTopRight: {
    position: 'absolute', top: -50, right: -50,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  heroHaloBottomLeft: {
    position: 'absolute', bottom: -50, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroIconCircle: {
    width: 52, height: 52,
    borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  statusText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
  },
  heroName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroRecipient: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  heroDot: { color: colors.textDisabled, fontSize: typography.bodySm.fontSize },
  heroDate: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },

  // ─── Section header ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },

  // ─── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // ─── InfoRow ─────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  infoLabel: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },
  infoValue: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    fontWeight: '600',
    maxWidth: '60%' as unknown as number,
    textAlign: 'right',
  },

  // ─── Description ──────────────────────────────────────────
  descriptionText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // ─── Field ────────────────────────────────────────────────
  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // ─── BP Row ──────────────────────────────────────────────
  bpRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  bpField: {
    flex: 1,
    alignItems: 'center',
  },
  inputLarge: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  unit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontWeight: '500',
  },

  // ─── Dual Row (HR + BG) ──────────────────────────────────
  dualRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dualField: { flex: 1 },
  inlineInput: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputSmall: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.headingMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  unitInline: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // ─── TextArea ────────────────────────────────────────────
  textArea: {
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // ─── Date picker ─────────────────────────────────────────
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgScreen,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  dateBtnText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateConfirm: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  dateConfirmText: {
    color: colors.primaryText,
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
  },

  // ─── Action button (gradient) ────────────────────────────
  actionWrap: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
  },
  actionText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ─── Report summary (completed) ──────────────────────────
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reportItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgScreen,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  reportItemLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  reportItemValue: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportItemUnit: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: 1,
  },
  summaryBlock: {
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  summaryText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  emptyReport: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textDisabled,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
