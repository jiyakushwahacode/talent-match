// AI Application Scorer Service
// Uses Claude to score job applications 0-100 with detailed breakdown
// Design rationale: Multi-dimensional scoring gives employers actionable insight
// beyond a single number, while the structured prompt ensures consistent JSON output.

const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const prisma = new PrismaClient();

/**
 * Scores a single application using Claude AI.
 *
 * @param {string} applicationId - Application ID (for logging)
 * @param {Object} job - Job object with title, description, requirements, skills, experienceLevel
 * @param {Object} resume - Resume object with skills, experience, education, yearsExperience, summary
 * @returns {{ score: number, breakdown: Object, summary: string }}
 */
async function scoreApplication(applicationId, job, resume) {
  // Build a compact representation of the job requirements
  const jobContext = `
Job Title: ${job.title}
Experience Level: ${job.experienceLevel}
Job Type: ${job.jobType}
Required Skills: ${job.skills.join(', ')}
Requirements:
${job.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}
Job Description:
${job.description.slice(0, 2000)}
`.trim();

  // Build a compact representation of the candidate
  const candidateContext = `
Skills: ${resume.skills.join(', ')}
Years of Experience: ${resume.yearsExperience}
Professional Summary: ${resume.summary || 'Not provided'}
Work Experience:
${Array.isArray(resume.experience)
  ? resume.experience.slice(0, 5).map(e =>
      `- ${e.title} at ${e.company} (${e.duration}): ${e.description || ''}`
    ).join('\n')
  : 'Not provided'}
Education:
${Array.isArray(resume.education)
  ? resume.education.map(e => `- ${e.degree} from ${e.institution} (${e.year})`).join('\n')
  : 'Not provided'}
`.trim();

  // PROMPT DESIGN RATIONALE:
  // - We use 5 weighted scoring dimensions that map to what real recruiters care about
  // - Skills match is weighted highest (35%) as it's the most objective signal
  // - Experience level alignment (25%) catches overqualified/underqualified cases
  // - We request a score for each dimension separately so employers understand WHY
  // - The "Be fair but critical" instruction prevents grade inflation
  // - JSON-only response with exact schema prevents parsing failures
  // - Fallback scores are set if Claude fails, ensuring UX never breaks
  const systemPrompt = `You are an expert technical recruiter scoring job applications. 
Analyze how well a candidate matches a job and return ONLY valid JSON with no markdown fences.

Score each dimension from 0-100:
- skillsMatch (35% weight): How well do candidate's skills match required skills?
- experienceMatch (25% weight): Does their experience level and years match the job level?
- educationMatch (15% weight): Does their educational background fit?
- jobHistoryRelevance (15% weight): Is their work history relevant to this role?
- overallPotential (10% weight): General career trajectory and growth indicators?

Return this exact schema:
{
  "skillsMatch": 85,
  "experienceMatch": 70,
  "educationMatch": 90,
  "jobHistoryRelevance": 75,
  "overallPotential": 80,
  "overallScore": 81,
  "summary": "2-3 sentence assessment explaining the score and key strengths/gaps",
  "strengths": ["strength1", "strength2", "strength3"],
  "gaps": ["gap1", "gap2"]
}

Rules:
- overallScore = weighted average: (skillsMatch*0.35 + experienceMatch*0.25 + educationMatch*0.15 + jobHistoryRelevance*0.15 + overallPotential*0.10)
- Round overallScore to nearest integer
- Be fair but critical — reserve 90+ for exceptional matches
- strengths: 2-4 specific positive observations
- gaps: 1-3 specific missing qualifications (empty array if no gaps)
- summary: Start with the score context (e.g. "Strong match — ..." or "Moderate match — ...")`;

  const userPrompt = `Score this candidate for the job.

=== JOB ===
${jobContext}

=== CANDIDATE ===
${candidateContext}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawJson = response.content[0].text.trim();
    const cleaned = rawJson.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(cleaned);

    // Validate score range
    const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));

    const breakdown = {
      skillsMatch: clamp(result.skillsMatch),
      experienceMatch: clamp(result.experienceMatch),
      educationMatch: clamp(result.educationMatch),
      jobHistoryRelevance: clamp(result.jobHistoryRelevance),
      overallPotential: clamp(result.overallPotential),
      strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 4) : [],
      gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 3) : [],
    };

    const score = clamp(result.overallScore);
    const summary = typeof result.summary === 'string' ? result.summary : 'AI scoring completed.';

    return { score, breakdown, summary };
  } catch (err) {
    console.error(`AI scoring failed for application ${applicationId}:`, err);
    // Fallback: return neutral scores so the application still appears
    return {
      score: 50,
      breakdown: {
        skillsMatch: 50, experienceMatch: 50, educationMatch: 50,
        jobHistoryRelevance: 50, overallPotential: 50,
        strengths: [], gaps: ['AI scoring temporarily unavailable'],
      },
      summary: 'Automated scoring is temporarily unavailable. Please review manually.',
    };
  }
}

/**
 * Re-score all pending applications for a seeker after they upload a new resume.
 * Runs in background — errors are logged but not thrown.
 *
 * @param {string} seekerId
 */
async function rescoreAllApplications(seekerId) {
  try {
    const applications = await prisma.application.findMany({
      where: { seekerId, status: 'PENDING' },
      include: { job: true },
    });

    const resume = await prisma.resume.findUnique({ where: { userId: seekerId } });
    if (!resume) return;

    for (const app of applications) {
      try {
        const { score, breakdown, summary } = await scoreApplication(app.id, app.job, resume);
        await prisma.application.update({
          where: { id: app.id },
          data: { aiScore: score, aiBreakdown: breakdown, aiSummary: summary, scoredAt: new Date() },
        });
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Re-score failed for application ${app.id}:`, err);
      }
    }
  } catch (err) {
    console.error('rescoreAllApplications failed:', err);
  }
}

module.exports = { scoreApplication, rescoreAllApplications };
