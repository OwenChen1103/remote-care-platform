import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
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
  admin_note: string | null;
  provider_note: string | null;
  caregiver_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
  assigned_provider: ProviderInfo | null;
  candidate_provider: ProviderInfo | null;
  provider_report: Record<string, unknown> | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  phone: string | null;
  photo_url: string | null;
  level: string;
  specialties: string[];
  certifications: string[];
  experience_years: number | null;
  service_areas: string[];
}

// ─── Status — brand-aligned ───────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted:           { label: '已送出', color: colors.primaryText, bg: colors.primaryLight },
  screening:           { label: '審核中', color: colors.warning,    bg: colors.warningLight },
  candidate_proposed:  { label: '已推薦', color: colors.primaryText, bg: colors.primaryLight },
  caregiver_confirmed: { label: '家屬確認', color: colors.primaryText, bg: colors.primaryLight },
  provider_confirmed:  { label: '服務者確認', color: colors.secondaryText, bg: colors.accentLight },
  arranged:            { label: '已安排', color: colors.secondaryText, bg: colors.accentLight },
  in_service:          { label: '服務中', color: colors.secondaryText, bg: colors.accentLight },
  completed:           { label: '已完成', color: colors.success,    bg: colors.successLight },
  cancelled:           { label: '已取消', color: colors.textTertiary, bg: colors.bgSurfaceAlt },
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

const CANCELLABLE = [
  'submitted',
  'screening',
  'candidate_proposed',
  'caregiver_confirmed',
  'provider_confirmed',
  'arranged',
  'in_service',
];

// ─── Service icons + colors (shared with services/index) ──────

const SERVICE_CLR: Record<string, { icon: string; bg: string; accent: string }> = {
  escort_visit:          { icon: '#E8707E', bg: '#FFF2F4', accent: '#FFD4DB' },
  functional_assessment: { icon: '#7B71D4', bg: '#F2F0FF', accent: '#DDD8FF' },
  exercise_program:      { icon: '#5BB98B', bg: '#F0F9F3', accent: '#C8ECD6' },
  home_cleaning:         { icon: '#E8A44E', bg: '#FFF8EF', accent: '#FFE4C2' },
  pre_visit_consult:     { icon: '#9B8FD8', bg: '#F5F3FF', accent: '#DDD8FF' },
  daily_living_support:  { icon: '#6BAFCF', bg: '#F0F7FC', accent: '#C8E2F0' },
  nutrition_consult:     { icon: '#6DB88A', bg: '#F0F8F2', accent: '#C8ECD6' },
  shopping_assist:       { icon: '#D4789B', bg: '#FFF0F5', accent: '#FFD4E4' },
};

