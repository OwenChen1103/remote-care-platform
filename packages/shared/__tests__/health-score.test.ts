import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from '../src/utils/health-score';

describe('calculateHealthScore', () => {
  it('returns null when total_count is 0 for both types (brand-new recipient)', () => {
    // Truly no data ever — show empty hero, not 「100 分 良好」.
    const result = calculateHealthScore({
      bpStats: { count: 0, total_count: 0, abnormal_count: 0 },
      bgStats: { count: 0, total_count: 0, abnormal_count: 0 },
      aiStatusLabel: null,
    });
    expect(result).toBeNull();
  });

  it('still computes a score when total_count > 0 but period count = 0 (stale data)', () => {
    // Recipient recorded measurements >7 days ago — they shouldn't be mistaken
    // for a brand-new recipient. Show the score (will be 100 since no recent
    // abnormal events, but that's an accurate reflection).
    const result = calculateHealthScore({
      bpStats: { count: 0, total_count: 12, abnormal_count: 0 },
      bgStats: { count: 0, total_count: 0, abnormal_count: 0 },
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
  });

  it('falls back to period count when total_count is omitted (legacy caller)', () => {
    // Backwards-compat path: pre-total_count callers still get null on no recent data.
    const result = calculateHealthScore({
      bpStats: { count: 0, abnormal_count: 0 },
      bgStats: { count: 0, abnormal_count: 0 },
    });
    expect(result).toBeNull();
  });

  it('returns null when stats objects are null AND no AI status', () => {
    // Defensive: also handle pre-fetch state where stats are still null.
    expect(calculateHealthScore({ bpStats: null, bgStats: null })).toBeNull();
  });

  it('returns null when total_count=0 even if aiStatusLabel is set', () => {
    // AI report without underlying measurements is meaningless — the score
    // should still be null. (In practice, the health-report route now blocks
    // generation when measurements are empty, so this branch is double protection.)
    const result = calculateHealthScore({
      bpStats: { count: 0, total_count: 0, abnormal_count: 0 },
      bgStats: { count: 0, total_count: 0, abnormal_count: 0 },
      aiStatusLabel: 'attention',
    });
    expect(result).toBeNull();
  });

  it('returns 100 / excellent when bp + bg are normal and no abnormal events', () => {
    const result = calculateHealthScore({
      bpStats: {
        count: 7,
        abnormal_count: 0,
        systolic: { avg: 120 },
        diastolic: { avg: 78 },
      },
      bgStats: {
        count: 5,
        abnormal_count: 0,
        glucose_value: { avg: 95 },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
    expect(result!.level).toBe('excellent');
  });

  it('subtracts 20 for clearly abnormal blood pressure averages', () => {
    const result = calculateHealthScore({
      bpStats: {
        count: 7,
        abnormal_count: 0,
        systolic: { avg: 145 }, // ≥140 = abnormal
        diastolic: { avg: 88 },
      },
      bgStats: { count: 1, abnormal_count: 0 },
    });
    expect(result!.score).toBe(80);
  });

  it('penalises AI status_label "attention" by 10 only when there is measurement data', () => {
    const result = calculateHealthScore({
      bpStats: { count: 3, abnormal_count: 0, systolic: { avg: 120 }, diastolic: { avg: 78 } },
      bgStats: { count: 0, abnormal_count: 0 },
      aiStatusLabel: 'attention',
    });
    expect(result!.score).toBe(90);
  });

  it('caps abnormal-count penalty at -30', () => {
    const result = calculateHealthScore({
      bpStats: { count: 10, abnormal_count: 20 }, // would be -100 unclamped
      bgStats: { count: 5, abnormal_count: 5 },
    });
    // -30 cap + clamp to 0 floor → 70
    expect(result!.score).toBe(70);
  });

  it('clamps score to 0 floor', () => {
    const result = calculateHealthScore({
      bpStats: {
        count: 10,
        abnormal_count: 20,
        systolic: { avg: 200 },
        diastolic: { avg: 110 },
      },
      bgStats: {
        count: 10,
        abnormal_count: 10,
        glucose_value: { avg: 300 },
      },
      aiStatusLabel: 'consult_doctor',
    });
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
  });
});
