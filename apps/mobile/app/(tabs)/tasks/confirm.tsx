import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// ─── Types ────────────────────────────────────────────────────

interface ServiceRequestDetail {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午', afternoon: '下午', evening: '晚上',
};

// ─── Status (brand-aligned, matches provider-tasks/detail) ────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  candidate_proposed:  { label: '待回應', color: colors.warning,      bg: colors.warningLight },
  caregiver_confirmed: { label: '待您確認', color: colors.warning,    bg: colors.warningLight },
  provider_confirmed:  { label: '已確認', color: colors.primaryText,  bg: colors.primaryLight },
  arranged:            { label: '已安排', color: colors.primaryText,  bg: colors.primaryLight },
  in_service:          { label: '服務中', color: colors.secondaryText, bg: colors.accentLight },
  completed:           { label: '已完成', color: colors.success,      bg: colors.successLight },
  cancelled:           { label: '已取消', color: colors.textTertiary,  bg: colors.bgSurfaceAlt },
};

// ─── Service icons + colors (shared with other provider pages) ─

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
function IconCheck() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={colors.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function ProviderConfirmScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [providerNote, setProviderNote] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Provider-specific GET — must use `/provider/tasks/[id]` (allows candidate
      // OR assigned). The generic `/service-requests/[id]` only allows
      // `assigned_provider_id`, so at `caregiver_confirmed` status the provider
      // (still in `candidate_provider_id`) hits 403 "無權存取此服務需求".
      const result = await api.get<ServiceRequestDetail>(`/provider/tasks/${requestId}`);
      setRequest(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleConfirm = (confirm: boolean) => {
    const title = confirm ? '確認接案' : '拒絕接案';
    const message = confirm
      ? '確定接受此服務案件嗎？'
      : '確定拒絕嗎？案件將回到待媒合狀態。';
    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: confirm ? '確認接案' : '確定拒絕',
        style: confirm ? 'default' : 'destructive',
        onPress: async () => {
          setConfirming(true);
          try {
            await api.put(`/service-requests/${requestId}/confirm-provider`, {
              confirm,
              provider_note: providerNote || undefined,
            });
            Alert.alert('完成', confirm ? '已確認接案' : '已拒絕接案', [
              { text: '確定', onPress: () => router.back() },
            ]);
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '操作失敗');
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  if (error || !request) {
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

  const status = STATUS_CONFIG[request.status] ?? { label: request.status, color: colors.textTertiary, bg: colors.bgSurfaceAlt };
  const clr = SERVICE_COLORS[request.category.code] ?? { icon: colors.primary, bg: colors.primaryLight, accent: colors.primaryLight };
  const HeroIcon = SERVICE_ICONS[request.category.code];
  const dateStr = new Date(request.preferred_date).toLocaleDateString('zh-TW');
  const timeStr = request.preferred_time_slot
    ? TIME_SLOT_LABELS[request.preferred_time_slot] ?? request.preferred_time_slot
    : '';

  const canConfirm = request.status === 'caregiver_confirmed';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ─── Hero ─────────────────────────────────────────── */}
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
        <Text style={s.heroName}>{request.category.name}</Text>
        <View style={s.heroMetaRow}>
          <Text style={s.heroRecipient}>{request.recipient.name}</Text>
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
        <InfoRow label="服務類別" value={request.category.name} />
        <InfoRow label="被照護者" value={request.recipient.name} />
        <InfoRow label="期望日期" value={`${dateStr}${timeStr ? ` ${timeStr}` : ''}`} />
        <InfoRow label="服務地點" value={request.location} isLast />
      </View>

      {/* ─── Description ───────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <IconNote />
        <Text style={s.sectionLabel}>需求描述</Text>
      </View>
      <View style={s.card}>
        <Text style={s.descriptionText}>{request.description}</Text>
      </View>

      {/* ─── Confirm/Reject (only if caregiver_confirmed) ──── */}
      {canConfirm && (
        <>
          <View style={s.sectionHeader}>
            <IconNote />
            <Text style={s.sectionLabel}>回覆備註（選填）</Text>
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

          {/* Action buttons row: reject (outlined) | confirm (gradient) */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.rejectBtn, confirming && { opacity: 0.6 }]}
              onPress={() => handleConfirm(false)}
              disabled={confirming}
              activeOpacity={0.7}
            >
              <Text style={s.rejectText}>拒絕接案</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.confirmWrap, confirming && { opacity: 0.6 }]}
              onPress={() => handleConfirm(true)}
              disabled={confirming}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.confirmBtn}
              >
                <IconCheck />
                <Text style={s.confirmText}>{confirming ? '處理中...' : '確認接案'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ─── Inactive state ────────────────────────────────── */}
      {!canConfirm && (
        <View style={s.statusNote}>
          <View style={s.statusNoteIconWrap}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <SvgCircle cx="12" cy="12" r="10" stroke={colors.primary} strokeWidth={1.8} />
              <Path d="M12 8v4M12 16h.01" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={s.statusNoteText}>目前狀態不需要您的操作</Text>
        </View>
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
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl, backgroundColor: colors.bgScreen, gap: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, marginBottom: spacing.sm },
  errorBtnRow: { flexDirection: 'row', gap: spacing.sm },
  errorBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
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
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  statusText: { fontSize: typography.bodySm.fontSize, fontWeight: '700' },
  heroName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroRecipient: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  heroDot: { color: colors.textDisabled, fontSize: typography.bodySm.fontSize },
  heroDate: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },

  // ─── Section header ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm, paddingLeft: spacing.xs,
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
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
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

  // ─── Action row (reject + confirm) ──────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  rejectText: {
    color: colors.textSecondary,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },
  confirmWrap: {
    flex: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
  },
  confirmText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ─── Inactive status note ───────────────────────────────
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  statusNoteIconWrap: {
    width: 36, height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  statusNoteText: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
