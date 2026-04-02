import { useEffect, useState, useCallback, useMemo } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';
import { api, ApiError } from '@/lib/api-client';
import { colors, typography, spacing, radius, shadows } from '@/lib/theme';
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

// ─── Service Visual Info ──────────────────────────────────────

const SERVICE_HERO: Record<string, { subtitle: string; priceRange: string; duration: string }> = {
  escort_visit:          { subtitle: '專業管家全程陪伴看診，讓家人安心', priceRange: 'NT$500 – 4,000', duration: '2 – 8 小時' },
  functional_assessment: { subtitle: '到府基礎健康檢測，掌握身體狀況', priceRange: '即將上線', duration: '1 – 2 小時' },
  exercise_program:      { subtitle: '護理師/物理治療師指導居家運動', priceRange: 'NT$800 – 2,500', duration: '2 小時' },
  home_cleaning:         { subtitle: '專業清潔人員到府打掃，安心舒適', priceRange: 'NT$600/小時', duration: '3 – 6 小時' },
  pre_visit_consult:     { subtitle: '看診前先了解狀況，不浪費門診時間', priceRange: '洽詢報價', duration: '30 – 60 分鐘' },
  daily_living_support:  { subtitle: '日常生活陪伴與協助，溫暖守護', priceRange: '洽詢報價', duration: '依需求' },
  nutrition_consult:     { subtitle: '專業營養師量身打造飲食建議', priceRange: '洽詢報價', duration: '1 小時' },
  shopping_assist:       { subtitle: '代購日常用品與食材，省時省力', priceRange: '洽詢報價', duration: '依需求' },
};

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

