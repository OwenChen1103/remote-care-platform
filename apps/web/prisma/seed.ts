import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const demoHash = await bcrypt.hash('Demo1234!', 12);
  const patientHash = await bcrypt.hash('Patient1234!', 12);
  const providerHash = await bcrypt.hash('Provider1234!', 12);

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

  const patientUser = await prisma.user.upsert({
    where: { email: 'patient.demo@remotecare.dev' },
    update: {},
    create: {
      email: 'patient.demo@remotecare.dev',
      password_hash: patientHash,
      name: '王奶奶（帳號）',
      role: 'patient',
      timezone: 'Asia/Taipei',
    },
  });

  const providerUser = await prisma.user.upsert({
    where: { email: 'provider.demo@remotecare.dev' },
    update: {},
    create: {
      email: 'provider.demo@remotecare.dev',
      password_hash: providerHash,
      name: '陳照護員',
      role: 'provider',
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
        patient_user_id: patientUser.id,
        name: '王奶奶',
        date_of_birth: new Date('1945-03-15'),
        gender: 'female',
        medical_tags: ['高血壓', '糖尿病'],
        emergency_contact_name: '王小明',
        emergency_contact_phone: '0912345678',
        notes: '行動不便，需輪椅',
      },
    });
  } else if (!existingRecipient.patient_user_id) {
    await prisma.recipient.update({
      where: { id: existingRecipient.id },
      data: { patient_user_id: patientUser.id },
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
    await seedReminders(wangRecipient.id);
  }
  await seedMeasurements(liRecipient.id, true);
  await seedReminders(liRecipient.id);

  const serviceCategories = await seedServiceCategories();
  const [approvedProvider] = await seedProviders(providerUser.id);
  if (wangRecipient) {
    await seedServiceRequests(demoUser.id, wangRecipient.id, serviceCategories, approvedProvider.id);
    await seedNotifications(demoUser.id, wangRecipient.id, '王奶奶');
    await seedPatientNotifications(patientUser.id, wangRecipient.id, '王奶奶');
    await seedProviderNotifications(providerUser.id, wangRecipient.id, '王奶奶');
    await seedAppointments(wangRecipient.id);
    await seedAiReport(wangRecipient.id);
  }

  console.log('Seed completed: roles + recipients + measurements + reminders + service categories + providers + requests + notifications + appointments + ai-report');
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

async function seedReminders(recipientId: string) {
  const existing = await prisma.measurementReminder.findFirst({
    where: { recipient_id: recipientId },
  });
  if (existing) return;

  await prisma.measurementReminder.createMany({
    data: [
      {
        recipient_id: recipientId,
        reminder_type: 'morning',
        reminder_time: new Date('1970-01-01T08:00:00Z'),
        is_enabled: true,
      },
      {
        recipient_id: recipientId,
        reminder_type: 'evening',
        reminder_time: new Date('1970-01-01T20:00:00Z'),
        is_enabled: true,
      },
    ],
  });
}

async function seedNotifications(userId: string, recipientId: string, recipientName: string) {
  const existing = await prisma.notification.count({
    where: { user_id: userId },
  });
  if (existing > 0) return;

  const now = new Date();

  await prisma.notification.createMany({
    data: [
      {
        user_id: userId,
        type: 'measurement_reminder',
        title: `${recipientName} 量測提醒`,
        body: `該為 ${recipientName} 進行早上量測了。`,
        data: { recipient_id: recipientId, reminder_type: 'morning' },
        is_read: true,
        created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        user_id: userId,
        type: 'measurement_reminder',
        title: `${recipientName} 量測提醒`,
        body: `該為 ${recipientName} 進行晚上量測了。`,
        data: { recipient_id: recipientId, reminder_type: 'evening' },
        is_read: true,
        created_at: new Date(now.getTime() - 15 * 60 * 60 * 1000),
      },
      {
        user_id: userId,
        type: 'abnormal_alert',
        title: `${recipientName} 血壓連續異常`,
        body: `${recipientName} 近期血壓有多次異常紀錄，建議關注或安排就醫。`,
        data: { recipient_id: recipientId, measurement_type: 'blood_pressure' },
        is_read: false,
        created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      },
      {
        user_id: userId,
        type: 'measurement_reminder',
        title: `${recipientName} 量測提醒`,
        body: `該為 ${recipientName} 進行早上量測了。`,
        data: { recipient_id: recipientId, reminder_type: 'morning' },
        is_read: false,
        created_at: new Date(now.getTime() - 10 * 60 * 1000),
      },
      {
        user_id: userId,
        type: 'abnormal_alert',
        title: `${recipientName} 血糖連續異常`,
        body: `${recipientName} 近期血糖有多次異常紀錄，建議關注或安排就醫。`,
        data: { recipient_id: recipientId, measurement_type: 'blood_glucose' },
        is_read: false,
        created_at: new Date(now.getTime() - 5 * 60 * 1000),
      },
    ],
  });
}

async function seedPatientNotifications(userId: string, recipientId: string, recipientName: string) {
  const existing = await prisma.notification.count({ where: { user_id: userId } });
  if (existing > 0) return;

  const now = new Date();
  await prisma.notification.createMany({
    data: [
      {
        user_id: userId,
        type: 'appointment_reminder',
        title: `${recipientName} 近期行程提醒`,
        body: '您在三天內有門診安排，請留意時間。',
        data: { recipient_id: recipientId },
        is_read: false,
        created_at: new Date(now.getTime() - 30 * 60 * 1000),
      },
      {
        user_id: userId,
        type: 'service_request_update',
        title: `${recipientName} 服務進度更新`,
        body: '平台已為您安排服務人員，請查看詳情。',
        data: { recipient_id: recipientId },
        is_read: false,
        created_at: new Date(now.getTime() - 10 * 60 * 1000),
      },
    ],
  });
}

async function seedProviderNotifications(userId: string, recipientId: string, recipientName: string) {
  const existing = await prisma.notification.count({ where: { user_id: userId } });
  if (existing > 0) return;

  await prisma.notification.create({
    data: {
      user_id: userId,
      type: 'service_request_update',
      title: '新案件指派通知',
      body: `您有新的 ${recipientName} 服務案件待確認。`,
      data: { recipient_id: recipientId },
      is_read: false,
    },
  });
}

type SeedServiceCategory = { id: string; code: string; name: string };

function requireServiceCategory(categories: SeedServiceCategory[], code: string): SeedServiceCategory {
  const category = categories.find((item) => item.code === code);
  if (!category) {
    throw new Error(`Missing service category: ${code}`);
  }
  return category;
}

async function seedServiceCategories(): Promise<SeedServiceCategory[]> {
  const categories = [
    { code: 'escort_visit', name: '陪診師', description: '陪同就醫與流程協助', sort_order: 1 },
    { code: 'pre_visit_consult', name: '診前諮詢', description: '就醫前需求評估與準備建議', sort_order: 2 },
    { code: 'shopping_assist', name: '購物服務', description: '代購或陪同採買協助', sort_order: 3 },
    { code: 'exercise_program', name: '運動項目', description: '居家運動陪伴與安排', sort_order: 4 },
    { code: 'home_cleaning', name: '打掃清潔', description: '居家清潔服務需求', sort_order: 5 },
    { code: 'daily_living_support', name: '生活輔助', description: '日常生活協助服務', sort_order: 6 },
    { code: 'nutrition_consult', name: '營養表諮詢', description: '營養建議與飲食諮詢', sort_order: 7 },
    { code: 'functional_assessment', name: '身體功能檢測', description: '身體功能評估需求', sort_order: 8 },
  ];

  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        description: category.description,
        sort_order: category.sort_order,
        is_active: true,
      },
      create: category,
    });
  }

  return prisma.serviceCategory.findMany({
    where: { code: { in: categories.map((c) => c.code) } },
    orderBy: { sort_order: 'asc' },
    select: { id: true, code: true, name: true },
  });
}

