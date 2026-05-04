'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { jobsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const FIELD_HINTS = {
  FULL_TIME: 'Full Time', PART_TIME: 'Part Time',
  CONTRACT: 'Contract', INTERNSHIP: 'Internship', FREELANCE: 'Freelance',
};
const EXP_LEVELS = ['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'];
const TIERS = [
  { value: 'FREE', label: 'Free', desc: '14-day listing, basic placement', price: '$0' },
  { value: 'STANDARD', label: 'Standard', desc: '30-day listing, priority placement', price: '$29' },
  { value: 'PREMIUM', label: 'Premium', desc: '60-day listing, featured + support', price: '$79' },
];

export default function PostJobPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', location: '', isRemote: false,
    jobType: 'FULL_TIME', experienceLevel: 'MID',
    salaryMin: '', salaryMax: '', tier: 'FREE',
    requirements: [''], skills: [''],
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const updateArray = (key, index, value) => {
    const arr = [...form[key]];
    arr[index] = value;
    setForm(p => ({ ...p, [key]: arr }));
  };

  const addToArray = (key) => setForm(p => ({ ...p, [key]: [...p[key], ''] }));
  const removeFromArray = (key, index) => setForm(p => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        requirements: form.requirements.filter(r => r.trim()),
        skills: form.skills.filter(s => s.trim()),
        salaryMin: form.salaryMin ? parseInt(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? parseInt(form.salaryMax) : undefined,
      };

      if (payload.requirements.length === 0) {
        toast.error('Add at least one requirement');
        setLoading(false);
        return;
      }

      const res = await jobsApi.create(payload);
      const job = res.data;

      if (form.tier === 'FREE') {
        toast.success('Job posted! It\'s live now.');
        router.push('/employer/dashboard');
      } else {
        router.push(`/pricing?jobId=${job.id}&tier=${form.tier}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'EMPLOYER') {
    return <div className="text-center py-12 text-gray-500">Employer access required.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Post a New Job</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Information</h2>
          <div>
            <label className="label">Job Title *</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required maxLength={120} placeholder="e.g. Senior React Developer" />
          </div>
          <div>
            <label className="label">Description * (min 100 chars)</label>
            <textarea className="input" rows={6} value={form.description} onChange={e => set('description', e.target.value)} required minLength={100} placeholder="Describe the role, responsibilities, and your team..." />
            <p className="text-xs text-gray-400 mt-1">{form.description.length} characters</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Job Type</label>
              <select className="input" value={form.jobType} onChange={e => set('jobType', e.target.value)}>
                {Object.entries(FIELD_HINTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Experience Level</label>
              <select className="input" value={form.experienceLevel} onChange={e => set('experienceLevel', e.target.value)}>
                {EXP_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Location *</label>
              <input className="input" value={form.location} onChange={e => set('location', e.target.value)} required placeholder="e.g. San Francisco, CA" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="remote" checked={form.isRemote} onChange={e => set('isRemote', e.target.checked)} className="w-4 h-4" />
              <label htmlFor="remote" className="text-sm text-gray-700">Remote OK</label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Salary Min ($)</label>
              <input className="input" type="number" value={form.salaryMin} onChange={e => set('salaryMin', e.target.value)} placeholder="50000" />
            </div>
            <div>
              <label className="label">Salary Max ($)</label>
              <input className="input" type="number" value={form.salaryMax} onChange={e => set('salaryMax', e.target.value)} placeholder="90000" />
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Requirements</h2>
          {form.requirements.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" value={r} onChange={e => updateArray('requirements', i, e.target.value)} placeholder={`Requirement ${i + 1}`} />
              {form.requirements.length > 1 && (
                <button type="button" onClick={() => removeFromArray('requirements', i)} className="text-red-400 hover:text-red-600 px-2">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addToArray('requirements')} className="btn-secondary text-sm">+ Add Requirement</button>
        </div>

        {/* Skills */}
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Required Skills</h2>
          <div className="space-y-2">
            {form.skills.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-1" value={s} onChange={e => updateArray('skills', i, e.target.value)} placeholder={`e.g. React, TypeScript, Node.js`} />
                {form.skills.length > 1 && (
                  <button type="button" onClick={() => removeFromArray('skills', i)} className="text-red-400 hover:text-red-600 px-2">✕</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addToArray('skills')} className="btn-secondary text-sm">+ Add Skill</button>
        </div>

        {/* Tier Selection */}
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Listing Tier</h2>
          <div className="space-y-2">
            {TIERS.map(tier => (
              <label
                key={tier.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${form.tier === tier.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <input type="radio" name="tier" value={tier.value} checked={form.tier === tier.value} onChange={() => set('tier', tier.value)} className="w-4 h-4 accent-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{tier.label}</p>
                  <p className="text-sm text-gray-500">{tier.desc}</p>
                </div>
                <span className="font-bold text-gray-900">{tier.price}</span>
              </label>
            ))}
          </div>
          {form.tier !== 'FREE' && (
            <p className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">You'll be redirected to Stripe checkout after posting.</p>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? 'Posting...' : form.tier === 'FREE' ? 'Post Job for Free' : `Post & Pay ${form.tier === 'PREMIUM' ? '$79' : '$29'}`}
        </button>
      </form>
    </div>
  );
}
