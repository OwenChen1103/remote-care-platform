import { NextRequest } from 'next/server';
import { MeasurementExportQuerySchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

/** Only call with non-empty arrays (guarded by caller). */
function safeMin(values: number[]): number {
  let min = Infinity;
  for (const v of values) {
    if (v < min) min = v;
  }
  return min;
}

function safeMax(values: number[]): number {
  let max = -Infinity;
  for (const v of values) {
    if (v > max) max = v;
  }
  return max;
}

function safeAvg(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return Math.round(sum / values.length);
}

type ExportRow = {
  systolic: number | null;
  diastolic: number | null;
  glucose_value: { toNumber(): number } | null;
  is_abnormal: boolean;
  measured_at: Date;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    if (auth.role !== 'caregiver') {
      return errorResponse('AUTH_FORBIDDEN', '僅照護者可匯出量測資料');
    }

    const url = new URL(request.url);
    const queryObj: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryObj[key] = value;
    }

    const parsed = MeasurementExportQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '查詢參數驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const { recipient_id, type, from, to } = parsed.data;

    // Ownership check
    const recipient = await prisma.recipient.findFirst({
      where: { id: recipient_id, deleted_at: null },
    });

    if (!recipient) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
    }

    if (recipient.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
    }

    // Fetch measurements
    const measurements: ExportRow[] = await prisma.measurement.findMany({
      where: {
        recipient_id,
        type,
        measured_at: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { measured_at: 'asc' },
    });

    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);
    const total = measurements.length;
    const abnormalCount = measurements.filter((m) => m.is_abnormal).length;
    const typeLabel = type === 'blood_pressure' ? '血壓' : '血糖';

    if (total === 0) {
      const text = [
        `【${typeLabel}紀錄摘要】${recipient.name}`,
        `期間：${fromDate} ~ ${toDate}`,
        `此期間無量測資料`,
        '',
        '--- 由遠端照護平台產生 ---',
        '此為健康數據紀錄，非醫療診斷。',
      ].join('\n');

      return successResponse({ text });
    }

    let text: string;

    if (type === 'blood_pressure') {
      const systolics = measurements.map((m) => m.systolic).filter((v): v is number => v !== null);
      const diastolics = measurements.map((m) => m.diastolic).filter((v): v is number => v !== null);

      if (systolics.length === 0) {
        text = buildEmptyText(typeLabel, recipient.name, fromDate, toDate);
      } else {
        const maxSysIdx = systolics.indexOf(safeMax(systolics));
        const minSysIdx = systolics.indexOf(safeMin(systolics));

        const bpMeasurements = measurements.filter((m) => m.systolic !== null);
        const maxEntry = bpMeasurements[maxSysIdx];
        const minEntry = bpMeasurements[minSysIdx];
        const maxTime = maxEntry ? formatDateTime(maxEntry.measured_at) : '';
        const minTime = minEntry ? formatDateTime(minEntry.measured_at) : '';

        text = [
          `【血壓紀錄摘要】${recipient.name}`,
          `期間：${fromDate} ~ ${toDate}`,
          `共 ${total} 筆紀錄`,
          '',
          `平均值：收縮壓 ${safeAvg(systolics)} / 舒張壓 ${safeAvg(diastolics)} mmHg`,
          `最高值：收縮壓 ${safeMax(systolics)} / 舒張壓 ${diastolics[maxSysIdx] ?? '-'} mmHg（${maxTime}）`,
          `最低值：收縮壓 ${safeMin(systolics)} / 舒張壓 ${diastolics[minSysIdx] ?? '-'} mmHg（${minTime}）`,
          `異常紀錄：${abnormalCount} 筆`,
          '',
          '--- 由遠端照護平台產生 ---',
          '此為健康數據紀錄，非醫療診斷。',
        ].join('\n');
      }
    } else {
      const glucoseValues = measurements
        .map((m) => m.glucose_value ? Number(m.glucose_value) : null)
        .filter((v): v is number => v !== null);

      if (glucoseValues.length === 0) {
        text = buildEmptyText(typeLabel, recipient.name, fromDate, toDate);
      } else {
        const maxIdx = glucoseValues.indexOf(safeMax(glucoseValues));
        const minIdx = glucoseValues.indexOf(safeMin(glucoseValues));

        const bgMeasurements = measurements.filter((m) => m.glucose_value !== null);
        const maxEntry = bgMeasurements[maxIdx];
        const minEntry = bgMeasurements[minIdx];
        const maxTime = maxEntry ? formatDateTime(maxEntry.measured_at) : '';
        const minTime = minEntry ? formatDateTime(minEntry.measured_at) : '';

        text = [
          `【血糖紀錄摘要】${recipient.name}`,
          `期間：${fromDate} ~ ${toDate}`,
          `共 ${total} 筆紀錄`,
          '',
          `平均值：${safeAvg(glucoseValues)} mg/dL`,
          `最高值：${safeMax(glucoseValues)} mg/dL（${maxTime}）`,
          `最低值：${safeMin(glucoseValues)} mg/dL（${minTime}）`,
          `異常紀錄：${abnormalCount} 筆`,
          '',
          '--- 由遠端照護平台產生 ---',
          '此為健康數據紀錄，非醫療診斷。',
        ].join('\n');
      }
    }

    return successResponse({ text });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}

function formatDateTime(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function buildEmptyText(typeLabel: string, name: string, fromDate: string, toDate: string): string {
  return [
    `【${typeLabel}紀錄摘要】${name}`,
    `期間：${fromDate} ~ ${toDate}`,
    `此期間無量測資料`,
    '',
    '--- 由遠端照護平台產生 ---',
    '此為健康數據紀錄，非醫療診斷。',
  ].join('\n');
}
