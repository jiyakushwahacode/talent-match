'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { jobsApi } from '@/lib/api';

const SCORE_COLOR = (s) => s >= 80 ? 'bg-green-100 text-green-700' : s >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600';

function JobCard({ job }) {
  return (
    <Link href={`/jobs/${job.id}`} className="card p-5 hover:shadow-md transition block group">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {job.tier !== 'FREE' && (
              <span className={`badge ${job.tier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {job.tier}
              </span>
            )}
            {job.isRemote && <span className="badge bg-green-100 text-green-700">Remote</span>}
          </div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition">{job.title}</h3>
          <p className="text-sm text-gray-500">{job.employer?.companyName} · {job.location}</p>
        </div>
        {job.aiScore && (
          <span className={`badge ${SCORE_COLOR(job.aiScore)}`}>{job.aiScore}/100</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {job.skills?.slice(0, 4).map(s => (
          <span key={s} className="badge bg-gray-100 text-gray-600">{s}</span>
        ))}
      </div>
      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>{job.jobType?.replace('_', ' ')} · {job.experienceLevel}</span>
        <span>{job._count?.applications || 0} applicants</span>
      </div>
    </Link>
  );
}

function JobsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    location: '',
    jobType: '',
    experienceLevel: '',
    isRemote: '',
    page: 1,
  });

  useEffect(() => {
    setLoading(true);
    jobsApi.list(filters).then(res => {
      setJobs(res.data.jobs);
      setPagination(res.data.pagination);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filters]);

  const updateFilter = (key, value) => setFilters(p => ({ ...p, [key]: value, page: 1 }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Browse Jobs</h1>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            className="input"
            placeholder="Search jobs or skills..."
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
          />
          <input
            className="input"
            placeholder="Location"
            value={filters.location}
            onChange={e => updateFilter('location', e.target.value)}
          />
          <select className="input" value={filters.jobType} onChange={e => updateFilter('jobType', e.target.value)}>
            <option value="">All Types</option>
            {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'].map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <select className="input" value={filters.experienceLevel} onChange={e => updateFilter('experienceLevel', e.target.value)}>
            <option value="">All Levels</option>
            {['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select className="input" value={filters.isRemote} onChange={e => updateFilter('isRemote', e.target.value)}>
            <option value="">Remote or Onsite</option>
            <option value="true">Remote Only</option>
            <option value="false">Onsite Only</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse h-40 bg-gray-100" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg">No jobs found. Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{pagination.total} jobs found</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {[...Array(pagination.pages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFilters(p => ({ ...p, page: i + 1 }))}
                  className={`w-9 h-9 rounded-lg text-sm ${filters.page === i + 1 ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function JobsPage() {
  return <Suspense><JobsContent /></Suspense>;
}
