/**
 * Canonical Status Display Constants
 *
 * This is the SINGLE SOURCE OF TRUTH for status labels and display colors
 * across both mobile and web admin platforms.
 *
 * All pages rendering status badges must import from here.
 * Do not define status colors inline in page files.
 *
 * Color assignments are based on implementation-spec.md G.2.9:
 *   submitted(灰) → screening(藍) → candidate_proposed(靛) →
 *   caregiver_confirmed(青) → provider_confirmed(綠) → arranged(深綠) →
 *   in_service(橘) → completed(綠) → cancelled(紅)
 *
 * AI status labels from spec G.2.7:
 *   stable(綠) → attention(黃) → consult_doctor(紅)
 *
 * Provider review statuses from spec H.2.4:
 *   pending(黃) → approved(綠) → suspended(紅)
 */

import type { ServiceRequestStatus, AiStatusLabel, ProviderReviewStatus } from '../constants/enums';

// ---------------------------------------------------------------------------
// Display Config Type
// ---------------------------------------------------------------------------

export interface StatusDisplayConfig {
  /** Traditional Chinese display label */
  label: string;
  /** Foreground / text color (hex) */
  color: string;
  /** Background color (hex) */
  bg: string;
  /** Tailwind class pair for web admin: "bg-xxx-100 text-xxx-800" */
  twClasses: string;
}

// ---------------------------------------------------------------------------
// Service Request Status Display
// ---------------------------------------------------------------------------

export const SERVICE_REQUEST_STATUS_DISPLAY: Record<ServiceRequestStatus, StatusDisplayConfig> = {
  submitted: {
    label: '已送出',
    color: '#6B7280',
    bg: '#F3F4F6',
    twClasses: 'bg-gray-100 text-gray-700',
  },
  screening: {
    label: '審核中',
    color: '#1D4ED8',
    bg: '#DBEAFE',
    twClasses: 'bg-blue-100 text-blue-800',
  },
  candidate_proposed: {
    label: '已推薦',
    color: '#6D28D9',
    bg: '#EDE9FE',
    twClasses: 'bg-purple-100 text-purple-800',
  },
  caregiver_confirmed: {
    label: '家屬確認',
    color: '#0E7490',
    bg: '#CFFAFE',
    twClasses: 'bg-cyan-100 text-cyan-800',
  },
  provider_confirmed: {
    label: '服務者確認',
    color: '#15803D',
    bg: '#DCFCE7',
    twClasses: 'bg-green-100 text-green-800',
  },
  arranged: {
    label: '已安排',
    color: '#166534',
    bg: '#BBF7D0',
    twClasses: 'bg-green-200 text-green-900',
  },
  in_service: {
    label: '服務中',
    color: '#C2410C',
    bg: '#FFEDD5',
    twClasses: 'bg-orange-100 text-orange-800',
  },
  completed: {
    label: '已完成',
    color: '#15803D',
    bg: '#DCFCE7',
    twClasses: 'bg-green-100 text-green-800',
  },
  cancelled: {
    label: '已取消',
    color: '#991B1B',
    bg: '#FEE2E2',
    twClasses: 'bg-red-100 text-red-800',
  },
} as const;

// ---------------------------------------------------------------------------
// AI Health Status Display
// ---------------------------------------------------------------------------

export const AI_STATUS_DISPLAY: Record<AiStatusLabel, StatusDisplayConfig> = {
  stable: {
    label: '穩定',
    color: '#166534',
    bg: '#DCFCE7',
    twClasses: 'bg-green-100 text-green-800',
  },
  attention: {
    label: '需注意',
    color: '#854D0E',
    bg: '#FEF9C3',
    twClasses: 'bg-yellow-100 text-yellow-800',
  },
  consult_doctor: {
    label: '建議就醫',
    color: '#991B1B',
    bg: '#FEE2E2',
    twClasses: 'bg-red-100 text-red-800',
  },
} as const;

// ---------------------------------------------------------------------------
// Provider Review Status Display
// ---------------------------------------------------------------------------

export const PROVIDER_REVIEW_STATUS_DISPLAY: Record<ProviderReviewStatus, StatusDisplayConfig> = {
  pending: {
    label: '待審核',
    color: '#A16207',
    bg: '#FEF9C3',
    twClasses: 'bg-yellow-100 text-yellow-800',
  },
  approved: {
    label: '已核准',
    color: '#15803D',
    bg: '#DCFCE7',
    twClasses: 'bg-green-100 text-green-800',
  },
  suspended: {
    label: '已停權',
    color: '#991B1B',
    bg: '#FEE2E2',
    twClasses: 'bg-red-100 text-red-800',
  },
} as const;

// ---------------------------------------------------------------------------
// Provider Availability Status Display
// ---------------------------------------------------------------------------

export const PROVIDER_AVAILABILITY_DISPLAY: Record<string, StatusDisplayConfig> = {
  available: {
    label: '可接案',
    color: '#15803D',
    bg: '#DCFCE7',
    twClasses: 'bg-green-100 text-green-800',
  },
  busy: {
    label: '忙碌中',
    color: '#C2410C',
    bg: '#FFEDD5',
    twClasses: 'bg-orange-100 text-orange-800',
  },
  offline: {
    label: '離線',
    color: '#6B7280',
    bg: '#F3F4F6',
    twClasses: 'bg-gray-100 text-gray-600',
  },
} as const;

// ---------------------------------------------------------------------------
// Provider Level Display
// ---------------------------------------------------------------------------

export const PROVIDER_LEVEL_DISPLAY: Record<string, { label: string }> = {
  L1: { label: '初級' },
  L2: { label: '中級' },
  L3: { label: '資深' },
} as const;

// ---------------------------------------------------------------------------
// Time Slot Display
// ---------------------------------------------------------------------------

export const TIME_SLOT_DISPLAY: Record<string, { label: string }> = {
  morning: { label: '上午' },
  afternoon: { label: '下午' },
  evening: { label: '晚上' },
} as const;

// ---------------------------------------------------------------------------
// Glucose Timing Display
// ---------------------------------------------------------------------------

export const GLUCOSE_TIMING_DISPLAY: Record<string, { label: string }> = {
  fasting: { label: '空腹' },
  before_meal: { label: '餐前' },
  after_meal: { label: '餐後' },
  random: { label: '隨機' },
} as const;

// ---------------------------------------------------------------------------
// Notification Type Display
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPE_DISPLAY: Record<string, { label: string; icon: string }> = {
  measurement_reminder: { label: '量測提醒', icon: '⏰' },
  abnormal_alert: { label: '異常通知', icon: '⚠️' },
  appointment_reminder: { label: '行程提醒', icon: '📅' },
  service_request_update: { label: '需求更新', icon: '📋' },
  ai_report_ready: { label: '報告完成', icon: '📊' },
} as const;
