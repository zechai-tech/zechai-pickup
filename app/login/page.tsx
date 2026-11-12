'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SafeImage } from '@/components/ui/SafeImage';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/stores/admin-store';
import { Button } from '@/components/ui/Button';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function StaffLoginPage() {
  const router = useRouter();
  const { setUser } = useAdminStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState('');

  // Auto-redirect if session already active on mount
  React.useEffect(() => {
    let isMounted = true;
    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const cleanEmail = session.user.email?.toLowerCase().trim() || '';
          const res = await fetch(
            `/api/admin/users/me?uid=${session.user.id}&email=${encodeURIComponent(cleanEmail)}`
          );
          const data = await res.json();

          if (res.ok && data.user && data.user.is_active) {
            setUser(data.user, session.access_token);
            if (data.user.role === 'admin' || data.user.role === 'manager') {
              router.replace('/admin/dashboard');
              return;
            } else {
              router.replace('/staff/orders');
              return;
            }
          }
        }
      } catch (err) {
        console.error('Session check on /login error:', err);
      }

      if (isMounted) {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [router, setUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        throw new Error(authError.message || 'Invalid email or password');
      }

      const authUid = authData.user?.id;

      // 2. Fetch user profile from public.users by auth UID
      const res = await fetch(`/api/admin/users/me?uid=${authUid}&email=${encodeURIComponent(cleanEmail)}`);
      const data = await res.json();

      if (!res.ok || !data.user) {
        await supabase.auth.signOut();
        throw new Error(data.error || 'User profile not found in Zécha system');
      }

      // Check if deactivated
      if (!data.user.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been deactivated. Contact your manager.');
      }

      // 3. Store user in Zustand
      setUser(data.user, authData.session?.access_token || null);

      // 4. Role-based routing
      if (data.user.role === 'admin' || data.user.role === 'manager') {
        router.push('/admin/dashboard');
      } else {
        router.push('/staff/orders');
      }
    } catch (err: any) {
      console.error('Staff login error:', err);
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange mx-auto mb-4" />
          <p className="text-espresso/70 text-xs font-bold tracking-wide">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-espresso flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[420px] bg-card rounded-[32px] border border-border shadow-2xl p-6 sm:p-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Brand Logo */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-border/70 mb-6">
          <div className="relative w-36 h-12 mb-3">
            <SafeImage
              src="/assets/logo-orange.v1.webp"
              alt="Zécha!"
              fill
              sizes="144px"
              transparent
              className="object-contain"
            />
          </div>
          <h1 className="font-display font-black text-xl text-espresso tracking-tight">
            Staff Portal
          </h1>
          <p className="text-xs text-espresso/60 font-medium mt-0.5">
            Staff & Outlet Login
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-[#FDF0F0] border border-brandRed/20 text-brandRed text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-orange" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-2xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-orange" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-12 pl-4 pr-11 rounded-2xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#75604F] hover:text-espresso transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            isLoading={loading}
            className="w-full h-13 text-[16px] font-bold shadow-orange group mt-2"
          >
            <span>Sign In to Portal</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-espresso/50">
          <ShieldCheck className="w-3.5 h-3.5 text-brandGreen" />
          <span>Supabase Auth Protected</span>
        </div>
      </div>
    </div>
  );
}
