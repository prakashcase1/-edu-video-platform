'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Play, Download, Share2, RefreshCw, Trash2,
  Loader2, CheckCircle2, XCircle, Clock, VideoIcon, Copy,
  Layers, Mic, FileText, Image
} from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, renderingApi } from '@/lib/api';
import {
  cn, formatRelativeTime, formatDuration, formatFileSize,
  getStatusColor, getStatusLabel, downloadFile, copyToClipboard
} from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status !== 'COMPLETED' && status !== 'FAILED' ? 3000 : false;     },
  });

  const { data: rendering } = useQuery({
    queryKey: ['rendering', id],
    queryFn: () => renderingApi.getStatus(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'QUEUED' || status === 'PROCESSING' ? 3000 : false;
    },
    enabled: !!project,
  });

  const renderMutation = useMutation({
    mutationFn: () => renderingApi.start(id),
    onSuccess: () => {
      toast.success('Render started!');
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['rendering', id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to start render'),
  });

  const shareMutation = useMutation({
    mutationFn: () => projectsApi.generateShareLink(id),
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
      copyToClipboard(shareUrl);
      toast.success('Share link copied to clipboard!');
    },
    onError: () => toast.error('Failed to generate share link'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(id),
    onSuccess: () => {
      toast.success('Project deleted');
      router.push('/dashboard/projects');
    },
  });

  // When rendering completes, refresh project data to show video
  useEffect(() => {
    if (rendering?.status === 'COMPLETED' || rendering?.status === 'FAILED') {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  }, [rendering?.status]);



  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">Project not found</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">Go Back</button>
      </div>
    );
  }

  const latestRendering = rendering || project.renderings?.[0];
  const videoUrl = latestRendering?.videoUrl;
  const isProcessing = latestRendering?.status !== 'COMPLETED' && status !== 'FAILED'
  const progress = latestRendering?.progress || 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Projects
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{project.title}</h1>
              {project.description && (
                <p className="text-slate-400 text-sm mt-1">{project.description}</p>
              )}
            </div>
            <span className={cn('badge shrink-0 text-sm py-1.5 px-3', getStatusColor(project.status))}>
              {getStatusLabel(project.status)}
            </span>
          </div>

          {/* Video player / render status */}
          {videoUrl ? (
            <div className="card p-0 overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-t-2xl bg-black"
                style={{ maxHeight: '480px' }}
              >
                Your browser does not support the video tag.
              </video>
              <div className="p-4 flex items-center gap-3">
                <button
                  onClick={() => downloadFile(videoUrl, `${project.title}.mp4`)}
                  className="btn-secondary text-sm"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
                <button
                  onClick={() => shareMutation.mutate()}
                  disabled={shareMutation.isPending}
                  className="btn-secondary text-sm"
                >
                  {shareMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  Share
                </button>
                {latestRendering?.duration && (
                  <span className="text-sm text-slate-400 ml-auto">
                    {formatDuration(latestRendering.duration)}
                  </span>
                )}
              </div>
            </div>
          ) : isProcessing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card text-center py-10"
            >
              <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {latestRendering?.status === 'QUEUED' ? 'In Queue...' : 'Rendering Video...'}
              </h3>
              <p className="text-slate-400 text-sm mb-5">
                Our AI pipeline is generating your video. This usually takes a few minutes.
              </p>
              <div className="max-w-sm mx-auto">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Progress</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-brand-600 to-accent-cyan rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  {getProgressMessage(progress)}
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="card text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
                <VideoIcon className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No video yet</h3>
              <p className="text-slate-400 text-sm mb-6">
                {latestRendering?.status === 'FAILED'
                  ? `Rendering failed: ${latestRendering.errorMessage || 'Unknown error'}`
                  : 'Start rendering to generate your video.'}
              </p>
              <button
                onClick={() => renderMutation.mutate()}
                disabled={renderMutation.isPending}
                className="btn-primary mx-auto"
              >
                {renderMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
                ) : (
                  <><Play className="w-4 h-4 fill-white" /> Start Render</>
                )}
              </button>
            </div>
          )}

          {/* Scenes list */}
          {project.scenes.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-400" />
                Scenes ({project.scenes.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {project.scenes.map((scene, i) => (
                  <div key={scene.id} className="flex gap-3 p-3 bg-surface-100 rounded-xl">
                    <span className="text-xs font-bold text-brand-400 mt-0.5 w-5 shrink-0">{i + 1}</span>
                    <p className="text-xs text-slate-400 line-clamp-2">{scene.scriptText}</p>
                    {scene.duration && (
                      <span className="text-xs text-slate-500 shrink-0 ml-auto">
                        {formatDuration(scene.duration)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Project info */}
          <div className="card space-y-4">
            <h3 className="font-semibold">Project Info</h3>
            <InfoRow icon={VideoIcon} label="Mode" value={project.mode.replace('_', ' ')} />
            <InfoRow icon={FileText} label="Scenes" value={project.scenes.length.toString()} />
            <InfoRow icon={Image} label="Slides" value={project.slides.length.toString()} />
            {project.voiceConfig && (
              <InfoRow icon={Mic} label="Voice" value={project.voiceConfig.voiceName} />
            )}
            {latestRendering?.duration && (
              <InfoRow icon={Clock} label="Duration" value={formatDuration(latestRendering.duration)} />
            )}
            {latestRendering?.fileSize && (
              <InfoRow icon={Download} label="File Size" value={formatFileSize(Number(latestRendering.fileSize))} />
            )}
            <div className="divider my-0" />
            <div className="text-xs text-slate-500 space-y-1">
              <p>Created {formatRelativeTime(project.createdAt)}</p>
              <p>Updated {formatRelativeTime(project.updatedAt)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="card space-y-3">
            <h3 className="font-semibold">Actions</h3>
            {!isProcessing && (
              <button
                onClick={() => renderMutation.mutate()}
                disabled={renderMutation.isPending}
                className="btn-primary w-full justify-center"
              >
                {renderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Re-render
              </button>
            )}
            {videoUrl && (
              <>
                <button
                  onClick={() => downloadFile(videoUrl, `${project.title}.mp4`)}
                  className="btn-secondary w-full justify-center"
                >
                  <Download className="w-4 h-4" /> Download Video
                </button>
                <button
                  onClick={() => shareMutation.mutate()}
                  disabled={shareMutation.isPending}
                  className="btn-secondary w-full justify-center"
                >
                  <Share2 className="w-4 h-4" /> Copy Share Link
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (confirm('Delete this project permanently?')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="btn-danger w-full justify-center"
            >
              <Trash2 className="w-4 h-4" /> Delete Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span className="text-white capitalize">{value}</span>
    </div>
  );
}

function getProgressMessage(progress: number): string {
  if (progress < 15) return 'Initializing AI pipeline...';
  if (progress < 40) return 'Generating audio narration...';
  if (progress < 65) return 'Syncing slides with audio...';
  if (progress < 85) return 'Encoding video segments...';
  if (progress < 95) return 'Merging final video...';
  return 'Uploading to storage...';
}

