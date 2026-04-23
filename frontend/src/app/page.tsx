'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Play, Sparkles, Users, VideoIcon, Mic, ArrowRight,
  BookOpen, BarChart3, Globe, CheckCircle2, Layers, Zap
} from 'lucide-react';

const features = [
  {
    icon: VideoIcon,
    title: 'No-Face Mode',
    desc: 'Combine your slides with AI-generated narration for a clean, professional presentation video.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: Users,
    title: 'Avatar Presenter',
    desc: 'Choose a lifelike AI avatar to present your content with natural speech and expression.',
    color: 'text-accent-violet',
    bg: 'bg-accent-violet/10',
  },
  {
    icon: Mic,
    title: 'AI Voice Studio',
    desc: 'Select from dozens of natural voices across multiple languages, with speed and pitch control.',
    color: 'text-accent-cyan',
    bg: 'bg-accent-cyan/10',
  },
  {
    icon: Zap,
    title: 'Smart Script Parser',
    desc: 'Paste your script and our AI splits it into perfectly timed scenes, synced to your slides.',
    color: 'text-accent-amber',
    bg: 'bg-accent-amber/10',
  },
  {
    icon: Layers,
    title: 'Slide Sync Engine',
    desc: 'Drag-and-drop mapping of slides to script segments for precise timing control.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    icon: Globe,
    title: 'Share & Export',
    desc: 'Generate shareable links or download your video in HD — ready for any platform.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
  },
];

const steps = [
  { n: '01', title: 'Write your script', desc: 'Type or paste your educational content.' },
  { n: '02', title: 'Upload slides', desc: 'Add your presentation images or leave them blank.' },
  { n: '03', title: 'Choose your mode', desc: 'Select no-face narration or an AI avatar presenter.' },
  { n: '04', title: 'Generate & share', desc: 'One click renders your full professional video.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-0">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] backdrop-blur-md sticky top-0 z-50 bg-surface-0/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold text-lg">EduVideo</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="btn-ghost text-sm">Sign in</Link>
            <Link href="/auth/register" className="btn-primary text-sm">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-28 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Educational Video Platform
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
              Turn scripts into
              <br />
              <span className="text-gradient">stunning videos</span>
            </h1>

            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Create professional educational videos with AI narration, avatar presenters,
              and smart slide synchronization — no recording equipment needed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register" className="btn-primary px-8 py-3.5 text-base">
                Start Creating Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/auth/login" className="btn-secondary px-8 py-3.5 text-base">
                <BookOpen className="w-4 h-4" />
                Sign in
              </Link>
            </div>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20 relative mx-auto max-w-5xl"
          >
            <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl bg-surface-50">
              <div className="h-8 bg-surface-100 flex items-center px-4 gap-2 border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-rose-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                <span className="ml-3 text-xs text-slate-500 font-mono">eduvideo.app/dashboard</span>
              </div>
              <div className="aspect-video bg-surface-100 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-4 p-8 w-full">
                  {[
                    { title: 'Intro to Algebra', status: 'COMPLETED', mode: 'NO_FACE' },
                    { title: 'Physics: Gravity', status: 'PROCESSING', mode: 'AVATAR' },
                    { title: 'History of Art', status: 'DRAFT', mode: 'NO_FACE' },
                  ].map((p, i) => (
                    <div key={i} className="glass rounded-xl p-4 text-left">
                      <div className="w-full aspect-video bg-surface-200 rounded-lg mb-3 flex items-center justify-center">
                        <VideoIcon className="w-8 h-8 text-slate-600" />
                      </div>
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge text-xs ${
                          p.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-400/10' :
                          p.status === 'PROCESSING' ? 'text-amber-400 bg-amber-400/10' :
                          'text-slate-400 bg-slate-400/10'
                        }`}>{p.status}</span>
                        <span className="text-xs text-slate-500">{p.mode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need to teach</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              A complete video production studio powered by AI — right in your browser.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-hover"
              >
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-surface-50/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">From script to video in minutes</h2>
            <p className="text-slate-400 text-lg">Four steps to your professional educational video.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card flex gap-5"
              >
                <div className="text-3xl font-extrabold text-gradient opacity-60 shrink-0 w-10">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-slate-400 text-sm">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card border border-brand-500/20 bg-brand-600/5">
            <h2 className="text-4xl font-bold mb-4">Start teaching today</h2>
            <p className="text-slate-400 mb-8 text-lg">
              Join educators who create engaging content without cameras or studios.
            </p>
            <Link href="/auth/register" className="btn-primary px-10 py-4 text-base mx-auto">
              Create Your First Video Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-6 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center">
            <Play className="w-3 h-3 fill-white text-white" />
          </div>
          <span className="font-semibold text-white">EduVideo</span>
        </div>
        <p>© 2025 EduVideo Platform. Built for educators.</p>
      </footer>
    </div>
  );
}
