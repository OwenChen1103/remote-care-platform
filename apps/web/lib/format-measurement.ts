import type { Decimal } from '@prisma/client/runtime/library';

export function formatMeasurement(m: {
  id: string;
  recipient_id: string;
  type: string;
  systolic: number | null;
  diastolic: number | null;
  heart_rate: number | null;
  glucose_value: Decimal | null;
  glucose_timing: string | null;
  unit: string;
  source: string;
  device_id: string | null;
  is_abnormal: boolean;
  note: string | null;
  measured_at: Date;
  created_at: Date;
}) {
  return {
    id: m.id,
    recipient_id: m.recipient_id,
    type: m.type,
    systolic: m.systolic,
    diastolic: m.diastolic,
    heart_rate: m.heart_rate,
    glucose_value: m.glucose_value ? Number(m.glucose_value) : null,
    glucose_timing: m.glucose_timing,
    unit: m.unit,
    source: m.source,
    device_id: m.device_id,
    is_abnormal: m.is_abnormal,
    note: m.note,
    measured_at: m.measured_at.toISOString(),
    created_at: m.created_at.toISOString(),
  };
}
