import { describe, it, expect } from 'vitest';
import {
  MeasurementCreateSchema,
  MeasurementQuerySchema,
  MeasurementStatsQuerySchema,
} from '../src/schemas/measurement';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

describe('MeasurementCreateSchema', () => {
  it('should accept valid blood_pressure input', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'blood_pressure',
      recipient_id: VALID_UUID,
      systolic: 120,
      diastolic: 80,
      heart_rate: 72,
      unit: 'mmHg',
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid blood_glucose input', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'blood_glucose',
      recipient_id: VALID_UUID,
      glucose_value: 95,
      glucose_timing: 'fasting',
      unit: 'mg/dL',
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(true);
  });

  it('should reject blood_pressure with systolic out of range (301)', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'blood_pressure',
      recipient_id: VALID_UUID,
      systolic: 301,
      diastolic: 80,
      unit: 'mmHg',
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject blood_pressure with diastolic out of range (201)', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'blood_pressure',
      recipient_id: VALID_UUID,
      systolic: 120,
      diastolic: 201,
      unit: 'mmHg',
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject blood_glucose with glucose_value out of range (801)', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'blood_glucose',
      recipient_id: VALID_UUID,
      glucose_value: 801,
      glucose_timing: 'fasting',
      unit: 'mg/dL',
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject unknown type', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'temperature',
      recipient_id: VALID_UUID,
      value: 36.5,
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing recipient_id', () => {
    const result = MeasurementCreateSchema.safeParse({
      type: 'blood_pressure',
      systolic: 120,
      diastolic: 80,
      unit: 'mmHg',
      measured_at: '2026-03-19T10:00:00+08:00',
    });
    expect(result.success).toBe(false);
  });
});

describe('MeasurementQuerySchema', () => {
  it('should accept valid query with all fields', () => {
    const result = MeasurementQuerySchema.safeParse({
      recipient_id: VALID_UUID,
      type: 'blood_pressure',
      from: '2026-03-01T00:00:00Z',
      to: '2026-03-19T23:59:59Z',
      page: 2,
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should accept minimal query (only recipient_id)', () => {
    const result = MeasurementQuerySchema.safeParse({
      recipient_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('should default page to 1 and limit to 20', () => {
    const result = MeasurementQuerySchema.safeParse({
      recipient_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

describe('MeasurementStatsQuerySchema', () => {
  it('should accept valid stats query', () => {
    const result = MeasurementStatsQuerySchema.safeParse({
      recipient_id: VALID_UUID,
      type: 'blood_pressure',
      period: '7d',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const result = MeasurementStatsQuerySchema.safeParse({
      recipient_id: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});
