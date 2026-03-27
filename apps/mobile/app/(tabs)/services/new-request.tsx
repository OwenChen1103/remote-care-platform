import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { TIME_SLOT_DISPLAY } from '@remote-care/shared';

// ─── Types ────────────────────────────────────────────────────

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

// ─── Derived Constants ────────────────────────────────────────

const TIME_SLOT_OPTIONS = Object.entries(TIME_SLOT_DISPLAY).map(
  ([value, config]) => ({ value, label: config.label }),
);

// ─── Component ────────────────────────────────────────────────

export default function NewServiceRequestScreen() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state — common fields
  const [recipientId, setRecipientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // Form state — category-specific fields
  const [departureLocation, setDepartureLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [serviceDuration, setServiceDuration] = useState<number | null>(null);
  const [needsPickup, setNeedsPickup] = useState(false);
  const [preferredGender, setPreferredGender] = useState('');
  const [department, setDepartment] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [spaceSize, setSpaceSize] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [exerciseType, setExerciseType] = useState('');

  const selectedCategoryCode = useMemo(
    () => categories.find((c) => c.id === categoryId)?.code ?? '',
    [categories, categoryId],
  );

  // Reset category-specific fields when category changes
  useEffect(() => {
    setDepartureLocation('');
    setDestination('');
    setServiceDuration(null);
    setNeedsPickup(false);
    setPreferredGender('');
    setDepartment('');
    setDoctorName('');
    setRegistrationNumber('');
    setSpaceSize('');
    setHasPets(false);
    setExerciseType('');
  }, [categoryId]);

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

  const doSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      // Build category-specific metadata
      const metadata: Record<string, unknown> = {};
      if (selectedCategoryCode === 'escort_visit') {
        if (department) metadata.department = department;
        if (doctorName) metadata.doctor_name = doctorName;
        if (registrationNumber) metadata.registration_number = registrationNumber;
        metadata.needs_pickup = needsPickup;
        if (preferredGender) metadata.preferred_gender = preferredGender;
      } else if (selectedCategoryCode === 'exercise_program') {
        if (exerciseType) metadata.exercise_type = exerciseType;
        if (preferredGender) metadata.preferred_gender = preferredGender;
      } else if (selectedCategoryCode === 'home_cleaning') {
        if (spaceSize) metadata.space_size = spaceSize;
        metadata.has_pets = hasPets;
        if (preferredGender) metadata.preferred_gender = preferredGender;
      }

      await api.post('/service-requests', {
        recipient_id: recipientId,
        category_id: categoryId,
        preferred_date: new Date(preferredDate).toISOString(),
        preferred_time_slot: timeSlot || undefined,
        location,
        departure_location: departureLocation || undefined,
        destination: destination || undefined,
        service_duration: serviceDuration ?? undefined,
        description,
        metadata,
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    // Inline validation — sets error, does not use Alert
    if (!recipientId || !categoryId || !preferredDate || !location || !description) {
      setError('請填寫所有必填欄位');
      return;
    }

    if (isNaN(new Date(preferredDate).getTime())) {
      setError('請輸入有效日期（YYYY-MM-DD）');
      return;
    }

    Alert.alert(
      '確認送出需求',
      '確定送出此服務需求？送出後營運團隊將盡快為您安排。',
      [
        { text: '取消', style: 'cancel' },
        { text: '確認送出', onPress: () => void doSubmit() },
      ],
    );
  };

  // ─── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  // ─── Main Form ────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Error banner */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Recipient Selection */}
      <Text style={styles.label}>被照護者 *</Text>
      <View style={styles.chipRow}>
        {recipients.map((r) => {
          const isActive = recipientId === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setRecipientId(r.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`選擇 ${r.name}`}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category Selection */}
      <Text style={styles.label}>服務類別 *</Text>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => {
          const isActive = categoryId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryCard, isActive && styles.categoryCardActive]}
              onPress={() => setCategoryId(cat.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`選擇 ${cat.name}`}
            >
              <Text style={[styles.categoryName, isActive && styles.categoryNameActive]}>
                {cat.name}
              </Text>
              {cat.description && (
                <Text style={styles.categoryDesc} numberOfLines={2}>
                  {cat.description}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Preferred Date */}
      <Text style={styles.label}>期望日期 * (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={preferredDate}
        onChangeText={setPreferredDate}
        placeholder="2026-04-01"
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel="期望日期"
      />

      {/* Time Slot */}
      <Text style={styles.label}>時段（選填）</Text>
      <View style={styles.chipRow}>
        {TIME_SLOT_OPTIONS.map((slot) => {
          const isActive = timeSlot === slot.value;
          return (
            <TouchableOpacity
              key={slot.value}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setTimeSlot(timeSlot === slot.value ? '' : slot.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={slot.label}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {slot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Location */}
      <Text style={styles.label}>服務地點 *</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="台北市信義區..."
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel="服務地點"
      />

      {/* ── Category-specific fields ────────────────────────── */}

      {/* Escort Visit: departure / destination / department / doctor / pickup / gender */}
      {selectedCategoryCode === 'escort_visit' && (
        <View style={styles.dynamicSection}>
          <Text style={styles.dynamicSectionTitle}>陪診詳細資訊</Text>

          <Text style={styles.label}>出發地</Text>
          <TextInput
            style={styles.input}
            value={departureLocation}
            onChangeText={setDepartureLocation}
            placeholder="接送出發地址（選填）"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={styles.label}>目的地（醫院）</Text>
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            placeholder="醫院名稱或地址"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={styles.label}>掛號科別</Text>
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="例：心臟內科"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={styles.label}>醫師姓名</Text>
          <TextInput
            style={styles.input}
            value={doctorName}
            onChangeText={setDoctorName}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={styles.label}>掛號號碼</Text>
          <TextInput
            style={styles.input}
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder="選填"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>需要接送</Text>
            <Switch
              value={needsPickup}
              onValueChange={setNeedsPickup}
              trackColor={{ false: colors.borderStrong, true: colors.primaryLight }}
              thumbColor={needsPickup ? colors.primary : colors.textDisabled}
              accessibilityLabel="需要接送"
            />
          </View>

          <Text style={styles.label}>服務人員性別偏好</Text>
          <View style={styles.chipRow}>
            {[
              { value: '', label: '不限' },
              { value: 'female', label: '女性' },
              { value: 'male', label: '男性' },
            ].map((opt) => {
              const isActive = preferredGender === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setPreferredGender(opt.value)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>服務時數</Text>
          <View style={styles.chipRow}>
            {[2, 4, 8].map((h) => {
              const isActive = serviceDuration === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setServiceDuration(isActive ? null : h)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h} 小時</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Exercise Program: type / gender / duration */}
      {selectedCategoryCode === 'exercise_program' && (
        <View style={styles.dynamicSection}>
          <Text style={styles.dynamicSectionTitle}>運動養生詳細資訊</Text>

          <Text style={styles.label}>運動類型</Text>
          <View style={styles.chipRow}>
            {[
              { value: 'post_surgery', label: '術後保養' },
              { value: 'muscle_training', label: '肌力訓練' },
              { value: 'general', label: '一般運動' },
            ].map((opt) => {
              const isActive = exerciseType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setExerciseType(isActive ? '' : opt.value)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>服務人員性別偏好</Text>
          <View style={styles.chipRow}>
            {[
              { value: '', label: '不限' },
              { value: 'female', label: '女性' },
              { value: 'male', label: '男性' },
            ].map((opt) => {
              const isActive = preferredGender === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setPreferredGender(opt.value)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>服務時數</Text>
          <View style={styles.chipRow}>
            {[2].map((h) => {
              const isActive = serviceDuration === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setServiceDuration(isActive ? null : h)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h} 小時</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Home Cleaning: space size / pets / gender / duration */}
      {selectedCategoryCode === 'home_cleaning' && (
        <View style={styles.dynamicSection}>
          <Text style={styles.dynamicSectionTitle}>居家打掃詳細資訊</Text>

          <Text style={styles.label}>空間坪數</Text>
          <View style={styles.chipRow}>
            {[
              { value: '0-10', label: '10 坪以下' },
              { value: '20-30', label: '20-30 坪' },
              { value: '30-40', label: '30-40 坪' },
              { value: '40-50', label: '40-50 坪' },
            ].map((opt) => {
              const isActive = spaceSize === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSpaceSize(isActive ? '' : opt.value)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>有養寵物</Text>
            <Switch
              value={hasPets}
              onValueChange={setHasPets}
              trackColor={{ false: colors.borderStrong, true: colors.primaryLight }}
              thumbColor={hasPets ? colors.primary : colors.textDisabled}
              accessibilityLabel="有養寵物"
            />
          </View>

          <Text style={styles.label}>服務人員性別偏好</Text>
          <View style={styles.chipRow}>
            {[
              { value: '', label: '不限' },
              { value: 'female', label: '女性' },
              { value: 'male', label: '男性' },
            ].map((opt) => {
              const isActive = preferredGender === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setPreferredGender(opt.value)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>服務時數</Text>
          <View style={styles.chipRow}>
            {[3, 4, 5, 6].map((h) => {
              const isActive = serviceDuration === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setServiceDuration(isActive ? null : h)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h} 小時</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Description */}
      <Text style={styles.label}>需求描述 *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="請描述您的服務需求..."
        placeholderTextColor={colors.textDisabled}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        accessibilityLabel="需求描述"
      />

      {/* Submit + Reset */}
      <View style={styles.submitRow}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            Alert.alert('重新選擇', '確定要清空目前的填寫內容嗎？', [
              { text: '取消', style: 'cancel' },
              { text: '確定清空', style: 'destructive', onPress: () => {
                // Keep recipientId selected (it's a "who" selection, not form content)
                setCategoryId('');
                setPreferredDate('');
                setTimeSlot('');
                setLocation('');
                setDescription('');
                setDepartureLocation('');
                setDestination('');
                setServiceDuration(null);
                setNeedsPickup(false);
                setPreferredGender('');
                setDepartment('');
                setDoctorName('');
                setRegistrationNumber('');
                setSpaceSize('');
                setHasPets(false);
                setExerciseType('');
                setError('');
              }},
            ]);
          }}
          accessibilityRole="button"
          accessibilityLabel="重新選擇"
        >
          <Text style={styles.resetButtonText}>重新選擇</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitting ? '送出中' : '送出服務需求'}
        >
          <Text style={styles.submitButtonText}>{submitting ? '送出中...' : '送出需求'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'] + spacing.sm,
  },
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

  // ─── Error ────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.bodyMd.fontSize,
    textAlign: 'center',
  },

  // ─── Labels ───────────────────────────────────────────────
  label: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  // ─── Chips (Recipient + Time Slot) ────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg - spacing.xxs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSurface,
  },
  chipActive: {
    borderColor: colors.primaryText,
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.textTertiary,
  },
  chipTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ─── Category Grid ────────────────────────────────────────
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
  },
  categoryCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  categoryName: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  categoryNameActive: {
    color: colors.primaryText,
  },
  categoryDesc: {
    fontSize: typography.caption.fontSize,
    color: colors.textDisabled,
  },

  // ─── Dynamic Category Section ────────────────────────────
  dynamicSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  dynamicSectionTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: typography.headingSm.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ─── Text Inputs ──────────────────────────────────────────
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
  },

  // ─── Submit + Reset ──────────────────────────────────────
  submitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
  },
  resetButton: {
    flex: 1,
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
  },
});
