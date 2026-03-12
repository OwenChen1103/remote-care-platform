export const USER_ROLES = {
  CAREGIVER: 'caregiver',
  PATIENT: 'patient',
  PROVIDER: 'provider',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const MEASUREMENT_TYPES = {
  BLOOD_PRESSURE: 'blood_pressure',
  BLOOD_GLUCOSE: 'blood_glucose',
} as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[keyof typeof MEASUREMENT_TYPES];

export const MEASUREMENT_SOURCES = {
  MANUAL: 'manual',
  DEVICE: 'device',
} as const;

export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[keyof typeof MEASUREMENT_SOURCES];

export const GLUCOSE_TIMINGS = {
  BEFORE_MEAL: 'before_meal',
  AFTER_MEAL: 'after_meal',
  FASTING: 'fasting',
  RANDOM: 'random',
} as const;

export type GlucoseTiming = (typeof GLUCOSE_TIMINGS)[keyof typeof GLUCOSE_TIMINGS];

export const SERVICE_REQUEST_STATUSES = {
  SUBMITTED: 'submitted',
  SCREENING: 'screening',
  CANDIDATE_PROPOSED: 'candidate_proposed',
  CAREGIVER_CONFIRMED: 'caregiver_confirmed',
  PROVIDER_CONFIRMED: 'provider_confirmed',
  ARRANGED: 'arranged',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ServiceRequestStatus =
  (typeof SERVICE_REQUEST_STATUSES)[keyof typeof SERVICE_REQUEST_STATUSES];

export const VALID_STATUS_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  submitted: ['screening', 'cancelled'],
  screening: ['candidate_proposed', 'cancelled'],
  candidate_proposed: ['caregiver_confirmed', 'screening', 'cancelled'],
  caregiver_confirmed: ['provider_confirmed', 'screening', 'cancelled'],
  provider_confirmed: ['arranged', 'cancelled'],
  arranged: ['in_service', 'cancelled'],
  in_service: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const PROVIDER_REVIEW_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
} as const;

export type ProviderReviewStatus =
  (typeof PROVIDER_REVIEW_STATUSES)[keyof typeof PROVIDER_REVIEW_STATUSES];

export const PROVIDER_LEVELS = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
} as const;

export type ProviderLevel = (typeof PROVIDER_LEVELS)[keyof typeof PROVIDER_LEVELS];

export const PROVIDER_AVAILABILITY_STATUSES = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
} as const;

export type ProviderAvailabilityStatus =
  (typeof PROVIDER_AVAILABILITY_STATUSES)[keyof typeof PROVIDER_AVAILABILITY_STATUSES];

export const SERVICE_CATEGORY_CODES = {
  ESCORT_VISIT: 'escort_visit',
  PRE_VISIT_CONSULT: 'pre_visit_consult',
  SHOPPING_ASSIST: 'shopping_assist',
  EXERCISE_PROGRAM: 'exercise_program',
  HOME_CLEANING: 'home_cleaning',
  DAILY_LIVING_SUPPORT: 'daily_living_support',
  NUTRITION_CONSULT: 'nutrition_consult',
  FUNCTIONAL_ASSESSMENT: 'functional_assessment',
} as const;

export type ServiceCategoryCode =
  (typeof SERVICE_CATEGORY_CODES)[keyof typeof SERVICE_CATEGORY_CODES];

export const NOTIFICATION_TYPES = {
  MEASUREMENT_REMINDER: 'measurement_reminder',
  ABNORMAL_ALERT: 'abnormal_alert',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  SERVICE_REQUEST_UPDATE: 'service_request_update',
  AI_REPORT_READY: 'ai_report_ready',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const REMINDER_TYPES = {
  MORNING: 'morning',
  EVENING: 'evening',
} as const;

export type ReminderType = (typeof REMINDER_TYPES)[keyof typeof REMINDER_TYPES];

export const AI_REPORT_TYPES = {
  HEALTH_SUMMARY: 'health_summary',
  TREND_ANALYSIS: 'trend_analysis',
  VISIT_PREP: 'visit_prep',
  FAMILY_UPDATE: 'family_update',
} as const;

export type AiReportType = (typeof AI_REPORT_TYPES)[keyof typeof AI_REPORT_TYPES];

export const AI_STATUS_LABELS = {
  STABLE: 'stable',
  ATTENTION: 'attention',
  CONSULT_DOCTOR: 'consult_doctor',
} as const;

export type AiStatusLabel = (typeof AI_STATUS_LABELS)[keyof typeof AI_STATUS_LABELS];

export const DOCUMENT_TYPES = {
  CERTIFICATION: 'certification',
  ID_CARD: 'id_card',
  OTHER: 'other',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const GENDERS = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
} as const;

export type Gender = (typeof GENDERS)[keyof typeof GENDERS];
