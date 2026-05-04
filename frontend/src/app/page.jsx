'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { jobsApi } from '@/lib/api';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ jobs: 0, companies: 0, hires: 0 });

  useEffect(() => {
    jobsApi.list({ limit: 1 }).then(res => {
      setStats(prev => ({ ...prev, jobs: res.data.pagination?.total || 0 }));
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium">AI-powered matching — find your perfect fit</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Find Your Dream Job<br />
            <span className="text-blue-300">with AI Precision</span>
          </h1>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            TalentMatch uses Claude AI to score every application 0-100, giving employers ranked candidates and job seekers transparent match scores.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-8">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && window.location.assign(`/jobs?search=${search}`)}
              placeholder="Job title, skill, or keyword..."
              className="flex-1 px-4 py-3 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <Link
              href={`/jobs?search=${search}`}
              className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition whitespace-nowrap"
            >
              Search Jobs
            </Link>
          </div>
          <div className="flex justify-center gap-8 text-sm text-blue-200">
            <span><strong className="text-white">{stats.jobs}+</strong> Active Jobs</span>
            <span><strong className="text-white">500+</strong> Companies</span>
            <span><strong className="text-white">10k+</strong> Hires Made</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How TalentMatch Works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Claude AI reads every resume and job description to create fair, objective match scores.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '📄', title: 'Upload Your Resume', desc: 'Our AI parses your PDF and extracts skills, experience, and education automatically.' },
              { icon: '🔍', title: 'Browse & Apply', desc: 'Find jobs that match your skills. See your AI compatibility score before you apply.' },
              { icon: '🎯', title: 'Get Ranked', desc: 'Employers see candidates ranked by AI score with detailed breakdowns — no resume bias.' },
            ].map((step, i) => (
              <div key={i} className="card p-6 text-center hover:shadow-md transition">
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to get started?</h2>
          <p className="text-gray-500 mb-8">Join thousands of job seekers and employers using AI to hire better.</p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/register?role=SEEKER" className="btn-primary px-6 py-3 text-base">
              Find Jobs
            </Link>
            <Link href="/auth/register?role=EMPLOYER" className="btn-secondary px-6 py-3 text-base">
              Post a Job
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
