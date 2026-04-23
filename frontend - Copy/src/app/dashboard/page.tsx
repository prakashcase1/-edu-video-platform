'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Plus, VideoIcon, Clock, CheckCircle, XCircle,
  TrendingUp, ArrowRight, Sparkles, FileText, Layers
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn, formatRelativeTime, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Project } from '@/types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'recent'],
    queryFn: () => projectsApi.list({ limit: 6 }),
  });

  const projects = data?.projects || [];

  const stats = {
    total: data?.pagination?.total || 0,
    completed: projects.filter((p) => p.status === 'COMPLETED').length,
    processing: projects.filter((p) => p.status === 'PROCESSING').length,
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold">
          Good {getGreeting()},{' '}
          <span className="text-gradient">{user?.name?.split(' ')[0] || 'Creator'}</span> 👋
        </h1>
        <p className="text-slate-400 mt-1">Ready to create something amazing today?</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: data?.pagination?.total || 0, icon: FolderIcon, color: 'text-brand-400', bg: 'bg-brand-400/10' },
          { label: 'Completed', value: projects.filter(p => p.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/10' },
          { label: 'Processing', value: projects.filter(p => p.status === 'PROCESSING' || p.status === 'DRAFT').length, icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
          { label: 'Failed', value: projects.filter(p => p.status === 'FAILED').length, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-400/10' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card"
          >
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold">{isLoading ? '—' : stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/projects/new" className="card-hover group">
          <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center mb-4 group-hover:bg-brand-600/25 transition-colors">
            <Plus className="w-5 h-5 text-brand-400" />
          </div>
          <h3 className="font-semibold mb-1">New Video Project</h3>
          <p className="text-sm text-slate-400">Start creating a new educational video from scratch.</p>
          <div className="flex items-center gap-1 text-brand-400 text-sm mt-3 font-medium">
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
        <div className="card opacity-60 cursor-not-allowed select-none">
          <div className="w-10 h-10 rounded-xl bg-accent-violet/10 flex items-center justify-center mb-4">
            <FileText className="w-5 h-5 text-accent-violet" />
          </div>
          <h3 className="font-semibold mb-1">Import Script</h3>
          <p className="text-sm text-slate-400">Coming soon — import from Google Docs or Word.</p>
          <span className="badge bg-slate-500/10 text-slate-400 text-xs mt-3">Soon</span>
        </div>
        <div className="card opacity-60 cursor-not-allowed select-none">
          <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center mb-4">
            <Layers className="w-5 h-5 text-accent-cyan" />
          </div>
          <h3 className="font-semibold mb-1">Templates</h3>
          <p className="text-sm text-slate-400">Coming soon — start from a curated template.</p>
          <span className="badge bg-slate-500/10 text-slate-400 text-xs mt-3">Soon</span>
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Recent Projects</h2>
          <Link href="/dashboard/projects" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="aspect-video bg-surface-200 rounded-xl mb-4 shimmer" />
                <div className="h-4 bg-surface-200 rounded shimmer mb-2 w-3/4" />
                <div className="h-3 bg-surface-200 rounded shimmer w-1/2" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-brand-600/10 flex items-center justify-center mx-auto mb-4">
              <VideoIcon className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No projects yet</h3>
            <p className="text-slate-400 mb-6">Create your first educational video to get started.</p>
            <Link href="/dashboard/projects/new" className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Create Project
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} delay={i * 0.05} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, delay }: { project: Project; delay: number }) {
  const latestRendering = project.renderings?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link href={`/dashboard/projects/${project.id}`} className="card-hover block group">
        {/* Thumbnail */}
        <div className="aspect-video bg-surface-200 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center">
          {latestRendering?.videoUrl ? (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <VideoIcon className="w-10 h-10 text-slate-600" />
              <div className="absolute inset-0 bg-brand-600/10" />
            </div>
          ) : (
            <VideoIcon className="w-10 h-10 text-slate-600" />
          )}
          <div className="absolute top-2 right-2">
            <span className={cn('badge text-xs', getStatusColor(project.status))}>
              {getStatusLabel(project.status)}
            </span>
          </div>
        </div>

        <h3 className="font-semibold text-sm mb-1 truncate group-hover:text-brand-400 transition-colors">
          {project.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="capitalize">{project.mode.replace('_', ' ')}</span>
          <span>{formatRelativeTime(project.updatedAt)}</span>
        </div>

        {latestRendering?.status === 'PROCESSING' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Rendering...</span>
              <span>{latestRendering.progress}%</span>
            </div>
            <div className="h-1 bg-surface-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${latestRendering.progress}%` }}
              />
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return <VideoIcon className={className} />;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