async function seedProviders(providerUserId: string) {
  const providerA = await prisma.provider.upsert({
    where: { user_id: providerUserId },
    update: {},
    create: {
      user_id: providerUserId,
      name: '陳照護員',
      phone: '0922333444',
      email: 'provider.demo@remotecare.dev',
      level: 'L2',
      specialties: ['陪診', '生活輔助'],
      certifications: ['照顧服務員證照'],
      experience_years: 5,
      service_areas: ['台北市大安區', '台北市信義區'],
      availability_status: 'available',
      review_status: 'approved',
      admin_note: '示範帳號',
    },
  });

  const existingProviderB = await prisma.provider.findFirst({
    where: { email: 'pending.provider@remotecare.dev' },
  });

  const providerB = existingProviderB
    ? await prisma.provider.update({
        where: { id: existingProviderB.id },
        data: {
          name: '林候選服務員',
          phone: '0933555666',
          level: 'L1',
          specialties: ['居家清潔'],
          certifications: ['基礎照護訓練'],
          experience_years: 2,
          service_areas: ['台北市中山區'],
          availability_status: 'busy',
          review_status: 'pending',
        },
      })
    : await prisma.provider.create({
        data: {
          name: '林候選服務員',
          phone: '0933555666',
          email: 'pending.provider@remotecare.dev',
          level: 'L1',
          specialties: ['居家清潔'],
          certifications: ['基礎照護訓練'],
          experience_years: 2,
          service_areas: ['台北市中山區'],
          availability_status: 'busy',
          review_status: 'pending',
        },
      });

  return [providerA, providerB] as const;
}

