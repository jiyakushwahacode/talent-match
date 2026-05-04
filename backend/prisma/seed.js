// Prisma Seed - Creates admin user + sample data
// Run: node prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@talentmatch.io' },
    update: {},
    create: {
      email: 'admin@talentmatch.io',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('Admin created:', admin.email);

  // Create sample employer
  const employerHash = await bcrypt.hash('Employer@123', 12);
  const employer = await prisma.user.upsert({
    where: { email: 'employer@acmecorp.com' },
    update: {},
    create: {
      email: 'employer@acmecorp.com',
      passwordHash: employerHash,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'EMPLOYER',
      companyName: 'Acme Corp',
      bio: 'We build amazing products for the modern web.',
      location: 'San Francisco, CA',
      isVerified: true,
    },
  });
  console.log('Employer created:', employer.email);

  // Create sample seeker
  const seekerHash = await bcrypt.hash('Seeker@123', 12);
  const seeker = await prisma.user.upsert({
    where: { email: 'seeker@example.com' },
    update: {},
    create: {
      email: 'seeker@example.com',
      passwordHash: seekerHash,
      firstName: 'John',
      lastName: 'Doe',
      role: 'SEEKER',
      location: 'New York, NY',
      isVerified: true,
    },
  });
  console.log('Seeker created:', seeker.email);

  // Create sample jobs
  const jobs = [
    {
      title: 'Senior React Developer',
      description: 'We are looking for a Senior React Developer to join our growing team. You will be responsible for building high-quality web applications that serve millions of users. You will work closely with our design and backend teams to deliver exceptional user experiences. The role involves architecting and building new frontend features, conducting code reviews, mentoring junior developers, and contributing to our component library.',
      requirements: [
        '5+ years of React experience',
        'Strong TypeScript skills',
        'Experience with Next.js',
        'Familiarity with REST APIs and GraphQL',
        'Experience with testing frameworks (Jest, React Testing Library)',
      ],
      skills: ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Jest'],
      location: 'San Francisco, CA',
      isRemote: true,
      jobType: 'FULL_TIME',
      experienceLevel: 'SENIOR',
      salaryMin: 140000,
      salaryMax: 180000,
      tier: 'PREMIUM',
      status: 'ACTIVE',
    },
    {
      title: 'Backend Node.js Engineer',
      description: 'Join our backend team to build scalable APIs and microservices. You will design and implement RESTful APIs, work with PostgreSQL and Redis, and help us scale our infrastructure to handle growing traffic. We use a modern tech stack including Node.js, Express, Prisma, and deploy on AWS. You will collaborate with frontend engineers and participate in architecture decisions.',
      requirements: [
        '3+ years of Node.js experience',
        'Strong SQL and database design skills',
        'Experience with microservices architecture',
        'Knowledge of Docker and CI/CD',
      ],
      skills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS', 'Redis'],
      location: 'New York, NY',
      isRemote: false,
      jobType: 'FULL_TIME',
      experienceLevel: 'MID',
      salaryMin: 100000,
      salaryMax: 130000,
      tier: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      title: 'Junior Frontend Developer',
      description: 'Great opportunity for a junior developer to grow their skills in a supportive environment. You will work on our consumer-facing web app, fix bugs, implement new features, and learn from senior engineers. We have a strong culture of mentorship and code review. You will get exposure to modern React, TypeScript, and UI/UX best practices.',
      requirements: [
        '1+ years of React or Vue experience',
        'Basic understanding of HTML, CSS, JavaScript',
        'Eagerness to learn and grow',
        'Degree in CS or equivalent experience',
      ],
      skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Git'],
      location: 'Austin, TX',
      isRemote: true,
      jobType: 'FULL_TIME',
      experienceLevel: 'ENTRY',
      salaryMin: 65000,
      salaryMax: 85000,
      tier: 'FREE',
      status: 'ACTIVE',
    },
  ];

  for (const jobData of jobs) {
    const existing = await prisma.job.findFirst({
      where: { title: jobData.title, employerId: employer.id },
    });
    if (!existing) {
      await prisma.job.create({
        data: { ...jobData, employerId: employer.id },
      });
      console.log('Job created:', jobData.title);
    }
  }

  console.log('\n✅ Seed complete!');
  console.log('\nTest accounts:');
  console.log('  Admin:    admin@talentmatch.io / Admin@123456');
  console.log('  Employer: employer@acmecorp.com / Employer@123');
  console.log('  Seeker:   seeker@example.com / Seeker@123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
