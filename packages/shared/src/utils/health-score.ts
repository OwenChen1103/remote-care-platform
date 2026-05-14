/**
 * Calculate a 0-100 health score based on 7-day measurement stats and AI report status.
 * This is a simplified heuristic for MVP — not a medical assessment.
 */

export interface HealthScoreInput {
  bpStats?: {
    /** Period-filtered count (e.g. last 7 days). Used for scoring penalties. */
    count: number;
    /** All-time count, independent of period. Used to detect "truly no data ever". */
    total_count?: number;
    abnormal_count: number;
    systolic?: { avg: number };
    diastolic?: { avg: number };
  } | null;
  bgStats?: {
    count: number;
    total_count?: number;
    abnormal_count: number;
    glucose_value?: { avg: number };
  } | null;
  aiStatusLabel?: string | null;
}

export type HealthLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface HealthScoreResult {
  score: number;
  level: HealthLevel;
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult | null {
  // Detect "truly no data ever" — use total_count (all-time, period-independent)
  // not count (period-filtered). A recipient who recorded measurements 30+ days
  // ago has count=0 in the 7-day window but total_count > 0; they should NOT be
  // shown the empty hero (it would mistake them for a brand-new recipient).
  // If total_count is not provided (legacy caller), fall back to count for the
  // safer "behave like brand-new" default.
  const bpHasEverData =
    (input.bpStats?.total_count ?? input.bpStats?.count ?? 0) > 0;
  const bgHasEverData =
    (input.bgStats?.total_count ?? input.bgStats?.count ?? 0) > 0;
  if (!bpHasEverData && !bgHasEverData) {
    return null;
  }

  let score = 100;

  // Blood pressure average penalty
  if (input.bpStats?.systolic && input.bpStats?.diastolic) {
    const sysAvg = input.bpStats.systolic.avg;
    const diaAvg = input.bpStats.diastolic.avg;
    if (sysAvg >= 140 || diaAvg >= 90) {
      score -= 20; // abnormal range
    } else if (sysAvg >= 130 || diaAvg >= 85) {
      score -= 10; // elevated
    }
  }

  // Blood glucose average penalty
  if (input.bgStats?.glucose_value) {
    const bgAvg = input.bgStats.glucose_value.avg;
    if (bgAvg >= 126 || bgAvg < 70) {
      score -= 20; // abnormal
    } else if (bgAvg >= 100) {
      score -= 10; // elevated
    }
  }

  // Abnormal count penalty (max -30)
  const totalAbnormal = (input.bpStats?.abnormal_count ?? 0) + (input.bgStats?.abnormal_count ?? 0);
  score -= Math.min(totalAbnormal * 5, 30);

  // AI status penalty
  if (input.aiStatusLabel === 'consult_doctor') {
    score -= 25;
  } else if (input.aiStatusLabel === 'attention') {
    score -= 10;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: HealthLevel;
  if (score >= 85) level = 'excellent';
  else if (score >= 65) level = 'good';
  else if (score >= 40) level = 'fair';
  else level = 'poor';

  return { score, level };
}

export const HEALTH_LEVEL_LABELS: Record<HealthLevel, string> = {
  excellent: '良好',
  good: '尚可',
  fair: '需留意',
  poor: '需關注',
};
