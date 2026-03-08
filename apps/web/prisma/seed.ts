import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const demoHash = await bcrypt.hash('Demo1234!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@remotecare.dev' },
    update: {},
    create: {
      email: 'admin@remotecare.dev',
      password_hash: adminHash,
      name: '系統管理員',
      role: 'admin',
      timezone: 'Asia/Taipei',
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@remotecare.dev' },
    update: {},
    create: {
      email: 'demo@remotecare.dev',
      password_hash: demoHash,
      name: '王小明',
      phone: '0912345678',
      role: 'caregiver',
      timezone: 'Asia/Taipei',
    },
  });

  const existingRecipient = await prisma.recipient.findFirst({
    where: { caregiver_id: demoUser.id, name: '王奶奶', deleted_at: null },
  });

  if (!existingRecipient) {
    await prisma.recipient.create({
      data: {
        caregiver_id: demoUser.id,
        name: '王奶奶',
        date_of_birth: new Date('1945-03-15'),
        gender: 'female',
        medical_tags: ['高血壓', '糖尿病'],
        emergency_contact_name: '王小明',
        emergency_contact_phone: '0912345678',
        notes: '行動不便，需輪椅',
      },
    });
  }

  // --- 李爺爺 recipient ---
  const existingLi = await prisma.recipient.findFirst({
    where: { caregiver_id: demoUser.id, name: '李爺爺', deleted_at: null },
  });

  const liRecipient = existingLi ?? await prisma.recipient.create({
    data: {
      caregiver_id: demoUser.id,
      name: '李爺爺',
      date_of_birth: new Date('1940-06-15'),
      gender: 'male',
      medical_tags: ['高血壓', '糖尿病'],
      emergency_contact_name: '李大明',
      emergency_contact_phone: '0912-345-678',
      notes: '每日需量測血壓血糖',
    },
  });

  // --- 30-day measurement seed data ---
  const wangRecipient = existingRecipient ?? await prisma.recipient.findFirst({
    where: { caregiver_id: demoUser.id, name: '王奶奶', deleted_at: null },
  });

  if (wangRecipient) {
    await seedMeasurements(wangRecipient.id);
  }
  await seedMeasurements(liRecipient.id, true);

  console.log('Seed completed: admin + demo user + recipients + 30-day measurements');
}

/**
 * Generate deterministic 30-day measurement data for a recipient.
 * If includeConsecutiveAbnormal is true, last 3 BP readings will include
 * 2 abnormal values to demonstrate notification trigger.
 */
async function seedMeasurements(recipientId: string, includeConsecutiveAbnormal = false) {
  // Skip if already seeded
  const existingCount = await prisma.measurement.count({
    where: { recipient_id: recipientId },
  });
  if (existingCount > 0) return;

  const now = new Date();
  const measurements: {
    recipient_id: string;
    type: string;
    systolic: number | null;
    diastolic: number | null;
    heart_rate: number | null;
    glucose_value: number | null;
    glucose_timing: string | null;
    unit: string;
    source: string;
    is_abnormal: boolean;
    measured_at: Date;
  }[] = [];

  for (let day = 29; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);

    // Morning BP (08:00 ± 15 min)
    const bpMorning = new Date(date);
    bpMorning.setHours(8, (day * 7) % 15, 0, 0);
    const bpM = generateBp(day, 'morning', includeConsecutiveAbnormal && day <= 2);
    measurements.push({
      recipient_id: recipientId,
      type: 'blood_pressure',
      systolic: bpM.systolic,
      diastolic: bpM.diastolic,
      heart_rate: bpM.heartRate,
      glucose_value: null,
      glucose_timing: null,
      unit: 'mmHg',
      source: 'manual',
      is_abnormal: bpM.isAbnormal,
      measured_at: bpMorning,
    });

    // Evening BP (20:00 ± 15 min)
    const bpEvening = new Date(date);
    bpEvening.setHours(20, (day * 11) % 15, 0, 0);
    const bpE = generateBp(day, 'evening', false);
    measurements.push({
      recipient_id: recipientId,
      type: 'blood_pressure',
      systolic: bpE.systolic,
      diastolic: bpE.diastolic,
      heart_rate: bpE.heartRate,
      glucose_value: null,
      glucose_timing: null,
      unit: 'mmHg',
      source: 'manual',
      is_abnormal: bpE.isAbnormal,
      measured_at: bpEvening,
    });

    // Fasting BG (07:30) — every day
    {
      const bgMorning = new Date(date);
      bgMorning.setHours(7, 30, 0, 0);
      const bg = generateBg(day, 'fasting');
      measurements.push({
        recipient_id: recipientId,
        type: 'blood_glucose',
        systolic: null,
        diastolic: null,
        heart_rate: null,
        glucose_value: bg.value,
        glucose_timing: 'fasting',
        unit: 'mg/dL',
        source: 'manual',
        is_abnormal: bg.isAbnormal,
        measured_at: bgMorning,
      });
    }

    // After-meal BG (every other day, 13:00)
    if (day % 2 === 0) {
      const bgAfter = new Date(date);
      bgAfter.setHours(13, 0, 0, 0);
      const bg = generateBg(day, 'after_meal');
      measurements.push({
        recipient_id: recipientId,
        type: 'blood_glucose',
        systolic: null,
        diastolic: null,
        heart_rate: null,
        glucose_value: bg.value,
        glucose_timing: 'after_meal',
        unit: 'mg/dL',
        source: 'manual',
        is_abnormal: bg.isAbnormal,
        measured_at: bgAfter,
      });
    }
  }

  // Batch insert
  await prisma.measurement.createMany({ data: measurements });
}

function generateBp(dayOffset: number, _period: string, forceAbnormal: boolean) {
  if (forceAbnormal) {
    return { systolic: 148 + (dayOffset % 5), diastolic: 94, heartRate: 82, isAbnormal: true };
  }
  // Scatter some elevated/abnormal readings
  if (dayOffset === 10) {
    return { systolic: 142, diastolic: 91, heartRate: 78, isAbnormal: true };
  }
  if (dayOffset === 15) {
    return { systolic: 136, diastolic: 87, heartRate: 74, isAbnormal: false };
  }
  if (dayOffset === 20) {
    return { systolic: 85, diastolic: 58, heartRate: 68, isAbnormal: true };
  }
  // Normal range with slight variation
  const base = 118 + (dayOffset % 7);
  return {
    systolic: base,
    diastolic: 75 + (dayOffset % 5),
    heartRate: 68 + (dayOffset % 8),
    isAbnormal: false,
  };
}

function generateBg(dayOffset: number, timing: string) {
  if (dayOffset === 8 && timing === 'fasting') {
    return { value: 132, isAbnormal: true };
  }
  if (dayOffset === 18 && timing === 'after_meal') {
    return { value: 188, isAbnormal: true };
  }
  if (timing === 'fasting') {
    return { value: 85 + (dayOffset % 10), isAbnormal: false };
  }
  // after_meal
  return { value: 110 + (dayOffset % 15), isAbnormal: false };
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
