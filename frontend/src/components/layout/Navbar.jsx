'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export default function Navbar() {
  const router = useRouter();
  const { user, logout, init } = useAuthStore();

  useEffect(() => { init(); }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TM</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">TalentMatch</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link href="/jobs" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition">
              Browse Jobs
            </Link>
            <Link href="/pricing" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition">
              Pricing
            </Link>

            {user ? (
              <>
                {user.role === 'EMPLOYER' && (
                  <Link href="/employer/dashboard" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition">
                    Dashboard
                  </Link>
                )}
                {user.role === 'SEEKER' && (
                  <Link href="/dashboard" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition">
                    My Applications
                  </Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link href="/admin" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition">
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                  <span className="text-sm text-gray-600">{user.firstName}</span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link href="/auth/login" className="btn-secondary text-sm py-1.5">
                  Login
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm py-1.5">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
