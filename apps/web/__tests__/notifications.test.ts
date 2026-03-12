import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.CRON_SECRET = 'test-cron-secret';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    notification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    measurementReminder: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    recipient: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/csrf', () => ({
  checkOrigin: () => true,
}));

import { GET as listHandler } from '../app/api/v1/notifications/route';
import { GET as unreadCountHandler } from '../app/api/v1/notifications/unread-count/route';
import { PUT as markReadHandler } from '../app/api/v1/notifications/[id]/read/route';
import { PUT as readAllHandler } from '../app/api/v1/notifications/read-all/route';
import { GET as getRemindersHandler } from '../app/api/v1/recipients/[id]/reminders/route';
import { PUT as updateReminderHandler } from '../app/api/v1/recipients/[id]/reminders/[type]/route';
import { GET as cronHandler } from '../app/api/cron/reminders/route';
import { signJwt } from '../lib/auth';

function createRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  url = 'http://localhost:3000/api/v1/notifications',
): NextRequest {
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(url, options);
}

const caregiverToken = () => signJwt({ userId: 'user-aaa', role: 'caregiver' });
const patientToken = () => signJwt({ userId: 'patient-111', role: 'patient' });
const providerToken = () => signJwt({ userId: 'provider-111', role: 'provider' });
const adminToken = () => signJwt({ userId: 'admin-bbb', role: 'admin' });

const mockNotification = {
  id: 'notif-111',
  user_id: 'user-aaa',
  type: 'measurement_reminder',
  title: '王奶奶 量測提醒',
  body: '該為王奶奶進行早上量測了。',
  data: { recipient_id: 'rec-111', reminder_type: 'morning' },
  is_read: false,
  created_at: new Date('2026-03-09T08:00:00Z'),
};

const mockReminder = {
  id: 'rem-111',
  recipient_id: 'rec-111',
  reminder_type: 'morning',
  reminder_time: new Date('1970-01-01T08:00:00Z'),
  is_enabled: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

const mockRecipient = {
  id: 'rec-111',
  caregiver_id: 'user-aaa',
  patient_user_id: 'patient-111',
  name: '王奶奶',
  deleted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/v1/notifications ──────────────────────────────

describe('GET /api/v1/notifications', () => {
  it('should return notification list for caregiver', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
    mockPrisma.notification.count.mockResolvedValue(1);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    });
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].type).toBe('measurement_reminder');
  });

  it('should allow admin role to fetch own notifications', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
    mockPrisma.notification.count.mockResolvedValue(1);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${adminToken()}`,
    });
    const response = await listHandler(request);

    expect(response.status).toBe(200);
  });

  it('should allow patient role', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
    mockPrisma.notification.count.mockResolvedValue(1);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${patientToken()}`,
    });
    const response = await listHandler(request);

    expect(response.status).toBe(200);
  });

  it('should require auth', async () => {
    const request = createRequest('GET');
    const response = await listHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});

// ─── GET /api/v1/notifications/unread-count ─────────────────