async function seedServiceRequests(
  caregiverId: string,
  recipientId: string,
  categories: SeedServiceCategory[],
  providerId: string,
) {
  const existing = await prisma.serviceRequest.count({ where: { caregiver_id: caregiverId, recipient_id: recipientId } });
  if (existing > 0) return;

  const escortCategory = requireServiceCategory(categories, 'escort_visit');
  const consultCategory = requireServiceCategory(categories, 'pre_visit_consult');
  const nutritionCategory = requireServiceCategory(categories, 'nutrition_consult');

  const now = new Date();
  const in3Days = new Date(now);
  in3Days.setDate(in3Days.getDate() + 3);

  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);

  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  await prisma.serviceRequest.createMany({
    data: [
      {
        caregiver_id: caregiverId,
        recipient_id: recipientId,
        category_id: escortCategory.id,
        status: 'submitted',
        preferred_date: in3Days,
        preferred_time_slot: 'morning',
        location: '台北市大安區復興南路一段 100 號',
        description: '需陪同回診，長輩行動不便。',
      },
      {
        caregiver_id: caregiverId,
        recipient_id: recipientId,
        category_id: consultCategory.id,
        status: 'candidate_proposed',
        preferred_date: in7Days,
        preferred_time_slot: 'afternoon',
        location: '台北市信義區松高路 1 號',
        description: '診前諮詢需求，希望先確認注意事項。',
        candidate_provider_id: providerId,
        admin_note: '已提出候選服務人員。',
      },
      {
        caregiver_id: caregiverId,
        recipient_id: recipientId,
        category_id: nutritionCategory.id,
        status: 'arranged',
        preferred_date: in14Days,
        preferred_time_slot: 'evening',
        location: '台北市中山區民權東路二段 50 號',
        description: '營養諮詢與飲食調整建議。',
        candidate_provider_id: providerId,
        assigned_provider_id: providerId,
        caregiver_confirmed_at: now,
        provider_confirmed_at: now,
        admin_note: '雙方已確認，安排完成。',
      },
    ],
  });
}

async function seedAppointments(recipientId: string) {
  const existing = await prisma.appointment.count({
    where: { recipient_id: recipientId },
  });
  if (existing > 0) return;

  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  in7Days.setHours(10, 0, 0, 0);

  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);
  in14Days.setHours(14, 30, 0, 0);

  await prisma.appointment.createMany({
    data: [
      {
        recipient_id: recipientId,
        title: '心臟內科回診',
        hospital_name: '台大醫院',
        department: '心臟內科',
        doctor_name: '林醫師',
        appointment_date: in7Days,
        note: '攜帶血壓紀錄本及藥袋',
      },
      {
        recipient_id: recipientId,
        title: '新陳代謝科回診',
        hospital_name: '國泰醫院',
        department: '新陳代謝科',
        doctor_name: '陳醫師',
        appointment_date: in14Days,
        note: '需空腹抽血，前一晚 10 點後禁食',
      },
    ],
  });
}

async function seedAiReport(recipientId: string) {
  const existing = await prisma.aiReport.count({
    where: { recipient_id: recipientId },
  });
  if (existing > 0) return;

  await prisma.aiReport.create({
    data: {
      recipient_id: recipientId,
      report_type: 'weekly',
      status_label: '需留意',
      summary: '過去一週血壓偏高趨勢明顯，收縮壓多次超過 140 mmHg，血糖控制尚可但空腹血糖略有上升趨勢。建議密切關注血壓變化並諮詢醫師是否需調整用藥。',
      reasons: JSON.stringify([
        '近 7 日收縮壓平均 135 mmHg，有 3 次超過 140 mmHg',
        '舒張壓平均 82 mmHg，屬正常偏高範圍',
        '空腹血糖平均 95 mg/dL，較前週上升 5 mg/dL',
      ]),
      suggestions: JSON.stringify([
        '建議每日固定時間量測血壓，早晚各一次',
        '下次回診時攜帶血壓紀錄供醫師參考',
        '注意飲食中鈉的攝取，減少加工食品',
        '維持適度運動，如每日步行 30 分鐘',
      ]),
      model: 'seed-data',
      input_tokens: 0,
      output_tokens: 0,
    },
  });
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
