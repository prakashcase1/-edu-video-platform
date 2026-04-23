'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Play, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 relative bg-surface-50 items-center justify-center p-12">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="relative text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-6 shadow-glow-brand">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">EduVideo Platform</h2>
          <p className="text-slate-400 max-w-sm leading-relaxed">
            Create professional educational videos with AI narration and lifelike avatar presenters.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {[
              { label: 'Videos Created', value: '12,400+' },
              { label: 'Educators', value: '3,200+' },
              { label: 'Languages', value: '28' },
              { label: 'Avg. Generation', value: '< 5 min' },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <div className="text-2xl font-bold text-gradient">{s.value}</div>
                <div className="text-sm text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Play className="w-4 h-4 fill-white text-white" />
            </div>
            <span className="font-bold text-lg">EduVideo</span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-slate-400 mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                {...register('email')}
                type="email"
                className={cn('input-field', errors.email && 'border-rose-500/50 focus:border-rose-500')}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-rose-400 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={cn(
                    'input-field pr-12',
                    errors.password && 'border-rose-500/50 focus:border-rose-500',
                  )}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-400 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 justify-center text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 mt-6 text-sm">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
