'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Play, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

const perks = [
  'Unlimited AI-narrated videos',
  '6 avatar presenters included',
  'Multi-language voice support',
  'HD video export & sharing',
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success('Account created! Welcome to EduVideo 🎉');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 relative bg-surface-50 items-center justify-center p-12">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mb-6 shadow-glow-brand">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Start for free</h2>
          <p className="text-slate-400 max-w-sm leading-relaxed mb-10">
            Everything you need to create professional educational videos — no credit card required.
          </p>
          <div className="space-y-3">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-3 text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0" />
                <span>{perk}</span>
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

          <h1 className="text-3xl font-bold mb-2">Create your account</h1>
          <p className="text-slate-400 mb-8">Free forever — no credit card needed</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
              <input
                {...register('name')}
                className={cn('input-field', errors.name && 'border-rose-500/50')}
                placeholder="John Doe"
              />
              {errors.name && <p className="text-rose-400 text-xs mt-1.5">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                {...register('email')}
                type="email"
                className={cn('input-field', errors.email && 'border-rose-500/50')}
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-rose-400 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={cn('input-field pr-12', errors.password && 'border-rose-500/50')}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-rose-400 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  className={cn('input-field pr-12', errors.confirmPassword && 'border-rose-500/50')}
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-rose-400 text-xs mt-1.5">{errors.confirmPassword.message}</p>
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
                  Creating account...
                </>
              ) : (
                'Create Free Account'
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 mt-6 text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
