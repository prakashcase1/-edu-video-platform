'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus, Search, VideoIcon, Trash2, ExternalLink,
  Filter, Loader2, AlertCircle, MoreVertical, Share2, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '@/lib/api';
import { cn, formatRelativeTime, getStatusColor, getStatusLabel, formatDuration } from '@/lib/utils';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['projects', { search, status: statusFilter, page }],
    queryFn: () => projectsApi.list({ search, status: statusFilter || undefined, page, limit: 12 }),
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: () => toast.error('Failed to delete project'),
    onSettled: () => setDeletingId(null),
  });

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setDeletingId(project.id);
    deleteMutation.mutate(project.id);
  };

  const projects = data?.projects || [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-slate-400 mt-0.5 text-sm">
            {pagination?.total ?? '—'} project{(pagination?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/dashboard/projects/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search projects..."
            className="input-field pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field w-40"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-video bg-surface-200 rounded-xl mb-4 shimmer" />
              <div className="h-4 bg-surface-200 rounded shimmer mb-2 w-3/4" />
              <div className="h-3 bg-surface-200 rounded shimmer w-1/2" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
            {search || statusFilter ? (
              <AlertCircle className="w-8 h-8 text-slate-500" />
            ) : (
              <VideoIcon className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <h3 className="font-semibold text-lg mb-2">
            {search || statusFilter ? 'No matching projects' : 'No projects yet'}
          </h3>
          <p className="text-slate-400 mb-6">
            {search || statusFilter
              ? 'Try adjusting your filters'
              : 'Create your first educational video'}
          </p>
          {!search && !statusFilter && (
            <Link href="/dashboard/projects/new" className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Create Project
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative group"
              >
                <Link href={`/dashboard/projects/${project.id}`} className="card-hover block">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-surface-200 rounded-xl mb-3 overflow-hidden relative flex items-center justify-center">
                    <VideoIcon className="w-8 h-8 text-slate-600" />
                    <div className="absolute top-2 left-2">
                      <span className={cn('badge text-xs', getStatusColor(project.status))}>
                        {getStatusLabel(project.status)}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        disabled={deletingId === project.id}
                        className="w-7 h-7 rounded-lg bg-surface-0/80 backdrop-blur flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        {deletingId === project.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <h3 className="font-medium text-sm mb-1.5 truncate">{project.title}</h3>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="capitalize">{project.mode.replace('_', ' ')}</span>
                    <span>{formatRelativeTime(project.updatedAt)}</span>
                  </div>

                  {/* Render progress */}
                  {project.renderings?.[0]?.status === 'PROCESSING' && (
                    <div className="mt-2">
                      <div className="h-1 bg-surface-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${project.renderings[0].progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Completed duration */}
                  {project.renderings?.[0]?.status === 'COMPLETED' && project.renderings[0].duration && (
                    <div className="mt-2 text-xs text-slate-500">
                      Duration: {formatDuration(project.renderings[0].duration)}
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages || isFetching}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
