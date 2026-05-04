'use client';
import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { aiApi, applicationsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const STATUS_BADGE = {
  PENDING: 'bg-gray-100 text-gray-600',
  REVIEWED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  HIRED: 'bg-purple-100 text-purple-700',
};

const SCORE_COLOR = (s) => {
  if (!s) return 'text-gray-400';
  if (s >= 80) return 'text-green-600';
  if (s >= 60) return 'text-yellow-600';
  return 'text-red-500';
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [resume, setResume] = useState(null);
  const [applications, setApplications] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      aiApi.getResume().then(r => setResume(r.data)).catch(() => {}),
      applicationsApi.mine().then(r => setApplications(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const res = await aiApi.uploadResume(formData);
      setResume(res.data.resume);
      toast.success('Resume uploaded and parsed by AI!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  if (!user || user.role !== 'SEEKER') {
    return <div className="max-w-2xl mx-auto px-4 py-12 text-center text-gray-500">This page is for job seekers only.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>

      {/* Resume Upload */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">📄 Your Resume</h2>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div>
              <div className="text-3xl mb-2">⏳</div>
              <p className="text-blue-600 font-medium">Uploading & parsing with AI...</p>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">📁</div>
              <p className="font-medium text-gray-700">
                {resume ? 'Drop new PDF to replace resume' : 'Drop your PDF resume here'}
              </p>
              <p className="text-sm text-gray-400 mt-1">or click to browse · PDF only · Max 5MB</p>
            </div>
          )}
        </div>

        {resume && !uploading && (
          <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium text-green-800">✓ {resume.fileName}</p>
                <p className="text-sm text-green-600">{resume.yearsExperience} years experience · Parsed {new Date(resume.parsedAt).toLocaleDateString()}</p>
              </div>
              <a href={resume.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">View PDF</a>
            </div>
            <div>
              <p className="text-xs font-medium text-green-700 mb-2">Detected Skills:</p>
              <div className="flex flex-wrap gap-1">
                {resume.skills?.map(s => (
                  <span key={s} className="badge bg-white text-green-700 border border-green-200">{s}</span>
                ))}
              </div>
            </div>
            {resume.summary && (
              <p className="text-sm text-gray-600 mt-3 italic">"{resume.summary}"</p>
            )}
          </div>
        )}
      </div>

      {/* Applications */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">🎯 My Applications ({applications.length})</h2>
          <Link href="/jobs" className="text-sm text-blue-600 hover:underline">Browse more jobs →</Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"/>)}
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>No applications yet. <Link href="/jobs" className="text-blue-600 hover:underline">Browse jobs</Link></p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{app.job?.title}</p>
                  <p className="text-sm text-gray-500">{app.job?.employer?.companyName} · Applied {new Date(app.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {app.aiScore !== null ? (
                    <div className="text-right">
                      <p className={`text-lg font-bold ${SCORE_COLOR(app.aiScore)}`}>{app.aiScore}/100</p>
                      <p className="text-xs text-gray-400">AI Score</p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Scoring...</p>
                    </div>
                  )}
                  <span className={`badge ${STATUS_BADGE[app.status]}`}>{app.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
