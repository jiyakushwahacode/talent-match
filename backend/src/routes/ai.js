// AI Routes - /api/ai (Resume upload + parsing)
const express = require('express');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { parseResume } = require('../services/resumeParser');
const { rescoreAllApplications } = require('../services/aiScorer');

const router = express.Router();
const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage (PDF only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// POST /api/ai/resume/upload - Upload and parse resume
router.post('/resume/upload', authenticate, authorize('SEEKER'), upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Upload to Cloudinary as raw file
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'talentmatch/resumes',
          public_id: `resume_${req.user.id}_${Date.now()}`,
          format: 'pdf',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Delete old resume from Cloudinary if exists
    const existingResume = await prisma.resume.findUnique({ where: { userId: req.user.id } });
    if (existingResume?.cloudinaryId) {
      cloudinary.uploader.destroy(existingResume.cloudinaryId, { resource_type: 'raw' }).catch(() => {});
    }

    // Parse resume with Claude AI
    const parsed = await parseResume(req.file.buffer, req.file.originalname);

    // Upsert resume record
    const resume = await prisma.resume.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        cloudinaryId: uploadResult.public_id,
        fileUrl: uploadResult.secure_url,
        fileName: req.file.originalname,
        skills: parsed.skills,
        experience: parsed.experience,
        education: parsed.education,
        summary: parsed.summary,
        yearsExperience: parsed.yearsExperience,
        parsedAt: new Date(),
      },
      update: {
        cloudinaryId: uploadResult.public_id,
        fileUrl: uploadResult.secure_url,
        fileName: req.file.originalname,
        skills: parsed.skills,
        experience: parsed.experience,
        education: parsed.education,
        summary: parsed.summary,
        yearsExperience: parsed.yearsExperience,
        parsedAt: new Date(),
      },
    });

    // Re-score any existing pending applications in background
    rescoreAllApplications(req.user.id).catch(console.error);

    res.json({
      resume,
      parsed,
      message: 'Resume uploaded and parsed successfully',
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    if (error.message === 'Only PDF files are allowed') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to upload and parse resume' });
  }
});

// GET /api/ai/resume - Get current user's parsed resume data
router.get('/resume', authenticate, authorize('SEEKER'), async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({ where: { userId: req.user.id } });
    if (!resume) return res.status(404).json({ error: 'No resume found' });
    res.json(resume);
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// POST /api/ai/score/:applicationId - Manually trigger re-scoring
router.post('/score/:applicationId', authenticate, authorize('EMPLOYER', 'ADMIN'), async (req, res) => {
  try {
    const { scoreApplication } = require('../services/aiScorer');

    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: {
        job: true,
        seeker: { include: { resume: true } },
      },
    });

    if (!application) return res.status(404).json({ error: 'Application not found' });

    if (!application.seeker.resume) {
      return res.status(400).json({ error: 'Applicant has no resume' });
    }

    const { score, breakdown, summary } = await scoreApplication(
      application.id,
      application.job,
      application.seeker.resume
    );

    const updated = await prisma.application.update({
      where: { id: req.params.applicationId },
      data: { aiScore: score, aiBreakdown: breakdown, aiSummary: summary, scoredAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    console.error('Manual score error:', error);
    res.status(500).json({ error: 'Failed to score application' });
  }
});

module.exports = router;
