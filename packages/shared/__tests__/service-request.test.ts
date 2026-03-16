import { describe, it, expect } from 'vitest';
import {
  ServiceRequestCreateSchema,
  ServiceRequestStatusUpdateSchema,
  ServiceRequestCancelSchema,
  ServiceCategoryUpdateSchema,
  ServiceRequestListQuerySchema,
  ServiceRequestProposeCandidateSchema,
  ServiceRequestCaregiverConfirmSchema,
  ServiceRequestProviderConfirmSchema,
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

describe('ServiceRequestProposeCandidateSchema', () => {
  it('accepts valid input', () => {
    expect(
      ServiceRequestProposeCandidateSchema.safeParse({
        provider_id: '00000000-0000-4000-a000-000000000041',
      }).success,
    ).toBe(true);
  });

  it('accepts optional admin_note', () => {
    expect(
      ServiceRequestProposeCandidateSchema.safeParse({
        provider_id: '00000000-0000-4000-a000-000000000041',
        admin_note: '候選人具陪診經驗',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid uuid', () => {
    expect(
      ServiceRequestProposeCandidateSchema.safeParse({
        provider_id: 'not-uuid',
      }).success,
    ).toBe(false);
  });
});

describe('ServiceRequestCaregiverConfirmSchema', () => {
  it('accepts confirm=true', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({ confirm: true }).success,
    ).toBe(true);
  });

  it('accepts confirm=false with note', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({ confirm: false, note: '時間不合' }).success,
    ).toBe(true);
  });

  it('rejects missing confirm', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({}).success,
    ).toBe(false);
  });

  it('rejects note over 500 chars', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({ confirm: true, note: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('ServiceRequestProviderConfirmSchema', () => {
  it('accepts confirm=true with provider_note', () => {
    expect(
      ServiceRequestProviderConfirmSchema.safeParse({
        confirm: true,
        provider_note: '可於當日上午到場',
      }).success,
    ).toBe(true);
  });

  it('accepts confirm=false', () => {
    expect(
      ServiceRequestProviderConfirmSchema.safeParse({ confirm: false }).success,
    ).toBe(true);
  });

  it('rejects provider_note over 1000 chars', () => {
    expect(
      ServiceRequestProviderConfirmSchema.safeParse({
        confirm: true,
        provider_note: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
  });
});
