'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const StatCard = ({ label, value, sub }) => (
  <div className="card p-5">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

export default function AdminPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    Promise.all([
      adminApi.stats().then(r => setStats(r.data)),
      adminApi.users().then(r => setUsers(r.data.users)),
      adminApi.jobs().then(r => setJobs(r.data.jobs)),
    ]).finally(() => setLoading(false));
  }, [user]);

  const toggleUser = async (userId) => {
    try {
      const res = await adminApi.toggleUser(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: res.data.isActive } : u));
      toast.success('User updated');
    } catch { toast.error('Failed to update user'); }
  };

  const updateJobStatus = async (jobId, status) => {
    try {
      await adminApi.updateJobStatus(jobId, status);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j));
      toast.success('Job status updated');
    } catch { toast.error('Failed to update job'); }
  };

  if (!user || user.role !== 'ADMIN') {
    return <div className="text-center py-12 text-gray-500">Admin access required.</div>;
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8 text-gray-400">Loading admin data...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {['overview', 'users', 'jobs', 'payments'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition
              ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={stats.users.total} sub={`${stats.users.seekers} seekers · ${stats.users.employers} employers`} />
            <StatCard label="Active Jobs" value={stats.jobs.active} sub={`${stats.jobs.total} total`} />
            <StatCard label="Applications" value={stats.applications.total} />
            <StatCard label="Revenue" value={`$${stats.revenue.total.toLocaleString()}`} sub="All time" />
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Payments</h2>
            <div className="space-y-2">
              {stats.recentPayments?.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.user?.companyName || p.user?.email}</p>
                    <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">${(p.amount / 100).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{p.tier}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">All Users ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">User</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Role</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Joined</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Activity</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5">
                      <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                      <p className="text-gray-400 text-xs">{u.email}</p>
                      {u.companyName && <p className="text-gray-400 text-xs">{u.companyName}</p>}
                    </td>
                    <td className="py-2.5">
                      <span className={`badge ${u.role === 'EMPLOYER' ? 'bg-blue-100 text-blue-700' : u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 text-gray-500">
                      {u._count?.applications || 0} apps · {u._count?.postedJobs || 0} jobs
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => toggleUser(u.id)}
                        className={`badge cursor-pointer ${u.isActive ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-600 hover:bg-green-100 hover:text-green-700'}`}
                      >
                        {u.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">All Jobs ({jobs.length})</h2>
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{job.title}</p>
                  <p className="text-xs text-gray-400">{job.employer?.companyName} · {job._count?.applications} apps</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${job.tier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : job.tier === 'STANDARD' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {job.tier}
                  </span>
                  <select
                    value={job.status}
                    onChange={e => updateJobStatus(job.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1.5 py-1"
                  >
                    {['DRAFT','ACTIVE','PAUSED','CLOSED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Payment History</h2>
          <PaymentsTab />
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  useEffect(() => {
    adminApi.payments().then(r => setPayments(r.data)).catch(() => {});
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 text-gray-500 font-medium">Company</th>
            <th className="text-left py-2 text-gray-500 font-medium">Tier</th>
            <th className="text-left py-2 text-gray-500 font-medium">Amount</th>
            <th className="text-left py-2 text-gray-500 font-medium">Status</th>
            <th className="text-left py-2 text-gray-500 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2.5 text-gray-900">{p.user?.companyName || p.user?.email}</td>
              <td className="py-2.5"><span className="badge bg-blue-100 text-blue-700">{p.tier}</span></td>
              <td className="py-2.5 font-medium text-green-600">${(p.amount / 100).toFixed(2)}</td>
              <td className="py-2.5">
                <span className={`badge ${p.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : p.status === 'FAILED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              </td>
              <td className="py-2.5 text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
