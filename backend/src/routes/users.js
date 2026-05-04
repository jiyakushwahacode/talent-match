// User Routes - /api/users
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/users/:id/public - Public employer profile
router.get('/:id/public', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id, role: 'EMPLOYER', isActive: true },
      select: {
        id: true, companyName: true, companyLogo: true,
        bio: true, location: true, createdAt: true,
        postedJobs: {
          where: { status: 'ACTIVE' },
          select: { id: true, title: true, jobType: true, location: true, createdAt: true },
          take: 10,
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'Employer not found' });
    res.json(user);
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
