import { prisma } from '@/lib/prisma';
import { ABNORMAL_ALERT_RULES, NOTIFICATION_TYPES } from '@remote-care/shared';

/**
 * Check consecutive abnormal measurements and create notification if threshold met.
 * Called inline after creating an abnormal measurement.
 *
 * Rules (from spec D.4):
 * - Last RECENT_COUNT (3) measurements of same type for this recipient
 * - If >= ABNORMAL_THRESHOLD (2) are abnormal → create notification
 * - Dedup: no duplicate notification of same type within DEDUP_HOURS (24) hours
 */
export async function checkAndNotifyAbnormal(params: {
  recipientId: string;
  recipientName: string;
  caregiverUserId: string;
  measurementId: string;
  measurementType: string;
}): Promise<boolean> {
  const { recipientId, recipientName, caregiverUserId, measurementId, measurementType } = params;

  const typeLabel = measurementType === 'blood_pressure' ? '血壓' : '血糖';

  // Check last N measurements of same type
  const recentMeasurements: { is_abnormal: boolean }[] = await prisma.measurement.findMany({
    where: {
      recipient_id: recipientId,
      type: measurementType,
    },
    orderBy: { measured_at: 'desc' },
    take: ABNORMAL_ALERT_RULES.RECENT_COUNT,
    select: { is_abnormal: true },
  });

  const abnormalCount = recentMeasurements.filter((m) => m.is_abnormal).length;

  if (abnormalCount < ABNORMAL_ALERT_RULES.ABNORMAL_THRESHOLD) {
    return false;
  }

  // Dedup: scoped to same recipient AND same measurement type within 24h
  const dedupCutoff = new Date(Date.now() - ABNORMAL_ALERT_RULES.DEDUP_HOURS * 60 * 60 * 1000);

  const recentNotification = await prisma.notification.findFirst({
    where: {
      user_id: caregiverUserId,
      type: NOTIFICATION_TYPES.ABNORMAL_ALERT,
      created_at: { gte: dedupCutoff },
      AND: [
        { data: { path: ['recipient_id'], equals: recipientId } },
        { data: { path: ['measurement_type'], equals: measurementType } },
      ],
    },
  });

  if (recentNotification) {
    return false;
  }

  // Create notification with measurement_type in data for future dedup
  await prisma.notification.create({
    data: {
      user_id: caregiverUserId,
      type: NOTIFICATION_TYPES.ABNORMAL_ALERT,
      title: `${recipientName} ${typeLabel}連續異常`,
      body: `${recipientName} 近期${typeLabel}有多次異常紀錄，建議關注或安排就醫。`,
      data: {
        recipient_id: recipientId,
        measurement_id: measurementId,
        measurement_type: measurementType,
      },
    },
  });

  return true;
}
