import { describe, it, expect } from 'vitest';
import {
  ServiceRequestCreateSchema,
  ServiceRequestStatusUpdateSchema,
  ServiceRequestCancelSchema,
  ServiceCategoryUpdateSchema,
  ServiceRequestListQuerySchema,
} from '../src/schemas/service-request';

describe('ServiceRequestCreateSchema', () => {
  const valid = {
    recipient_id: '00000000-0000-4000-a000-000000000001',
    category_id: '00000000-0000-4000-a000-000000000021',
    preferred_date: '2026-04-01T00:00:00.000Z',
    location: '台北市信義區',
    description: '陪同就醫回診',
  };

  it('accepts valid input', () => {
    expect(ServiceRequestCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional preferred_time_slot', () => {
    expect(
      ServiceRequestCreateSchema.safeParse({ ...valid, preferred_time_slot: 'morning' }).success,
    ).toBe(true);
  });

  it('rejects invalid uuid', () => {
    expect(
      ServiceRequestCreateSchema.safeParse({ ...valid, recipient_id: 'not-uuid' }).success,
    ).toBe(false);
  });

  it('rejects empty description', () => {
    expect(
      ServiceRequestCreateSchema.safeParse({ ...valid, description: '' }).success,
    ).toBe(false);
  });

  it('rejects empty location', () => {
    expect(
      ServiceRequestCreateSchema.safeParse({ ...valid, location: '' }).success,
    ).toBe(false);
  });
});

describe('ServiceRequestStatusUpdateSchema', () => {
  it('accepts valid status', () => {
    expect(
      ServiceRequestStatusUpdateSchema.safeParse({ status: 'screening' }).success,
    ).toBe(true);
  });

  it('accepts optional admin_note', () => {
    expect(
      ServiceRequestStatusUpdateSchema.safeParse({ status: 'screening', admin_note: '備註' })
        .success,
    ).toBe(true);
  });

  it('rejects invalid status value', () => {
    expect(
      ServiceRequestStatusUpdateSchema.safeParse({ status: 'invalid_status' }).success,
    ).toBe(false);
  });
});

describe('ServiceRequestCancelSchema', () => {
  it('accepts empty object', () => {
    expect(ServiceRequestCancelSchema.safeParse({}).success).toBe(true);
  });

  it('accepts reason', () => {
    expect(
      ServiceRequestCancelSchema.safeParse({ reason: '不需要了' }).success,
    ).toBe(true);
  });

  it('rejects reason over 500 chars', () => {
    expect(
      ServiceRequestCancelSchema.safeParse({ reason: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('ServiceCategoryUpdateSchema', () => {
  it('accepts partial update', () => {
    expect(ServiceCategoryUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
  });

  it('accepts name + sort_order', () => {
    expect(
      ServiceCategoryUpdateSchema.safeParse({ name: '新名稱', sort_order: 5 }).success,
    ).toBe(true);
  });

  it('rejects negative sort_order', () => {
    expect(
      ServiceCategoryUpdateSchema.safeParse({ sort_order: -1 }).success,
    ).toBe(false);
  });

  it('accepts empty object (no fields to update)', () => {
    expect(ServiceCategoryUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('ServiceRequestListQuerySchema', () => {
  it('provides defaults for page and limit', () => {
    const result = ServiceRequestListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('accepts status filter', () => {
    const result = ServiceRequestListQuerySchema.safeParse({ status: 'submitted' });
    expect(result.success).toBe(true);
  });

  it('coerces string page to number', () => {
    const result = ServiceRequestListQuerySchema.safeParse({ page: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });
});