const SERVICE_ICON_PATHS: Record<string, (props: { size: number; color: string }) => React.ReactElement> = {
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

// ─── Component ────────────────────────────────────────────────

export default function NewServiceRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state — common fields
  const [recipientId, setRecipientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const estimatedPrice = useMemo(() => {
    if (!serviceDuration) return null;
    if (selectedCategoryCode === 'escort_visit') {
      const base = 200 * serviceDuration;
      const withCert = Math.round(base * 1.2);
      const pickup = needsPickup ? 200 : 0; // assume ≤5km
      return { low: base + pickup, high: withCert + pickup, note: needsPickup ? '含接送（5公里內）' : null };
    }
    if (selectedCategoryCode === 'exercise_program') {
      const base = 400 * serviceDuration;
      const withCert = Math.round(base * 1.6);
      return { low: base, high: withCert, note: null };
    }
    if (selectedCategoryCode === 'home_cleaning') {
      const total = 600 * serviceDuration;
      return { low: total, high: total, note: null };
    }
    return null;
  }, [selectedCategoryCode, serviceDuration, needsPickup]);

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

  // Sync categoryId from URL params whenever they change
  useEffect(() => {
    if (params.categoryId) {
      setCategoryId(params.categoryId);
    }
  }, [params.categoryId]);

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

  // ─── Derived for hero ─────────────────────────────────────

  const heroInfo = SERVICE_HERO[selectedCategoryCode];
  const heroClr = SERVICE_CLR[selectedCategoryCode] ?? { icon: colors.primary, bg: colors.primaryLight, accent: colors.primaryLight };
  const HeroIcon = SERVICE_ICON_PATHS[selectedCategoryCode];
  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name ?? '';

  // ─── Main Form ────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !categoryId && styles.contentCentered]}>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ═══ Back button (when category selected) ═════════════ */}
      {categoryId && heroInfo && (
        <TouchableOpacity style={styles.backBtn} onPress={() => setCategoryId('')} activeOpacity={0.7}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 19l-7-7 7-7" stroke={colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}

      {/* ═══ Service Hero Header ═══════════════════════════════ */}
      {categoryId && heroInfo ? (
        <View style={[styles.heroCard, { backgroundColor: heroClr.bg }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIconCircle, { backgroundColor: heroClr.accent }]}>
              {HeroIcon ? <HeroIcon size={24} color={heroClr.icon} /> : null}
            </View>
            <View style={styles.heroPriceWrap}>
              <Text style={[styles.heroPrice, { color: heroClr.icon }]}>{heroInfo.priceRange}</Text>
              <Text style={styles.heroDuration}>{heroInfo.duration}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{selectedCategoryName}</Text>
          <Text style={styles.heroSubtitle}>{heroInfo.subtitle}</Text>
        </View>
      ) : (
        /* ── Category Selector (when no category selected) ── */
        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>選擇服務類別</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => {
              const clr = SERVICE_CLR[cat.code] ?? { icon: colors.primary, bg: colors.primaryLight, accent: colors.primaryLight };
              const CatIcon = SERVICE_ICON_PATHS[cat.code];
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryCard, { backgroundColor: clr.bg }]}
                  onPress={() => setCategoryId(cat.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.catIconSmall, { backgroundColor: clr.accent }]}>
                    {CatIcon ? <CatIcon size={16} color={clr.icon} /> : null}
                  </View>
                  <Text style={[styles.categoryName, { color: clr.icon }]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ═══ Form Cards (only show when category is selected) ══ */}
      {categoryId ? (
        <>
          {/* ── Card 1: 受服務者 ────────────────────── */}
          <View style={styles.cardContainer}>
            <Text style={styles.cardTitle}>受服務者</Text>
            <View style={styles.chipRow}>
              {recipients.map((r) => {
                const isActive = recipientId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setRecipientId(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{r.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Card 2: 預約資訊 ────────────────────── */}
          <View style={styles.cardContainer}>
            <Text style={styles.cardTitle}>預約資訊</Text>

            <Text style={styles.label}>期望日期 *</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Text style={preferredDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {preferredDate || '選擇日期'}
              </Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" stroke={colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={preferredDate ? new Date(preferredDate) : new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    const yyyy = date.getFullYear();
                    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
                    const dd = date.getDate().toString().padStart(2, '0');
                    setPreferredDate(`${yyyy}-${mm}-${dd}`);
                  }
                }}
              />
            )}

            <Text style={styles.label}>時段</Text>
            <View style={styles.chipRow}>
              {TIME_SLOT_OPTIONS.map((slot) => {
                const isActive = timeSlot === slot.value;
                return (
                  <TouchableOpacity
                    key={slot.value}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setTimeSlot(timeSlot === slot.value ? '' : slot.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{slot.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>服務地點 *</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="台北市信義區..."
              placeholderTextColor={colors.textDisabled}
            />

            <Text style={styles.label}>需求描述 *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="請描述您的服務需求..."
              placeholderTextColor={colors.textDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* ── Card 3: Escort Visit — category-specific fields ── */}
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
                      activeOpacity={0.7}
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
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h} 小時</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Card 3: Exercise Program — category-specific fields ── */}
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
                      activeOpacity={0.7}
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
                      activeOpacity={0.7}
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
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h} 小時</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Card 3: Home Cleaning — category-specific fields ── */}
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
                      activeOpacity={0.7}
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
                      activeOpacity={0.7}
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
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h} 小時</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Price Estimation ─────────────────────────────── */}
          {estimatedPrice && (
            <View style={styles.priceCard}>
              <Text style={styles.priceTitle}>預估金額</Text>
              <Text style={styles.priceValue}>
                {estimatedPrice.low === estimatedPrice.high
                  ? `NT$ ${estimatedPrice.low.toLocaleString()}`
                  : `NT$ ${estimatedPrice.low.toLocaleString()} – ${estimatedPrice.high.toLocaleString()}`}
              </Text>
              {estimatedPrice.note && <Text style={styles.priceNote}>{estimatedPrice.note}</Text>}
              <Text style={styles.priceDisclaimer}>實際金額依服務人員資歷與證照調整</Text>
            </View>
          )}

          {/* ── Submit + Reset ────────────────────────────────── */}
          <View style={styles.submitRow}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                Alert.alert('重新選擇', '確定要清空目前的填寫內容嗎？', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '確定清空',
                    style: 'destructive',
                    onPress: () => {
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
                    },
                  },
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
        </>
      ) : null}

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgScreen },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backBtnText: { fontSize: typography.bodySm.fontSize, color: colors.textTertiary },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'] + spacing.sm,
  },
  contentCentered: {
    flexGrow: 1,
    justifyContent: 'center' as const,
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

  // ─── Hero Card ────────────────────────────────────────────
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.low,
    marginBottom: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPriceWrap: {
    alignItems: 'flex-end',
  },
  heroPrice: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
  },
  heroDuration: {
    fontSize: typography.caption.fontSize,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  heroName: {
    fontSize: typography.headingMd.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  heroChange: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    marginTop: spacing.xs,
  },

  // ─── Card Containers ──────────────────────────────────────
  cardContainer: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.low,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // ─── Labels ───────────────────────────────────────────────
  label: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  // ─── Chips ────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.full,
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
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  catIconSmall: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ─── Dynamic Category Section ─────────────────────────────
  dynamicSection: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.low,
    marginBottom: spacing.sm,
  },
  dynamicSectionTitle: {
    fontSize: typography.headingSm.fontSize,
    fontWeight: '700',
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

  // ─── Date Button ──────────────────────────────────────────
  dateButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgSurfaceAlt, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.sm, padding: spacing.md,
  },
  dateButtonText: { fontSize: typography.bodyMd.fontSize, color: colors.textPrimary },
  dateButtonPlaceholder: { fontSize: typography.bodyMd.fontSize, color: colors.textDisabled },

  // ─── Text Inputs ──────────────────────────────────────────
  input: {
    backgroundColor: colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.bodyMd.fontSize,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
  },

  // ─── Price Estimation Card ────────────────────────────────
  priceCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  priceTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontSize: typography.headingLg.fontSize,
    fontWeight: '700',
    color: colors.primary,
  },
  priceNote: {
    fontSize: typography.captionSm.fontSize,
    color: colors.primaryText,
    marginTop: spacing.xs,
  },
  priceDisclaimer: {
    fontSize: typography.captionSm.fontSize,
    color: colors.textDisabled,
    marginTop: spacing.sm,
  },

  // ─── Submit + Reset ───────────────────────────────────────
  submitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
  },
  resetButton: {
    flex: 1,
    backgroundColor: colors.bgSurfaceAlt,
    borderRadius: radius.full,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadows.high,
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.lg - spacing.xxs,
    alignItems: 'center',
    ...shadows.high,
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
