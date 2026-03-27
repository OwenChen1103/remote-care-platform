import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Types ────────────────────────────────────────────────────

interface RecentMeasurement {
  id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  glucose_value: number | null;
  glucose_timing: string | null;
  is_abnormal: boolean;
  measured_at: string;
}

interface Recipient {
  id: string;
  caregiver_id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_tags: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Reminder {
  id: string;
  recipient_id: string;
  reminder_type: string;
  reminder_time: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatGender(g: string | null): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  if (g === 'other') return '其他';
  return '-';
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return d.toLocaleDateString('zh-TW');
}

function formatGlucoseTiming(timing: string | null): string {
  if (timing === 'fasting') return '空腹';
  if (timing === 'before_meal') return '餐前';
  if (timing === 'after_meal') return '餐後';
  if (timing === 'random') return '隨機';
  return '';
}

function getInitial(name: string): string {
  return name.charAt(0);
}

// ─── Component ────────────────────────────────────────────────

export default function RecipientDetailScreen() {
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const router = useRouter();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [recentMeasurements, setRecentMeasurements] = useState<RecentMeasurement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingTime, setEditingTime] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Recipient>(`/recipients/${recipientId}`);
      setRecipient(data);
      try {
        const measurements = await api.get<RecentMeasurement[]>(
          `/measurements?recipient_id=${recipientId}&limit=5`,
        );
        setRecentMeasurements(measurements);
      } catch {
        // Non-critical
      }
      try {
        const reminderData = await api.get<Reminder[]>(`/recipients/${recipientId}/reminders`);
        setReminders(reminderData);
      } catch {
        // Non-critical
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('載入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  const toggleReminder = useCallback(async (type: string, enabled: boolean) => {
    try {
      const updated = await api.put<Reminder>(`/recipients/${recipientId}/reminders/${type}`, { is_enabled: enabled });
      setReminders((prev) => prev.map((r) => (r.reminder_type === type ? updated : r)));
    } catch {
      Alert.alert('更新失敗', '無法更新提醒設定，請稍後再試');
    }
  }, [recipientId]);

