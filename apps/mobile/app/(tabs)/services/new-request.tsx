import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
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

  // Form state
  const [recipientId, setRecipientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

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

  const handleSubmit = async () => {
    // Inline validation — sets error, does not use Alert
    if (!recipientId || !categoryId || !preferredDate || !location || !description) {
      setError('請填寫所有必填欄位');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/service-requests', {
        recipient_id: recipientId,
        category_id: categoryId,
        preferred_date: new Date(preferredDate).toISOString(),
        preferred_time_slot: timeSlot || undefined,
        location,
        description,
      });
      // Success — navigate back immediately; the updated list is the confirmation
      router.back();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
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

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={() => void handleSubmit()}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={submitting ? '送出中' : '送出服務需求'}
      >
        <Text style={styles.submitButtonText}>{submitting ? '送出中...' : '送出需求'}</Text>
      </TouchableOpacity>
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

  // ─── Submit ───────────────────────────────────────────────
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
    marginTop: spacing['2xl'],
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
