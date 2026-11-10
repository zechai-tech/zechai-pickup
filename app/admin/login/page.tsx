'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/stores/admin-store';
import { Button } from '@/components/ui/Button';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setUser } = useAdminStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // 2. Fetch user profile from public.users
      const res = await fetch(`/api/admin/users/me?email=${encodeURIComponent(cleanEmail)}`);
      const data = await res.json();

      if (!res.ok || !data.user) {
        throw new Error(data.error || 'User profile not found in Zécha system');
      }

      // 3. Store user in Zustand
      setUser(data.user, authData.session?.access_token || null);

      // 4. Role-based routing
      if (data.user.role === 'staff' || data.user.role === 'ordering_staff') {
        router.push('/admin/orders');
      } else {
        router.push('/admin/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setEmail('adminzechai@gmail.com');
    setPassword('admin@zechai');
  };

  return (
    <div className="w-full max-w-[420px] bg-card rounded-[32px] border border-border shadow-2xl p-6 sm:p-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Top Brand Logo */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-border/70 mb-6">
        <div className="relative w-36 h-12 mb-3">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha!"
            fill
            className="object-contain"
            priority
          />
        </div>
        <h1 className="font-display font-black text-xl text-espresso tracking-tight">
          Operations Portal
        </h1>
        <p className="text-xs text-espresso/60 font-medium mt-0.5">
          Staff & Management Authentication
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
            placeholder="adminzechai@gmail.com"
            required
            className="w-full h-12 px-4 rounded-2xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-orange" />
            <span>Password</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full h-12 px-4 rounded-2xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 transition-all"
          />
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

      {/* Quick Fill Demo Helper */}
      <div className="mt-6 pt-5 border-t border-border/70 text-center">
        <p className="text-[11px] text-espresso/60 font-medium mb-2">
          Default seed credentials:
        </p>
        <button
          type="button"
          onClick={handleFillDemoAdmin}
          className="px-3 py-1.5 rounded-full bg-sand/60 hover:bg-sand border border-border text-xs font-bold text-espresso transition-colors active:scale-95"
        >
          Fill Demo Admin (adminzechai@gmail.com)
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-espresso/50">
        <ShieldCheck className="w-3.5 h-3.5 text-brandGreen" />
        <span>Supabase Auth Protected</span>
      </div>
    </div>
  );
}
