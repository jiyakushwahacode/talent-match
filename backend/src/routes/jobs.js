// Jobs Routes - /api/jobs
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/jobs - Browse all active jobs (public)
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('search').optional().trim(),
  query('location').optional().trim(),
  query('jobType').optional(),
  query('experienceLevel').optional(),
  query('isRemote').optional().isBoolean(),
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const where = {
      status: 'ACTIVE',
      ...(req.query.search && {
        OR: [
          { title: { contains: req.query.search, mode: 'insensitive' } },
          { description: { contains: req.query.search, mode: 'insensitive' } },
          { skills: { hasSome: [req.query.search] } },
        ],
      }),
      ...(req.query.location && {
        location: { contains: req.query.location, mode: 'insensitive' },
      }),
      ...(req.query.jobType && { jobType: req.query.jobType }),
      ...(req.query.experienceLevel && { experienceLevel: req.query.experienceLevel }),
      ...(req.query.isRemote !== undefined && { isRemote: req.query.isRemote === 'true' }),
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { tier: 'desc' }, // PREMIUM > STANDARD > FREE
          { createdAt: 'desc' },
        ],
        include: {
          employer: {
            select: { id: true, companyName: true, companyLogo: true, location: true },
          },
          _count: { select: { applications: true } },
        },
      }),
      prisma.job.count({ where }),
    ]);

    // Increment view count in background
    if (jobs.length > 0) {
      prisma.job.updateMany({
        where: { id: { in: jobs.map(j => j.id) } },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});
    }

    res.json({
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id - Get single job
router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        employer: {
          select: {
            id: true, companyName: true, companyLogo: true,
            location: true, bio: true,
          },
        },
      },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'ACTIVE') return res.status(404).json({ error: 'Job not available' });

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// POST /api/jobs - Create a job (employer only)
router.post('/', authenticate, authorize('EMPLOYER'), [
  body('title').trim().notEmpty().isLength({ max: 120 }),
  body('description').trim().notEmpty().isLength({ min: 100 }),
  body('requirements').isArray({ min: 1 }),
  body('skills').isArray({ min: 1 }),
  body('location').trim().notEmpty(),
  body('jobType').isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']),
  body('experienceLevel').isIn(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
  body('tier').optional().isIn(['FREE', 'STANDARD', 'PREMIUM']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title, description, requirements, skills, location,
      isRemote, salaryMin, salaryMax, jobType, experienceLevel, tier = 'FREE',
    } = req.body;

    // FREE tier goes live immediately; paid tiers need payment first
    const status = tier === 'FREE' ? 'ACTIVE' : 'DRAFT';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (tier === 'PREMIUM' ? 60 : tier === 'STANDARD' ? 30 : 14));

    const job = await prisma.job.create({
      data: {
        employerId: req.user.id,
        title, description, requirements, skills,
        location, isRemote: isRemote || false,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        jobType, experienceLevel, tier, status,
        expiresAt,
      },
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// PATCH /api/jobs/:id - Update job (owner only)
router.patch('/:id', authenticate, authorize('EMPLOYER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.employerId !== req.user.id) return res.status(403).json({ error: 'Not your job' });

    const allowedFields = ['title', 'description', 'requirements', 'skills',
      'location', 'isRemote', 'salaryMin', 'salaryMax', 'jobType', 'experienceLevel'];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE /api/jobs/:id - Close/delete job
router.delete('/:id', authenticate, authorize('EMPLOYER', 'ADMIN'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const isOwner = job.employerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

    // Soft-delete by closing
    await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED' },
    });

    res.json({ message: 'Job closed successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to close job' });
  }
});

// GET /api/jobs/employer/mine - Get employer's own jobs
router.get('/employer/mine', authenticate, authorize('EMPLOYER'), async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { employerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { applications: true } },
      },
    });
    res.json(jobs);
  } catch (error) {
    console.error('Get employer jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

module.exports = router;
