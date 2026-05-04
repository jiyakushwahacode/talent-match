'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { jobsApi, applicationsApi, paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const TIER_BADGE = {
  FREE: 'bg-gray-100 text-gray-600',
  STANDARD: 'bg-blue-100 text-blue-700',
  PREMIUM: 'bg-purple-100 text-purple-700',
};

const STATUS_BADGE = {
  DRAFT: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-gray-100 text-gray-600',
  CLOSED: 'bg-red-100 text-red-600',
};

const SCORE_COLOR = (s) => {
  if (!s) return 'text-gray-400';
  if (s >= 80) return 'text-green-600';
  if (s >= 60) return 'text-yellow-600';
  return 'text-red-500';
};

function CandidateDrawer({ jobId, onClose }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    applicationsApi.forJob(jobId).then(r => setApplications(r.data))
      .catch(() => toast.error('Failed to load applications'))
      .finally(() => setLoading(false));
  }, [jobId]);

  const updateStatus = async (appId, status) => {
    try {
      await applicationsApi.updateStatus(appId, { status });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
      if (selected?.id === appId) setSelected(s => ({ ...s, status }));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Candidates ({applications.length})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"/>)}
          </div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No applications yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {applications.map(app => (
              <div key={app.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(selected?.id === app.id ? null : app)}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{app.seeker?.firstName} {app.seeker?.lastName}</p>
                    <p className="text-sm text-gray-500">{app.seeker?.resume?.skills?.slice(0, 3).join(', ')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{app.seeker?.resume?.yearsExperience}y exp · Applied {new Date(app.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${SCORE_COLOR(app.aiScore)}`}>{app.aiScore ?? '–'}<span className="text-xs font-normal text-gray-400">/100</span></p>
                    <select
                      value={app.status}
                      onChange={e => { e.stopPropagation(); updateStatus(app.id, e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      className="text-xs border border-gray-200 rounded px-1 py-0.5 mt-1"
                    >
                      {['PENDING','REVIEWED','SHORTLISTED','REJECTED','HIRED'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {selected?.id === app.id && app.aiBreakdown && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-blue-800 mb-2">AI Score Breakdown</p>
                    {Object.entries({
                      'Skills Match': app.aiBreakdown.skillsMatch,
                      'Experience': app.aiBreakdown.experienceMatch,
                      'Education': app.aiBreakdown.educationMatch,
                      'Job History': app.aiBreakdown.jobHistoryRelevance,
                      'Potential': app.aiBreakdown.overallPotential,
                    }).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-blue-600 w-24">{k}</span>
                        <div className="flex-1 h-1.5 bg-blue-100 rounded-full">
                          <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${v}%` }}/>
                        </div>
                        <span className="text-xs font-medium text-blue-700 w-6">{v}</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-600 mt-2 italic">{app.aiSummary}</p>
                    {app.aiBreakdown.strengths?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-green-700">Strengths:</p>
                        {app.aiBreakdown.strengths.map((s, i) => <p key={i} className="text-xs text-green-600">✓ {s}</p>)}
                      </div>
                    )}
                    {app.aiBreakdown.gaps?.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs font-medium text-red-600">Gaps:</p>
                        {app.aiBreakdown.gaps.map((g, i) => <p key={i} className="text-xs text-red-500">✗ {g}</p>)}
                      </div>
                    )}
                    {app.seeker?.email && (
                      <a href={`mailto:${app.seeker.email}`} className="inline-block mt-2 text-xs text-blue-600 hover:underline">
                        Contact: {app.seeker.email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmployerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    if (searchParams.get('payment') === 'success') toast.success('Payment successful! Your job is now live.');
    jobsApi.myJobs().then(r => setJobs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleClose = async (jobId) => {
    if (!confirm('Close this job listing?')) return;
    try {
      await jobsApi.close(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'CLOSED' } : j));
      toast.success('Job closed');
    } catch { toast.error('Failed to close job'); }
  };

  if (!user || user.role !== 'EMPLOYER') {
    return <div className="text-center py-12 text-gray-500">Employer access required.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employer Dashboard</h1>
          <p className="text-gray-500">{user.companyName}</p>
        </div>
        <Link href="/employer/post-job" className="btn-primary">+ Post a Job</Link>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Job Listings ({jobs.length})</h2>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>No jobs posted yet. <Link href="/employer/post-job" className="text-blue-600">Post your first job</Link></p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${TIER_BADGE[job.tier]}`}>{job.tier}</span>
                    <span className={`badge ${STATUS_BADGE[job.status]}`}>{job.status}</span>
                  </div>
                  <p className="font-medium text-gray-900 truncate">{job.title}</p>
                  <p className="text-sm text-gray-400">{job._count?.applications || 0} applicants · Posted {new Date(job.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {job.status === 'ACTIVE' && (
                    <button
                      onClick={() => setSelectedJobId(job.id)}
                      className="btn-secondary text-sm"
                    >
                      View Candidates
                    </button>
                  )}
                  {job.status === 'DRAFT' && (
                    <Link href={`/pricing?jobId=${job.id}&tier=STANDARD`} className="btn-primary text-sm">
                      Activate
                    </Link>
                  )}
                  {job.status === 'ACTIVE' && (
                    <button onClick={() => handleClose(job.id)} className="text-sm text-red-500 hover:text-red-700 px-2">
                      Close
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedJobId && (
        <CandidateDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  );
}

export default function EmployerDashboard() {
  return <Suspense><EmployerDashboardContent /></Suspense>;
}
