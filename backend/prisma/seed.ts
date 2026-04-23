import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eduvideo.dev' },
    update: {},
    create: {
      email: 'admin@eduvideo.dev',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create demo educator user
  const userPassword = await bcrypt.hash('Demo123!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@eduvideo.dev' },
    update: {},
    create: {
      email: 'demo@eduvideo.dev',
      name: 'Demo Educator',
      password: userPassword,
      role: 'USER',
    },
  });

  // Create demo project
  const project = await prisma.project.upsert({
    where: { id: 'demo-project-001' },
    update: {},
    create: {
      id: 'demo-project-001',
      title: 'Introduction to Photosynthesis',
      description: 'A beginner-friendly lesson on how plants convert sunlight to energy.',
      mode: 'NO_FACE',
      status: 'DRAFT',
      userId: demoUser.id,
    },
  });

  // Add script to demo project
  await prisma.script.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      content: `Welcome to our lesson on photosynthesis. Today we will explore how plants use sunlight to create their own food.

Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy. This energy is stored in glucose molecules.

The overall equation for photosynthesis is: six molecules of carbon dioxide plus six molecules of water, in the presence of light, produce one molecule of glucose and six molecules of oxygen.

Inside plant cells, there are organelles called chloroplasts. These are the sites where photosynthesis occurs. They contain a green pigment called chlorophyll, which captures light energy.

Photosynthesis occurs in two main stages: the light-dependent reactions and the light-independent reactions, also known as the Calvin cycle.

Thank you for watching this introduction to photosynthesis. In our next lesson, we will dive deeper into the light-dependent reactions.`,
    },
  });

  console.log('Seed complete!');
  console.log('Demo accounts:');
  console.log('  Admin: admin@eduvideo.dev / Admin123!');
  console.log('  User:  demo@eduvideo.dev / Demo123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
