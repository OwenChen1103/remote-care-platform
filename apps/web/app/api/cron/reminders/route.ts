import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NOTIFICATION_TYPES } from '@remote-care/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Current time in Asia/Taipei (MVP hardcode)
  const now = new Date();
  const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const currentHour = taipeiTime.getHours();
  const currentMinute = taipeiTime.getMinutes();

  // Find enabled reminders matching current HH:mm
  // reminder_time is stored as Time (1970-01-01T HH:mm:00Z)
  const reminders = await prisma.measurementReminder.findMany({
    where: {
      is_enabled: true,
    },
    include: {
      recipient: {
        select: {
          id: true,
          name: true,
          caregiver_id: true,
          deleted_at: true,
        },
      },
    },
  });

  const matchingReminders = reminders.filter((r) => {
    if (r.recipient.deleted_at !== null) return false;
    const reminderHour = r.reminder_time.getUTCHours();
    const reminderMinute = r.reminder_time.getUTCMinutes();
    return reminderHour === currentHour && reminderMinute === currentMinute;
  });

  const notifications = matchingReminders.map((r) => ({
    user_id: r.recipient.caregiver_id,
    type: NOTIFICATION_TYPES.MEASUREMENT_REMINDER,
    title: `${r.recipient.name} 量測提醒`,
    body: `該為 ${r.recipient.name} 進行${r.reminder_type === 'morning' ? '早上' : '晚上'}量測了。`,
    data: {
      recipient_id: r.recipient.id,
      reminder_type: r.reminder_type,
    },
  }));

  let created = 0;
  if (notifications.length > 0) {
    const result = await prisma.notification.createMany({ data: notifications });
    created = result.count;
  }

  return NextResponse.json({
    ok: true,
    matched: matchingReminders.length,
    created,
  });
}
