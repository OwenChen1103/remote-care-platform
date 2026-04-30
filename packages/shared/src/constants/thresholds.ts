// Blood Pressure thresholds (mmHg)
export const BP_THRESHOLDS = {
  SYSTOLIC: {
    LOW: 90,
    NORMAL_HIGH: 130,
    HIGH: 140,
    MAX_INPUT: 300,
    MIN_INPUT: 40,
  },
  DIASTOLIC: {
    LOW: 60,
    NORMAL_HIGH: 85,
    HIGH: 90,
    MAX_INPUT: 200,
    MIN_INPUT: 20,
  },
  HEART_RATE: {
    MAX_INPUT: 250,
    MIN_INPUT: 30,
  },
} as const;

// Blood Glucose thresholds (mg/dL)
export const BG_THRESHOLDS = {
  LOW: 70,
  FASTING: {
    NORMAL_HIGH: 100,
    HIGH: 126,
  },
  AFTER_MEAL: {
    NORMAL_HIGH: 140,
    HIGH: 180,
  },
  RANDOM: {
    NORMAL_HIGH: 140,
    HIGH: 180,
  },
  MAX_INPUT: 800,
  MIN_INPUT: 10,
} as const;

// Abnormal alert rules
export const ABNORMAL_ALERT_RULES = {
  RECENT_COUNT: 3,
  ABNORMAL_THRESHOLD: 2,
  DEDUP_HOURS: 24,
} as const;

// Recipient limits
export const RECIPIENT_LIMITS = {
  MAX_PER_CAREGIVER: 10,
  MAX_MEDICAL_TAGS: 20,
} as const;

// API limits
export const API_LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  NOTE_MAX_LENGTH: 500,
  NAME_MAX_LENGTH: 100,
} as const;

// AI limits
export const AI_LIMITS = {
  REPORT_PER_HOUR: 3,   // legacy — kept for backward compatibility
  CHAT_PER_HOUR: 10,    // legacy — kept for backward compatibility
  REPORT_PER_DAY: 5,    // MVP: unified daily limit
  CHAT_PER_DAY: 5,      // MVP: unified daily limit
  MAX_PROMPT_TOKENS: 4000,
  TIMEOUT_MS: 15000,
  MAX_RETRIES: 1,
} as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
  MAX_FILES_PER_PROVIDER: 20,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
  PRESIGN_EXPIRY_SECONDS: 600,
  DOWNLOAD_EXPIRY_SECONDS: 900,
} as const;

export type AbnormalLevel = 'normal' | 'elevated' | 'abnormal';

export function checkBloodPressureLevel(
  systolic: number,
  diastolic: number,
): AbnormalLevel {
  if (systolic >= BP_THRESHOLDS.SYSTOLIC.HIGH || diastolic >= BP_THRESHOLDS.DIASTOLIC.HIGH) {
    return 'abnormal';
  }
  if (systolic < BP_THRESHOLDS.SYSTOLIC.LOW || diastolic < BP_THRESHOLDS.DIASTOLIC.LOW) {
    return 'abnormal';
  }
  if (
    systolic >= BP_THRESHOLDS.SYSTOLIC.NORMAL_HIGH ||
    diastolic >= BP_THRESHOLDS.DIASTOLIC.NORMAL_HIGH
  ) {
    return 'elevated';
  }
  return 'normal';
}

export function checkBloodGlucoseLevel(
  value: number,
  timing: 'before_meal' | 'after_meal' | 'fasting' | 'random',
): AbnormalLevel {
  if (value < BG_THRESHOLDS.LOW) {
    return 'abnormal';
  }

  const thresholds =
    timing === 'fasting' || timing === 'before_meal'
      ? BG_THRESHOLDS.FASTING
      : timing === 'after_meal'
        ? BG_THRESHOLDS.AFTER_MEAL
        : BG_THRESHOLDS.RANDOM;

  if (value >= thresholds.HIGH) {
    return 'abnormal';
  }
  if (value >= thresholds.NORMAL_HIGH) {
    return 'elevated';
  }
  return 'normal';
}
