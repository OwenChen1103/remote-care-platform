import { describe, it, expect } from 'vitest';
import {
  NotificationListQuerySchema,
  NotificationResponseSchema,
  UnreadCountResponseSchema,
  ReminderUpdateSchema,
  ReminderResponseSchema,
} from '../index';

// ─── NotificationListQuerySchema ─────────────────────────────

describe('NotificationListQuerySchema', () => {
  it('should accept empty query (all defaults)', () => {
    const result = NotificationListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.is_read).toBeUndefined();
    }
  });

  it('should accept is_read=true as string', () => {
    const result = NotificationListQuerySchema.safeParse({ is_read: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_read).toBe(true);
    }
  });

  it('should accept is_read=false as string', () => {
    const result = NotificationListQuerySchema.safeParse({ is_read: 'false' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_read).toBe(false);
    }
  });

  it('should coerce page and limit from strings', () => {
    const result = NotificationListQuerySchema.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });

  it('should reject page < 1', () => {
    const result = NotificationListQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 100', () => {
    const result = NotificationListQuerySchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });
});

// ─── NotificationResponseSchema ──────────────────────────────

describe('NotificationResponseSchema', () => {
  const validNotification = {
    id: '00000000-0000-4000-a000-000000000001',
    type: 'abnormal_alert',
    title: '異常提醒',
    body: '王奶奶 近期血壓有多次異常紀錄',
    data: { recipient_id: '00000000-0000-4000-a000-000000000002' },
    is_read: false,
    created_at: '2026-03-09T08:00:00.000Z',
  };

  it('should accept valid notification', () => {
    const result = NotificationResponseSchema.safeParse(validNotification);
    expect(result.success).toBe(true);
  });

  it('should accept all notification types', () => {
    for (const type of [
      'measurement_reminder',
      'abnormal_alert',
      'appointment_reminder',
      'service_request_update',
      'ai_report_ready',
    ]) {
      const result = NotificationResponseSchema.safeParse({ ...validNotification, type });
      expect(result.success).toBe(true);
    }
  });

  it('should accept null data', () => {
    const result = NotificationResponseSchema.safeParse({ ...validNotification, data: null });
    expect(result.success).toBe(true);
  });

  it('should reject invalid type', () => {
    const result = NotificationResponseSchema.safeParse({ ...validNotification, type: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('should reject missing title', () => {
    const noTitle = { ...validNotification };
    delete (noTitle as Record<string, unknown>)['title'];
    const result = NotificationResponseSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });
});

// ─── UnreadCountResponseSchema ───────────────────────────────

describe('UnreadCountResponseSchema', () => {
  it('should accept valid count', () => {
    const result = UnreadCountResponseSchema.safeParse({ count: 5 });
    expect(result.success).toBe(true);
  });

  it('should accept zero', () => {
    const result = UnreadCountResponseSchema.safeParse({ count: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject negative count', () => {
    const result = UnreadCountResponseSchema.safeParse({ count: -1 });
    expect(result.success).toBe(false);
  });
});

// ─── ReminderUpdateSchema ────────────────────────────────────

describe('ReminderUpdateSchema', () => {
  it('should accept valid time update', () => {
    const result = ReminderUpdateSchema.safeParse({ reminder_time: '08:30' });
    expect(result.success).toBe(true);
  });

  it('should accept is_enabled only', () => {
    const result = ReminderUpdateSchema.safeParse({ is_enabled: false });
    expect(result.success).toBe(true);
  });

  it('should accept both fields', () => {
    const result = ReminderUpdateSchema.safeParse({ reminder_time: '07:00', is_enabled: true });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = ReminderUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject invalid time format 8:30', () => {
    const result = ReminderUpdateSchema.safeParse({ reminder_time: '8:30' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid time format 25:00', () => {
    const result = ReminderUpdateSchema.safeParse({ reminder_time: '25:00' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid time format HH:MM:SS', () => {
    const result = ReminderUpdateSchema.safeParse({ reminder_time: '08:30:00' });
    expect(result.success).toBe(false);
  });
});

// ─── ReminderResponseSchema ──────────────────────────────────

describe('ReminderResponseSchema', () => {
  const validReminder = {
    id: '00000000-0000-4000-a000-000000000001',
    recipient_id: '00000000-0000-4000-a000-000000000002',
    reminder_type: 'morning',
    reminder_time: '08:00',
    is_enabled: true,
    created_at: '2026-03-09T00:00:00.000Z',
    updated_at: '2026-03-09T00:00:00.000Z',
  };

  it('should accept valid morning reminder', () => {
    const result = ReminderResponseSchema.safeParse(validReminder);
    expect(result.success).toBe(true);
  });

  it('should accept evening reminder', () => {
    const result = ReminderResponseSchema.safeParse({ ...validReminder, reminder_type: 'evening' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid reminder_type', () => {
    const result = ReminderResponseSchema.safeParse({ ...validReminder, reminder_type: 'noon' });
    expect(result.success).toBe(false);
  });

  it('should reject missing recipient_id', () => {
    const noRecipient = { ...validReminder };
    delete (noRecipient as Record<string, unknown>)['recipient_id'];
    const result = ReminderResponseSchema.safeParse(noRecipient);
    expect(result.success).toBe(false);
  });
});
