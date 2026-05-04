// Email Service - SendGrid
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = {
  email: process.env.SENDGRID_FROM_EMAIL,
  name: process.env.SENDGRID_FROM_NAME || 'TalentMatch',
};

/**
 * Sends an AI match alert to a job seeker when their score >= 70.
 */
async function sendMatchAlert(toEmail, firstName, jobTitle, score) {
  const msg = {
    to: toEmail,
    from: FROM,
    subject: `🎯 Strong Match: ${jobTitle} — ${score}/100`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You're a strong match!</h2>
        <p>Hi ${firstName},</p>
        <p>Our AI scored your application for <strong>${jobTitle}</strong> at <strong>${score}/100</strong> — that's a strong match!</p>
        <p>Log in to TalentMatch to view your full score breakdown and track your application status.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard/applications"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          View Application
        </a>
        <p style="color:#6b7280;font-size:14px;margin-top:24px;">TalentMatch · AI-Powered Job Matching</p>
      </div>
    `,
  };

  await sgMail.send(msg);
}

/**
 * Sends a welcome email after registration.
 */
async function sendWelcomeEmail(toEmail, firstName, role) {
  const isEmployer = role === 'EMPLOYER';
  const msg = {
    to: toEmail,
    from: FROM,
    subject: `Welcome to TalentMatch${isEmployer ? ' — Start hiring smarter' : ''}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome, ${firstName}!</h2>
        <p>${isEmployer
          ? 'Your employer account is ready. Post your first job and let AI find your best candidates.'
          : 'Your account is ready. Upload your resume and start applying — our AI will match you with the best opportunities.'
        }</p>
        <a href="${process.env.FRONTEND_URL}${isEmployer ? '/employer/post-job' : '/resume/upload'}"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          ${isEmployer ? 'Post a Job' : 'Upload Resume'}
        </a>
      </div>
    `,
  };

  await sgMail.send(msg);
}

module.exports = { sendMatchAlert, sendWelcomeEmail };
