import { describe, it, expect } from 'vitest';
import {
  ProviderCreateSchema,
  ProviderReviewSchema,
  ProviderSelfUpdateSchema,
} from '../src/schemas/provider';

describe('ProviderSelfUpdateSchema', () => {
  it('should accept valid self-update with availability_status', () => {
    const result = ProviderSelfUpdateSchema.safeParse({
      availability_status: 'busy',
    });
    expect(result.success).toBe(true);
  });

  it('should accept phone and service_areas update', () => {
    const result = ProviderSelfUpdateSchema.safeParse({
      phone: '0912345678',
      service_areas: ['台北市', '新北市'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject level change (admin only)', () => {
    const result = ProviderSelfUpdateSchema.safeParse({
      level: 'L3',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).level).toBeUndefined();
    }
  });

  it('should reject review_status change', () => {
    const result = ProviderSelfUpdateSchema.safeParse({
      review_status: 'approved',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).review_status).toBeUndefined();
    }
  });

  it('should accept empty object (no changes)', () => {
    const result = ProviderSelfUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('ProviderCreateSchema', () => {
  it('should accept minimal provider data', () => {
    const result = ProviderCreateSchema.safeParse({ name: '王小明' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe('L1');
    }
  });
});

describe('ProviderReviewSchema', () => {
  it('should accept approved with note', () => {
    const result = ProviderReviewSchema.safeParse({
      review_status: 'approved',
      admin_note: '資料審核通過',
    });
    expect(result.success).toBe(true);
  });

  it('should reject pending status', () => {
    const result = ProviderReviewSchema.safeParse({
      review_status: 'pending',
    });
    expect(result.success).toBe(false);
  });
});
