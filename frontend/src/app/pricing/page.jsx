'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';

const PLANS = [
  {
    tier: 'FREE',
    name: 'Free',
    price: '$0',
    period: '',
    color: 'border-gray-200',
    features: ['14-day listing', 'Up to 50 applications', 'AI matching scores', 'Basic analytics'],
    cta: 'Post for Free',
    highlight: false,
  },
  {
    tier: 'STANDARD',
    name: 'Standard',
    price: '$29',
    period: '/listing',
    color: 'border-blue-500',
    features: ['30-day listing', 'Unlimited applications', 'AI matching scores', 'Priority placement', 'Email support'],
    cta: 'Get Standard',
    highlight: false,
  },
  {
    tier: 'PREMIUM',
    name: 'Premium',
    price: '$79',
    period: '/listing',
    color: 'border-purple-500',
    features: ['60-day listing', 'Unlimited applications', 'AI matching scores', 'Featured placement', 'Priority support', 'Candidate outreach tools'],
    cta: 'Get Premium',
    highlight: true,
  },
];

function PricingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(null);

  const jobId = searchParams.get('jobId');
  const defaultTier = searchParams.get('tier');

  const handleCheckout = async (tier) => {
    if (!user) { router.push('/auth/login'); return; }
    if (user.role !== 'EMPLOYER') { toast.error('Only employers can purchase listings'); return; }
    if (tier === 'FREE') { router.push('/employer/post-job'); return; }

    setLoading(tier);
    try {
      const res = await paymentsApi.createCheckout({ tier, jobId: jobId || undefined });
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create checkout');
      setLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
        <p className="text-lg text-gray-500">Pay per job posting. No subscriptions. No hidden fees.</p>
        {jobId && (
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm text-blue-700">
            ✓ Your job listing is ready — choose a tier to activate it
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {PLANS.map(plan => (
          <div
            key={plan.tier}
            className={`card p-6 border-2 relative ${plan.highlight ? 'border-purple-500 shadow-lg' : plan.color}`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">Most Popular</span>
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(plan.tier)}
              disabled={loading === plan.tier}
              className={`w-full py-2.5 rounded-lg font-medium transition ${
                plan.highlight
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : plan.tier === 'FREE'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {loading === plan.tier ? 'Redirecting...' : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'How does AI scoring work?', a: 'Claude AI reads each applicant\'s resume and your job description, then scores the match 0-100 across 5 dimensions: skills, experience, education, job history relevance, and potential.' },
            { q: 'When does my listing expire?', a: 'Free listings run for 14 days, Standard for 30 days, and Premium for 60 days. You can always close a listing early or renew it.' },
            { q: 'Is my payment secure?', a: 'Payments are processed by Stripe, a PCI-DSS compliant payment processor. We never store your card details.' },
            { q: 'Can I upgrade a Free listing to Standard/Premium?', a: 'Yes! Go to your employer dashboard and click "Activate" on any draft or free listing to choose a paid tier.' },
          ].map((item, i) => (
            <div key={i} className="card p-4">
              <p className="font-medium text-gray-900 mb-1">{item.q}</p>
              <p className="text-sm text-gray-500">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return <Suspense><PricingContent /></Suspense>;
}
