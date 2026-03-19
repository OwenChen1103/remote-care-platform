import { describe, it, expect } from 'vitest';
import { RecipientCreateSchema, RecipientUpdateSchema } from '../src/schemas/recipient';

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