describe('GET /api/v1/notifications/unread-count', () => {
  it('should return unread count', async () => {
    mockPrisma.notification.count.mockResolvedValue(5);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/notifications/unread-count');
    const response = await unreadCountHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.count).toBe(5);
  });

  it('should return unread count for provider', async () => {
    mockPrisma.notification.count.mockResolvedValue(2);
    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${providerToken()}`,
    }, 'http://localhost:3000/api/v1/notifications/unread-count');

    const response = await unreadCountHandler(request);
    expect(response.status).toBe(200);
  });
});

// ─── PUT /api/v1/notifications/:id/read ─────────────────────

describe('PUT /api/v1/notifications/:id/read', () => {
  it('should mark notification as read', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);
    mockPrisma.notification.update.mockResolvedValue({ ...mockNotification, is_read: true });

    const request = createRequest('PUT', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/notifications/notif-111/read');
    const params = Promise.resolve({ id: 'notif-111' });
    const response = await markReadHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return 404 for non-existent notification', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const request = createRequest('PUT', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/notifications/notif-999/read');
    const params = Promise.resolve({ id: 'notif-999' });
    const response = await markReadHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

// ─── PUT /api/v1/notifications/read-all ─────────────────────

describe('PUT /api/v1/notifications/read-all', () => {
  it('should mark all as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const request = createRequest('PUT', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/notifications/read-all');
    const response = await readAllHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── GET /api/v1/recipients/:id/reminders ───────────────────

describe('GET /api/v1/recipients/:id/reminders', () => {
  it('should return reminders for owned recipient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    mockPrisma.measurementReminder.findMany.mockResolvedValue([mockReminder]);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111/reminders');
    const params = Promise.resolve({ id: 'rec-111' });
    const response = await getRemindersHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reminder_type).toBe('morning');
    expect(body.data[0].reminder_time).toBe('08:00');
  });

  it('should return 404 for non-owned recipient', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(null);

    const request = createRequest('GET', undefined, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-999/reminders');
    const params = Promise.resolve({ id: 'rec-999' });
    const response = await getRemindersHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

// ─── PUT /api/v1/recipients/:id/reminders/:type ─────────────

describe('PUT /api/v1/recipients/:id/reminders/:type', () => {
  it('should update reminder time', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    const updatedReminder = {
      ...mockReminder,
      reminder_time: new Date('1970-01-01T07:30:00Z'),
      updated_at: new Date('2026-03-09T00:00:00Z'),
    };
    mockPrisma.measurementReminder.update.mockResolvedValue(updatedReminder);

    const request = createRequest('PUT', { reminder_time: '07:30' }, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111/reminders/morning');
    const params = Promise.resolve({ id: 'rec-111', type: 'morning' });
    const response = await updateReminderHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reminder_time).toBe('07:30');
  });

  it('should update is_enabled', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);
    const updatedReminder = { ...mockReminder, is_enabled: false };
    mockPrisma.measurementReminder.update.mockResolvedValue(updatedReminder);

    const request = createRequest('PUT', { is_enabled: false }, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111/reminders/morning');
    const params = Promise.resolve({ id: 'rec-111', type: 'morning' });
    const response = await updateReminderHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.is_enabled).toBe(false);
  });

  it('should reject invalid reminder type', async () => {
    const request = createRequest('PUT', { is_enabled: false }, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111/reminders/afternoon');
    const params = Promise.resolve({ id: 'rec-111', type: 'afternoon' });
    const response = await updateReminderHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject empty update body', async () => {
    mockPrisma.recipient.findFirst.mockResolvedValue(mockRecipient);

    const request = createRequest('PUT', {}, {
      Authorization: `Bearer ${caregiverToken()}`,
    }, 'http://localhost:3000/api/v1/recipients/rec-111/reminders/morning');
    const params = Promise.resolve({ id: 'rec-111', type: 'morning' });
    const response = await updateReminderHandler(request, { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /api/cron/reminders ────────────────────────────────

describe('GET /api/cron/reminders', () => {
  it('should reject without CRON_SECRET', async () => {
    const request = createRequest('GET', undefined, {}, 'http://localhost:3000/api/cron/reminders');
    const response = await cronHandler(request);

    expect(response.status).toBe(401);
  });

  it('should process reminders with valid secret', async () => {
    mockPrisma.measurementReminder.findMany.mockResolvedValue([]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 0 });

    const request = createRequest('GET', undefined, {
      Authorization: 'Bearer test-cron-secret',
    }, 'http://localhost:3000/api/cron/reminders');
    const response = await cronHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.matched).toBe(0);
  });

  it('should create notifications for matching reminders', async () => {
    // Mock a reminder that matches current time
    const now = new Date();
    const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const currentHour = taipeiTime.getHours();
    const currentMinute = taipeiTime.getMinutes();

    const matchingReminder = {
      ...mockReminder,
      reminder_time: new Date(`1970-01-01T${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00Z`),
      recipient: mockRecipient,
    };

    mockPrisma.measurementReminder.findMany.mockResolvedValue([matchingReminder]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    const request = createRequest('GET', undefined, {
      Authorization: 'Bearer test-cron-secret',
    }, 'http://localhost:3000/api/cron/reminders');
    const response = await cronHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.matched).toBe(1);
    expect(body.created).toBe(1);
  });
});
