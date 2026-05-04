'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { jobsApi, applicationsApi, aiApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const SCORE_COLOR = (s) => {
  if (!s) return 'bg-gray-100 text-gray-600';
  if (s >= 80) return 'bg-green-100 text-green-700';
  if (s >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-600';
};

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [job, setJob] = useState(null);
  const [resume, setResume] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi.get(id).then(r => setJob(r.data)).catch(() => router.push('/jobs')).finally(() => setLoading(false));
    if (user?.role === 'SEEKER') {
      aiApi.getResume().then(r => setResume(r.data)).catch(() => {});
    }
  }, [id]);

  const handleApply = async () => {
    if (!user) { router.push('/auth/login'); return; }
    if (!resume) { toast.error('Please upload your resume first'); router.push('/dashboard'); return; }
    setApplying(true);
    try {
      await applicationsApi.apply({ jobId: id, coverLetter });
      setApplied(true);
      toast.success('Application submitted! AI scoring in progress...');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse"><div className="h-8 bg-gray-200 rounded w-2/3 mb-4"/></div>;
  if (!job) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {job.tier !== 'FREE' && (
                    <span className={`badge ${job.tier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {job.tier}
                    </span>
                  )}
                  {job.isRemote && <span className="badge bg-green-100 text-green-700">Remote</span>}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                <p className="text-gray-500 mt-1">{job.employer?.companyName} · {job.location}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-100 text-sm text-gray-600 mb-4">
              <div><span className="font-medium">Type:</span> {job.jobType?.replace('_', ' ')}</div>
              <div><span className="font-medium">Level:</span> {job.experienceLevel}</div>
              {(job.salaryMin || job.salaryMax) && (
                <div><span className="font-medium">Salary:</span> ${job.salaryMin?.toLocaleString()} – ${job.salaryMax?.toLocaleString()}</div>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{job.description}</div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Requirements</h2>
            <ul className="space-y-2">
              {job.requirements?.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills?.map(s => (
                <span key={s} className="badge bg-blue-50 text-blue-700">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            {applied ? (
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-medium text-green-700">Application Submitted!</p>
                <p className="text-sm text-gray-500 mt-1">AI scoring in progress — check back soon.</p>
                <a href="/dashboard" className="btn-secondary w-full mt-3 text-sm">View Applications</a>
              </div>
            ) : user?.role === 'SEEKER' ? (
              <>
                {resume ? (
                  <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-700 font-medium">✓ Resume on file</p>
                    <p className="text-xs text-green-600">{resume.skills?.length} skills · {resume.yearsExperience}y exp</p>
                  </div>
                ) : (
                  <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <p className="text-sm text-yellow-700 font-medium">⚠ No resume uploaded</p>
                    <a href="/dashboard" className="text-xs text-yellow-600 underline">Upload resume first</a>
                  </div>
                )}
                <textarea
                  className="input mb-3 text-sm"
                  rows={4}
                  placeholder="Cover letter (optional)..."
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  maxLength={3000}
                />
                <button
                  onClick={handleApply}
                  disabled={applying || !resume}
                  className="btn-primary w-full"
                >
                  {applying ? 'Submitting...' : 'Apply Now'}
                </button>
              </>
            ) : !user ? (
              <a href="/auth/login" className="btn-primary w-full block text-center">Login to Apply</a>
            ) : null}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-2">About {job.employer?.companyName}</h3>
            <p className="text-sm text-gray-500">{job.employer?.bio || 'No company description available.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