  const saveReminderTime = useCallback(async (type: string) => {
    const time = editingTime[type];
    if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      Alert.alert('格式錯誤', '時間格式須為 HH:mm（例如 08:00）');
      return;
    }
    try {
      const updated = await api.put<Reminder>(`/recipients/${recipientId}/reminders/${type}`, { reminder_time: time });
      setReminders((prev) => prev.map((r) => (r.reminder_type === type ? updated : r)));
      setEditingTime((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    } catch {
      Alert.alert('更新失敗', '無法更新提醒時間，請稍後再試');
    }
  }, [recipientId, editingTime]);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  // ─── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────

  if (error || !recipient) {
    return (
      <View style={styles.center}>
        <ErrorState
          message={error || '找不到此照護對象'}
          onRetry={() => void fetchRecipient()}
        />
      </View>
    );
  }

  // ─── Main ──────────────────────────────────────────────────────

  const abnormalCount = recentMeasurements.filter((m) => m.is_abnormal).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ═══ 1. Profile Hero Card ═══════════════════════════════ */}
      <Card style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.profileIdentity}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{getInitial(recipient.name)}</Text>
            </View>
            <View style={styles.profileNameBlock}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{recipient.name}</Text>
                {recipient.date_of_birth && (
                  <Text style={styles.profileAge}>{calculateAge(recipient.date_of_birth)} 歲</Text>
                )}
              </View>
              {recipient.medical_tags.length > 0 && (
                <View style={styles.profileTagsRow}>
                  {recipient.medical_tags.map((tag) => (
                    <View key={tag} style={styles.profileTag}>
                      <Text style={styles.profileTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Edit icon button — top right */}
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() => router.push(`/(tabs)/home/${recipientId}/edit`)}
            accessibilityLabel="編輯照護對象資料"
          >
            <Text style={styles.editIconText}>編輯</Text>
          </TouchableOpacity>
        </View>

        {/* Mini info grid inside profile card */}
        <View style={styles.profileInfoGrid}>
          <View style={styles.profileInfoItem}>
            <Text style={styles.profileInfoLabel}>性別</Text>
            <Text style={styles.profileInfoValue}>{formatGender(recipient.gender)}</Text>
          </View>
          <View style={styles.profileInfoDivider} />
          <View style={styles.profileInfoItem}>
            <Text style={styles.profileInfoLabel}>生日</Text>
            <Text style={styles.profileInfoValue}>
              {recipient.date_of_birth
                ? new Date(recipient.date_of_birth).toLocaleDateString('zh-TW')
                : '-'}
            </Text>
          </View>
          {recipient.emergency_contact_name && (
            <>
              <View style={styles.profileInfoDivider} />
              <View style={styles.profileInfoItem}>
                <Text style={styles.profileInfoLabel}>緊急聯絡</Text>
                <Text style={styles.profileInfoValue} numberOfLines={1}>
                  {recipient.emergency_contact_name}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Notes — only if present */}
        {recipient.notes ? (
          <View style={styles.profileNotes}>
            <Text style={styles.profileNotesLabel}>備註</Text>
            <Text style={styles.profileNotesText}>{recipient.notes}</Text>
          </View>
        ) : null}
      </Card>

      {/* ═══ 2. Quick Actions ═══════════════════════════════════ */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>快捷操作</Text>
        <View style={styles.actionsGrid}>
          {/* Primary actions — health recording */}
          <TouchableOpacity
            style={styles.actionCardPrimary}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${recipientId}&type=blood_pressure`)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionLabel}>記錄血壓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCardPrimary}
            onPress={() => router.push(`/(tabs)/health/add-measurement?recipientId=${recipientId}&type=blood_glucose`)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionLabel}>記錄血糖</Text>
          </TouchableOpacity>
          {/* Secondary actions */}
          <TouchableOpacity
            style={styles.actionCardSecondary}
            onPress={() => router.push(`/(tabs)/health/trends?recipientId=${recipientId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionLabelSecondary}>看趨勢</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCardSecondary}
            onPress={() => router.push(`/(tabs)/home/appointments?recipientId=${recipientId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionLabelSecondary}>行程管理</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ 3. Recent Measurements ════════════════════════════ */}
      {recentMeasurements.length > 0 && (
        <View style={styles.measurementsSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>最近量測</Text>
            {abnormalCount > 0 && (
              <View style={styles.abnormalCountBadge}>
                <Text style={styles.abnormalCountText}>{abnormalCount} 筆偏高</Text>
              </View>
            )}
          </View>
          <Card style={styles.measurementsCard}>
            {recentMeasurements.map((m, idx) => (
              <View key={m.id}>
                <View style={styles.measurementRow}>
                  {/* Left: type indicator + value */}
                  <View style={styles.measurementLeft}>
                    <View style={[
                      styles.measurementDot,
                      { backgroundColor: m.is_abnormal ? colors.danger : colors.success },
                    ]} />
                    <View>
                      <Text style={styles.measurementValue}>
                        {m.type === 'blood_pressure'
                          ? `${m.systolic}/${m.diastolic} mmHg`
                          : `${m.glucose_value} mg/dL`}
                      </Text>
                      <Text style={styles.measurementMeta}>
                        {m.type === 'blood_pressure' ? '血壓' : '血糖'}
                        {m.glucose_timing ? ` · ${formatGlucoseTiming(m.glucose_timing)}` : ''}
                      </Text>
                    </View>
                  </View>
                  {/* Right: status + date */}
                  <View style={styles.measurementRight}>
                    {m.is_abnormal && (
                      <View style={styles.abnormalPill}>
                        <Text style={styles.abnormalPillText}>偏高</Text>
                      </View>
                    )}
                    <Text style={styles.measurementDate}>{formatDate(m.measured_at)}</Text>
                  </View>
                </View>
                {idx < recentMeasurements.length - 1 && <View style={styles.measurementDivider} />}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ═══ 4. Reminder Settings ══════════════════════════════ */}
      {reminders.length > 0 && (
        <View style={styles.remindersSection}>
          <Text style={styles.sectionTitle}>量測提醒</Text>
          {reminders.map((r) => {
            const label = r.reminder_type === 'morning' ? '早上提醒' : '晚上提醒';
            const isEditing = editingTime[r.reminder_type] !== undefined;
            return (
              <Card key={r.reminder_type} style={styles.reminderCard}>
                <View style={styles.reminderRow}>
                  <Text style={styles.reminderLabel}>{label}</Text>
                  <Switch
                    value={r.is_enabled}
                    onValueChange={(val) => void toggleReminder(r.reminder_type, val)}
                    trackColor={{ false: colors.borderStrong, true: colors.primaryLight }}
                    thumbColor={r.is_enabled ? colors.primary : colors.textDisabled}
                  />
                </View>
                <View style={styles.reminderTimeRow}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={styles.timeInput}
                        value={editingTime[r.reminder_type]}
                        onChangeText={(text) => setEditingTime((prev) => ({ ...prev, [r.reminder_type]: text }))}
                        placeholder="HH:mm"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      <TouchableOpacity style={styles.timeSaveButton} onPress={() => void saveReminderTime(r.reminder_type)}>
                        <Text style={styles.timeSaveText}>儲存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingTime((prev) => { const next = { ...prev }; delete next[r.reminder_type]; return next; })}>
                        <Text style={styles.timeCancelText}>取消</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => setEditingTime((prev) => ({ ...prev, [r.reminder_type]: r.reminder_time }))}>
                      <Text style={styles.reminderTime}>{r.reminder_time}</Text>
                      <Text style={styles.reminderTimeHint}>點擊修改時間</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Bottom spacer */}
      <View style={{ height: spacing['3xl'] }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing['3xl'] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgScreen,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.bodySm.fontSize,
    color: colors.textTertiary,
  },

  // ─── Profile Hero Card ─────────────────────────────────────
  profileCard: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  profileAvatarText: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.primaryText,
  },
  profileNameBlock: {
    flex: 1,
    paddingTop: spacing.xxs,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  profileName: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileAge: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
  },
  profileTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  profileTag: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs + 1,
  },
  profileTagText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '500',
    color: colors.primaryText,
  },
  editIconButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSurfaceAlt,
  },
  editIconText: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  // Mini info grid
  profileInfoGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  profileInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  profileInfoLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xxs,
  },
  profileInfoValue: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderDefault,
  },

  // Notes
  profileNotes: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  profileNotesLabel: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginBottom: spacing.xs,
  },
  profileNotesText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.bodyMd.fontSize * 1.6,
  },

  // ─── Quick Actions ─────────────────────────────────────────
  actionsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCardPrimary: {
    flex: 1,
    minWidth: '45%' as unknown as number,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionCardSecondary: {
    flex: 1,
    minWidth: '45%' as unknown as number,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
  },
  actionLabelSecondary: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ─── Measurements ──────────────────────────────────────────
  measurementsSection: {
    marginBottom: spacing.xl,
  },
  abnormalCountBadge: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs + 1,
  },
  abnormalCountText: {
    fontSize: typography.captionSm.fontSize,
    fontWeight: '500',
    color: colors.warning,
  },
  measurementsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  measurementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  measurementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.md,
  },
  measurementValue: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  measurementMeta: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.xxs,
  },
  measurementRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  abnormalPill: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  abnormalPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning,
  },
  measurementDate: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
  },
  measurementDivider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.lg,
  },

  // ─── Reminders ─────────────────────────────────────────────
  remindersSection: {
    marginBottom: spacing.lg,
  },
  reminderCard: {
    marginBottom: spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderLabel: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reminderTimeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reminderTime: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reminderTimeHint: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.xxs,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.headingSm.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    width: 80,
    textAlign: 'center',
  },
  timeSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeSaveText: {
    color: colors.white,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
  },
  timeCancelText: {
    color: colors.textTertiary,
    fontSize: typography.bodyMd.fontSize,
  },
});
