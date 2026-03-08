import { NextRequest } from 'next/server';
import { MeasurementStatsQuerySchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

// Max measurements to load for stats (30d × 4/day × safety margin)
const STATS_MAX_ROWS = 500;

type StatRow = {
  systolic: number | null;
  diastolic: number | null;
  heart_rate: number | null;
  glucose_value: { toNumber(): number } | null;
  is_abnormal: boolean;
  measured_at: Date;
};

function aggregateNumbers(values: number[]) {
  if (values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return {
    min,
    max,
    avg: Math.round((sum / values.length) * 10) / 10,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const url = new URL(request.url);
    const queryObj: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryObj[key] = value;
    }

    const parsed = MeasurementStatsQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '查詢參數驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, type, period } = parsed.data;

    // Ownership check
    const recipient = await prisma.recipient.findFirst({
      where: { id: recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (auth.role === 'caregiver' && recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    // Calculate date range
    const days = period === '7d' ? 7 : 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    // Fetch measurements in range with safety limit
    const measurements: StatRow[] = await prisma.measurement.findMany({
      where: {
        recipient_id,
        type,
        measured_at: { gte: fromDate },
      },
      orderBy: { measured_at: 'asc' },
      take: STATS_MAX_ROWS,
      select: {
        systolic: true,
        diastolic: true,
        heart_rate: true,
        glucose_value: true,
        is_abnormal: true,
        measured_at: true,
      },
    });

    const count = measurements.length;
    const abnormalCount = measurements.filter((m) => m.is_abnormal).length;

    // Build daily_data
    const dailyMap = new Map<string, {
      systolicSum: number; systolicCount: number;
      diastolicSum: number; diastolicCount: number;
      heartRateSum: number; heartRateCount: number;
      glucoseSum: number; glucoseCount: number;
      isAbnormal: boolean; count: number;
    }>();

    for (const m of measurements) {
      const dateKey = m.measured_at.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateKey) ?? {
        systolicSum: 0, systolicCount: 0,
        diastolicSum: 0, diastolicCount: 0,
        heartRateSum: 0, heartRateCount: 0,
        glucoseSum: 0, glucoseCount: 0,
        isAbnormal: false, count: 0,
      };

      existing.count++;
      if (m.is_abnormal) existing.isAbnormal = true;

      if (m.systolic !== null) {
        existing.systolicSum += m.systolic;
        existing.systolicCount++;
      }
      if (m.diastolic !== null) {
        existing.diastolicSum += m.diastolic;
        existing.diastolicCount++;
      }
      if (m.heart_rate !== null) {
        existing.heartRateSum += m.heart_rate;
        existing.heartRateCount++;
      }
      if (m.glucose_value !== null) {
        existing.glucoseSum += Number(m.glucose_value);
        existing.glucoseCount++;
      }

      dailyMap.set(dateKey, existing);
    }

    const dailyData = Array.from(dailyMap.entries()).map(([date, d]) => {
      if (type === 'blood_pressure') {
        return {
          date,
          systolic_avg: d.systolicCount > 0 ? Math.round(d.systolicSum / d.systolicCount * 10) / 10 : null,
          diastolic_avg: d.diastolicCount > 0 ? Math.round(d.diastolicSum / d.diastolicCount * 10) / 10 : null,
          is_abnormal: d.isAbnormal,
          count: d.count,
        };
      }
      return {
        date,
        glucose_avg: d.glucoseCount > 0 ? Math.round(d.glucoseSum / d.glucoseCount * 10) / 10 : null,
        is_abnormal: d.isAbnormal,
        count: d.count,
      };
    });

    // Compute aggregate stats using safe reduce (no spread)
    if (type === 'blood_pressure') {
      const systolics = measurements.map((m) => m.systolic).filter((v): v is number => v !== null);
      const diastolics = measurements.map((m) => m.diastolic).filter((v): v is number => v !== null);
      const heartRates = measurements.map((m) => m.heart_rate).filter((v): v is number => v !== null);

      return successResponse({
        period,
        type,
        count,
        systolic: aggregateNumbers(systolics),
        diastolic: aggregateNumbers(diastolics),
        heart_rate: aggregateNumbers(heartRates),
        abnormal_count: abnormalCount,
        daily_data: dailyData,
      });
    }

    // blood_glucose
    const glucoseValues = measurements
      .map((m) => m.glucose_value ? Number(m.glucose_value) : null)
      .filter((v): v is number => v !== null);

    return successResponse({
      period,
      type,
      count,
      glucose_value: aggregateNumbers(glucoseValues),
      abnormal_count: abnormalCount,
      daily_data: dailyData,
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