const SERVICE_ICON: Record<string, (props: { size: number; color: string }) => React.ReactElement> = {
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

// ─── Section icons ────────────────────────────────────────────

function IconRoute() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="6" cy="19" r="3" stroke={colors.primary} strokeWidth={1.8} />
      <SvgCircle cx="18" cy="5" r="3" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M9 19h5a4 4 0 000-8h-4a4 4 0 010-8h6" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
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
function IconUser() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="8" r="4" stroke={colors.accent} strokeWidth={1.8} />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconStar() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke={colors.warning} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconShield() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function ServiceRequestDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ServiceRequestDetail>(`/service-requests/${requestId}`);
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

  const handleCancel = () => {
    Alert.alert('確認取消', '確定要取消此服務需求嗎？', [
      { text: '返回', style: 'cancel' },
      {
        text: '確定取消',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.put(`/service-requests/${requestId}/cancel`, {});
            await fetchDetail();
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '取消失敗');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleCaregiverConfirm = (confirm: boolean) => {
    const title = confirm ? '確認候選服務人員' : '拒絕候選服務人員';
    const message = confirm
      ? `確定同意「${request?.candidate_provider?.name}」為您服務嗎？`
      : '確定拒絕候選人嗎？系統將重新為您媒合。';
    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: confirm ? '確認同意' : '確定拒絕',
        style: confirm ? 'default' : 'destructive',
        onPress: async () => {
          setConfirming(true);
          try {
            await api.put(`/service-requests/${requestId}/confirm-caregiver`, { confirm });
            await fetchDetail();
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
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.linkText}>返回列表</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = STATUS_CONFIG[request.status] ?? {
    label: request.status,
    color: colors.textTertiary,
    bg: colors.bgSurfaceAlt,
  };
  const canCancel = CANCELLABLE.includes(request.status);
  const clr = SERVICE_CLR[request.category.code] ?? { icon: colors.primary, bg: colors.primaryLight, accent: colors.primaryLight };
  const HeroIcon = SERVICE_ICON[request.category.code];
  const dateStr = new Date(request.preferred_date).toLocaleDateString('zh-TW');
  const timeStr = request.preferred_time_slot
    ? TIME_SLOT_LABELS[request.preferred_time_slot] ?? request.preferred_time_slot
    : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Hero Card — service category + status ───────── */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[clr.bg, '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroHaloTopRight} />
        <View style={styles.heroHaloBottomLeft} />
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        <View style={styles.heroTop}>
          <View style={[styles.heroIconCircle, { backgroundColor: clr.accent }]}>
            {HeroIcon ? <HeroIcon size={26} color={clr.icon} /> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.heroName}>{request.category.name}</Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroRecipient}>{request.recipient.name}</Text>
          <Text style={styles.heroDot}>·</Text>
          <Text style={styles.heroDate}>{dateStr}{timeStr ? ` ${timeStr}` : ''}</Text>
        </View>
      </View>

      {/* ─── Timeline ────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <IconRoute />
        <Text style={styles.sectionLabel}>進度時間軸</Text>
      </View>
      <View style={styles.card}>
        <StatusTimeline request={request} />
      </View>

      {/* ─── Service Info ────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <IconInfo />
        <Text style={styles.sectionLabel}>服務資訊</Text>
      </View>
      <View style={styles.card}>
        <InfoRow label="服務類別" value={request.category.name} />
        <InfoRow label="被照護者" value={request.recipient.name} />
        <InfoRow label="期望日期" value={`${dateStr}${timeStr ? ` ${timeStr}` : ''}`} />
        <InfoRow label="服務地點" value={request.location} isLast />
      </View>

      {/* ─── Description ─────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <IconNote />
        <Text style={styles.sectionLabel}>需求描述</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.descriptionText}>{request.description}</Text>
      </View>

      {/* ─── Assigned Provider ───────────────────────────── */}
      {request.assigned_provider && (
        <>
          <View style={styles.sectionHeader}>
            <IconUser />
            <Text style={styles.sectionLabel}>指派服務者</Text>
          </View>
          <View style={styles.card}>
            <ProviderCard provider={request.assigned_provider} />
          </View>
        </>
      )}

      {/* ─── Candidate Provider — confirm/reject ─────────── */}
      {request.candidate_provider && request.status === 'candidate_proposed' && (
        <>
          <View style={styles.sectionHeader}>
            <IconStar />
            <Text style={styles.sectionLabel}>候選服務人員</Text>
          </View>
          <View style={styles.card}>
            <ProviderCard provider={request.candidate_provider} />
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.rejectButton, confirming && { opacity: 0.6 }]}
                onPress={() => handleCaregiverConfirm(false)}
                disabled={confirming}
                activeOpacity={0.7}
              >
                <Text style={styles.rejectButtonText}>拒絕候選</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButtonWrap, confirming && { opacity: 0.6 }]}
                onPress={() => handleCaregiverConfirm(true)}
                disabled={confirming}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmButton}
                >
                  <Text style={styles.confirmButtonText}>{confirming ? '處理中...' : '同意候選'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ─── Candidate (post-confirm, info only) ─────────── */}
      {request.candidate_provider && request.status !== 'candidate_proposed' && (
        <>
          <View style={styles.sectionHeader}>
            <IconStar />
            <Text style={styles.sectionLabel}>候選服務人員</Text>
          </View>
          <View style={styles.card}>
            <ProviderCard provider={request.candidate_provider} />
          </View>
        </>
      )}

      {/* ─── Admin Note ──────────────────────────────────── */}
      {request.admin_note && (
        <>
          <View style={styles.sectionHeader}>
            <IconShield />
            <Text style={styles.sectionLabel}>管理員備註</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.noteText}>{request.admin_note}</Text>
          </View>
        </>
      )}

      {/* ─── Cancel ──────────────────────────────────────── */}
      {canCancel && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelling && { opacity: 0.6 }]}
          onPress={handleCancel}
          disabled={cancelling}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>{cancelling ? '處理中...' : '取消此需求'}</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ─── Timeline ─────────────────────────────────────────────────

const TIMELINE_STEPS = [
  'submitted', 'screening', 'candidate_proposed',
  'caregiver_confirmed', 'provider_confirmed',
  'arranged', 'in_service', 'completed',
] as const;

function StatusTimeline({ request }: { request: ServiceRequestDetail }) {
  const currentIdx = TIMELINE_STEPS.indexOf(
    request.status as typeof TIMELINE_STEPS[number],
  );
  const isCancelled = request.status === 'cancelled';

  const timeMap: Record<string, string | null> = {
    submitted: request.created_at,
    caregiver_confirmed: request.caregiver_confirmed_at,
    provider_confirmed: request.provider_confirmed_at,
  };

  return (
    <View>
      {TIMELINE_STEPS.map((step, idx) => {
        const cfg = STATUS_CONFIG[step] ?? { label: step, color: colors.textTertiary, bg: colors.bgSurfaceAlt };
        const isPast = !isCancelled && idx <= currentIdx;
        const isCurrent = !isCancelled && idx === currentIdx;
        const timestamp = timeMap[step];
        const isLast = idx === TIMELINE_STEPS.length - 1;
        const dotColor = cfg.color;

        return (
          <View key={step} style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={[
                styles.timelineDot,
                isPast ? { backgroundColor: dotColor } : { backgroundColor: colors.borderDefault },
                isCurrent && { borderWidth: 3, borderColor: dotColor, backgroundColor: colors.white, width: 14, height: 14, marginTop: 2 },
              ]} />
              {!isLast && (
                <View style={[
                  styles.timelineLine,
                  isPast && idx < currentIdx ? { backgroundColor: dotColor } : { backgroundColor: colors.borderDefault },
                ]} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[
                styles.timelineLabel,
                isPast ? { color: colors.textPrimary, fontWeight: '600' } : { color: colors.textDisabled },
              ]}>
                {cfg.label}
              </Text>
              {timestamp && (
                <Text style={styles.timelineTime}>
                  {new Date(timestamp).toLocaleString('zh-TW')}
                </Text>
              )}
            </View>
          </View>
        );
      })}
      {isCancelled && (
        <View style={styles.timelineRow}>
          <View style={styles.timelineLeft}>
            <View style={[styles.timelineDot, { backgroundColor: colors.danger }]} />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[styles.timelineLabel, { color: colors.danger, fontWeight: '600' }]}>已取消</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Provider Card ────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = { L1: '初級', L2: '中級', L3: '資深' };

function ProviderCard({ provider }: { provider: ProviderInfo }) {
  return (
    <View>
      <View style={styles.providerPhotoRow}>
        {provider.photo_url ? (
          <Image source={{ uri: provider.photo_url }} style={styles.providerPhoto} />
        ) : (
          <View style={styles.providerPhotoFallback}>
            <Text style={styles.providerPhotoInitial}>{provider.name.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.providerPhotoInfo}>
          <Text style={styles.providerPhotoName}>{provider.name}</Text>
          <View style={styles.providerLevelChip}>
            <Text style={styles.providerLevelText}>{provider.level}（{LEVEL_LABELS[provider.level] ?? provider.level}）</Text>
          </View>
        </View>
      </View>
      {provider.phone && <InfoRow label="電話" value={provider.phone} />}
      {provider.experience_years != null && (
        <InfoRow label="年資" value={`${provider.experience_years} 年`} />
      )}
      {((provider.specialties ?? []) as string[]).length > 0 && (
        <InfoRow label="專業" value={((provider.specialties ?? []) as string[]).join('、')} />
      )}
      {((provider.certifications ?? []) as string[]).length > 0 && (
        <InfoRow label="證照" value={((provider.certifications ?? []) as string[]).join('、')} />
      )}
      {((provider.service_areas ?? []) as string[]).length > 0 && (
        <InfoRow label="服務區域" value={((provider.service_areas ?? []) as string[]).join('、')} isLast />
      )}
    </View>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, isLast && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.bgScreen },
  errorText: { color: colors.danger, fontSize: typography.bodyMd.fontSize, marginBottom: spacing.md },
  linkText: { color: colors.primary, fontSize: typography.bodyMd.fontSize, textDecorationLine: 'underline' },

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

  // ─── Section header (icon + label above each card) ───────
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

  // ─── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderDefault,
    padding: spacing.lg,
  },

  // ─── Info Row ─────────────────────────────────────────────
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

  // ─── Description / Note ───────────────────────────────────
  descriptionText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  noteText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
    lineHeight: 20,
  },

  // ─── Provider Card ────────────────────────────────────────
  providerPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  providerPhoto: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgSurfaceAlt,
  },
  providerPhotoFallback: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  providerPhotoInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryText,
  },
  providerPhotoInfo: { flex: 1 },
  providerPhotoName: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  providerLevelChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    marginTop: 4,
  },
  providerLevelText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '600',
    color: colors.secondaryText,
  },

  // ─── Confirm / Reject Buttons ────────────────────────────
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  rejectButtonText: {
    color: colors.textSecondary,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },
  confirmButtonWrap: {
    flex: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmButton: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ─── Cancel ───────────────────────────────────────────────
  cancelButton: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(217,83,79,0.2)',
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
  },

  // ─── Timeline ────────────────────────────────────────────
  timelineRow: {
    flexDirection: 'row',
    minHeight: 44,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10, height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2, flex: 1,
    marginTop: 2, marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  timelineLabel: {
    fontSize: typography.bodySm.fontSize,
  },
  timelineTime: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: 2,
  },
});
