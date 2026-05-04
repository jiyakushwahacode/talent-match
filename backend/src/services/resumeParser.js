// AI Resume Parser Service
// Uses Claude to extract structured data from PDF resume content
// Design rationale: We use a structured JSON prompt with explicit field definitions
// to ensure consistent parsing across diverse resume formats.

const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Parses a PDF resume buffer using Claude AI.
 * Returns structured data: skills, experience, education, summary, yearsExperience.
 *
 * @param {Buffer} pdfBuffer - Raw PDF file buffer
 * @param {string} fileName - Original file name (for logging)
 * @returns {Object} Parsed resume data
 */
async function parseResume(pdfBuffer, fileName = 'resume.pdf') {
  // Step 1: Extract raw text from PDF
  let pdfText;
  try {
    const pdfData = await pdfParse(pdfBuffer);
    pdfText = pdfData.text;
  } catch (err) {
    console.error('PDF text extraction failed:', err);
    throw new Error('Could not read PDF content');
  }

  if (!pdfText || pdfText.trim().length < 50) {
    throw new Error('PDF appears to be empty or image-only (not parseable)');
  }

  // Truncate to ~12k chars to stay within reasonable token limits
  const truncatedText = pdfText.slice(0, 12000);

  // Step 2: Call Claude to extract structured data
  // PROMPT DESIGN RATIONALE:
  // - We explicitly request JSON output with no markdown fences for easy parsing
  // - We define exact field names and types to avoid schema drift
  // - We ask Claude to calculate yearsExperience as a float for precise scoring
  // - We limit arrays (skills max 20) to prevent token bloat on verbose resumes
  // - The "conservative" instruction for yearsExperience prevents over-inflation
  const systemPrompt = `You are a professional resume parser. Extract structured data from resume text and return ONLY valid JSON with no markdown, no code fences, no commentary.

Return this exact schema:
{
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Jan 2020 - Mar 2023",
      "description": "Brief description of responsibilities"
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science in Computer Science",
      "institution": "University Name",
      "year": "2019"
    }
  ],
  "summary": "2-3 sentence professional summary",
  "yearsExperience": 4.5
}

Rules:
- skills: Extract up to 20 unique technical/professional skills as simple strings
- experience: List in reverse chronological order. Include ALL work experiences.
- education: Include all degrees, certifications, bootcamps
- summary: Write a concise professional summary based on the resume
- yearsExperience: Calculate total years of professional work experience as a decimal. Be conservative (exclude internships < 6 months, education). Return 0 if no experience.
- If a field cannot be determined, use empty array [] or null`;

  const userPrompt = `Parse this resume and return structured JSON:

${truncatedText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawJson = response.content[0].text.trim();

    // Strip any accidental markdown fences
    const cleaned = rawJson.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate and sanitize output
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 20) : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      yearsExperience: typeof parsed.yearsExperience === 'number' ? Math.max(0, parsed.yearsExperience) : 0,
    };
  } catch (err) {
    console.error('Claude resume parsing failed:', err);
    // Fallback: return minimal structure so upload still succeeds
    return {
      skills: [],
      experience: [],
      education: [],
      summary: null,
      yearsExperience: 0,
    };
  }
}

module.exports = { parseResume };
