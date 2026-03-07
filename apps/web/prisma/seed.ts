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

  await prisma.user.upsert({
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

  console.log('Seed completed: admin@remotecare.dev + demo@remotecare.dev');
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
