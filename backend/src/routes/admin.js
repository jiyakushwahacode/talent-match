// Admin Routes - /api/admin
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

// GET /api/admin/stats - Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers, totalJobs, totalApplications, totalRevenue,
      seekers, employers, activeJobs, recentPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.user.count({ where: { role: 'SEEKER' } }),
      prisma.user.count({ where: { role: 'EMPLOYER' } }),
      prisma.job.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true, companyName: true } } },
      }),
    ]);

    res.json({
      users: { total: totalUsers, seekers, employers },
      jobs: { total: totalJobs, active: activeJobs },
      applications: { total: totalApplications },
      revenue: { total: (totalRevenue._sum.amount || 0) / 100 },
      recentPayments,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true,
          firstName: true, lastName: true, companyName: true,
          isActive: true, createdAt: true,
          _count: { select: { applications: true, postedJobs: true } },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id/toggle - Activate/deactivate user
router.patch('/users/:id/toggle', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true, email: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Admin toggle user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/jobs - List all jobs
router.get('/jobs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employer: { select: { companyName: true, email: true } },
          _count: { select: { applications: true } },
        },
      }),
      prisma.job.count(),
    ]);

    res.json({ jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Admin get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// PATCH /api/admin/jobs/:id/status - Change job status
router.patch('/jobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, title: true, status: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Admin update job status error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// GET /api/admin/payments - List all payments
router.get('/payments', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { email: true, companyName: true } },
        jobs: { select: { id: true, title: true } },
      },
    });
    res.json(payments);
  } catch (error) {
    console.error('Admin get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;
