// Applications Routes - /api/applications
const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { scoreApplication } = require('../services/aiScorer');
const { sendMatchAlert } = require('../services/email');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/applications - Apply to a job (seeker only)
router.post('/', authenticate, authorize('SEEKER'), [
  body('jobId').notEmpty().isUUID(),
  body('coverLetter').optional().trim().isLength({ max: 3000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId, coverLetter } = req.body;

    // Verify job exists and is active
    const job = await prisma.job.findUnique({
      where: { id: jobId, status: 'ACTIVE' },
    });
    if (!job) return res.status(404).json({ error: 'Job not found or no longer active' });

    // Check for duplicate application
    const existing = await prisma.application.findUnique({
      where: { jobId_seekerId: { jobId, seekerId: req.user.id } },
    });
    if (existing) return res.status(409).json({ error: 'You have already applied to this job' });

    // Seeker must have a resume
    const resume = await prisma.resume.findUnique({
      where: { userId: req.user.id },
    });
    if (!resume) {
      return res.status(400).json({ error: 'Please upload your resume before applying' });
    }

    // Create application
    const application = await prisma.application.create({
      data: { jobId, seekerId: req.user.id, coverLetter },
    });

    // Increment job application count
    await prisma.job.update({
      where: { id: jobId },
      data: { applicationCount: { increment: 1 } },
    });

    // Trigger AI scoring asynchronously (don't block response)
    scoreApplication(application.id, job, resume)
      .then(async ({ score, breakdown, summary }) => {
        await prisma.application.update({
          where: { id: application.id },
          data: {
            aiScore: score,
            aiBreakdown: breakdown,
            aiSummary: summary,
            scoredAt: new Date(),
          },
        });

        // Send email alert if score >= 70
        if (score >= 70) {
          const seeker = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, firstName: true },
          });
          sendMatchAlert(seeker.email, seeker.firstName, job.title, score).catch(console.error);
        }
      })
      .catch(err => console.error('AI scoring failed for application', application.id, err));

    res.status(201).json({
      ...application,
      message: 'Application submitted! AI scoring in progress.',
    });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// GET /api/applications/mine - Seeker's own applications
router.get('/mine', authenticate, authorize('SEEKER'), async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { seekerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          select: {
            id: true, title: true, location: true, jobType: true,
            employer: { select: { companyName: true, companyLogo: true } },
          },
        },
      },
    });
    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/applications/job/:jobId - Get all applications for a job (employer only)
router.get('/job/:jobId', authenticate, authorize('EMPLOYER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.employerId !== req.user.id) return res.status(403).json({ error: 'Not your job' });

    const applications = await prisma.application.findMany({
      where: { jobId: req.params.jobId },
      orderBy: { aiScore: 'desc' }, // Ranked by AI score
      include: {
        seeker: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            location: true, bio: true,
            resume: {
              select: {
                fileUrl: true, skills: true,
                yearsExperience: true, summary: true,
              },
            },
          },
        },
      },
    });

    res.json(applications);
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/applications/:id - Get single application
router.get('/:id', authenticate, async (req, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        job: { include: { employer: { select: { companyName: true } } } },
        seeker: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            resume: { select: { fileUrl: true, skills: true } },
          },
        },
      },
    });

    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Only the seeker or the job's employer can view
    const isSeeker = application.seekerId === req.user.id;
    const isEmployer = application.job.employerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isSeeker && !isEmployer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(application);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// PATCH /api/applications/:id/status - Update status (employer only)
router.patch('/:id/status', authenticate, authorize('EMPLOYER', 'ADMIN'), [
  body('status').isIn(['PENDING', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED']),
  body('employerNotes').optional().trim().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { job: true },
    });

    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.job.employerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        ...(req.body.employerNotes !== undefined && { employerNotes: req.body.employerNotes }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

module.exports = router;
