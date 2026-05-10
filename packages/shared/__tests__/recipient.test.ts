import { describe, it, expect } from 'vitest';
import { RecipientCreateSchema, RecipientUpdateSchema, RecipientResponseSchema } from '../src/schemas/recipient';

describe('RecipientCreateSchema', () => {
  it('should accept valid input with all fields', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
      date_of_birth: '1990-01-15',
      gender: 'male',
      medical_tags: ['高血壓', '糖尿病'],
      emergency_contact_name: '王小明',
      emergency_contact_phone: '0912345678',
      notes: '每日需量血壓',
    });
    expect(result.success).toBe(true);
  });

  it('should accept minimal input (only name)', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.medical_tags).toEqual([]);
    }
  });

  it('should reject empty name', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name over 100 chars', () => {
    const result = RecipientCreateSchema.safeParse({
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid date_of_birth format', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
      date_of_birth: '01-15-1990',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid gender', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
      gender: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('should default medical_tags to []', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.medical_tags).toEqual([]);
    }
  });

  it('should reject medical_tags over 20 items', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
      medical_tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('RecipientUpdateSchema', () => {
  it('should accept partial update (name only)', () => {
    const result = RecipientUpdateSchema.safeParse({
      name: '新名字',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('新名字');
    }
  });

  it('should accept empty object (all optional)', () => {
    const result = RecipientUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('Patient binding (Section 1)', () => {
  it('Create accepts patient_user_email (optional)', () => {
    const result = RecipientCreateSchema.safeParse({
      name: '王大明',
      patient_user_email: 'patient@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.patient_user_email).toBe('patient@example.com');
  });

  it('Create rejects invalid email', () => {
    expect(RecipientCreateSchema.safeParse({
      name: '王大明',
      patient_user_email: 'not-an-email',
    }).success).toBe(false);
  });

  it('Update accepts null patient_user_email (explicit unbind)', () => {
    const result = RecipientUpdateSchema.safeParse({ patient_user_email: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.patient_user_email).toBeNull();
  });

  it('Update accepts string patient_user_email (rebind)', () => {
    const result = RecipientUpdateSchema.safeParse({ patient_user_email: 'new@example.com' });
    expect(result.success).toBe(true);
  });

  it('Update accepts undefined patient_user_email (no change)', () => {
    const result = RecipientUpdateSchema.safeParse({ name: '只改名字' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.patient_user_email).toBeUndefined();
  });
});

// G6 — RecipientResponseSchema returns lifestyle_habits (default {} when unset).
// Without these tests we'd silently regress the response shape if formatRecipient
// stops returning the field again.
describe('RecipientResponseSchema lifestyle_habits (G6)', () => {
  const baseResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    caregiver_id: '660e8400-e29b-41d4-a716-446655440001',
    patient_user_id: null,
    patient_user_email: null,
    patient_user_name: null,
    name: '王奶奶',
    date_of_birth: null,
    gender: null,
    relationship: null,
    medical_tags: [],
    emergency_contact_name: null,
    emergency_contact_phone: null,
    address: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('defaults lifestyle_habits to empty object when omitted', () => {
    const result = RecipientResponseSchema.safeParse(baseResponse);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lifestyle_habits).toEqual({});
  });

  it('accepts manager_fill flag without other fields', () => {
    const result = RecipientResponseSchema.safeParse({
      ...baseResponse,
      lifestyle_habits: { manager_fill: true },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lifestyle_habits.manager_fill).toBe(true);
  });

  it('accepts all 5 detail fields', () => {
    const result = RecipientResponseSchema.safeParse({
      ...baseResponse,
      lifestyle_habits: {
        water_intake: '2000ml',
        exercise_frequency: '每週3次',
        exercise_intensity: '中強度',
        starch_intake: '半碗飯',
        protein_intake: '一顆蛋',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lifestyle_habits.water_intake).toBe('2000ml');
      expect(result.data.lifestyle_habits.exercise_frequency).toBe('每週3次');
    }
  });
});
