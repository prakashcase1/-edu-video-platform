'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Play, Download, Share2, VideoIcon, Clock, FileText,
  Loader2, AlertCircle
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { formatDuration, downloadFile, getStatusColor, getStatusLabel } from '@/lib/utils';
import { useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['shared', token],
    queryFn: () => projectsApi.getShared(token),
  });

  const videoUrl = project?.renderings?.[0]?.videoUrl;

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    if (!playerRef.current) {
      playerRef.current = videojs(videoRef.current, {
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{ type: 'video/mp4', src: videoUrl }],
      });
    }

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="w-16 h-16 text-slate-500" />
        <h2 className="text-xl font-semibold">Video not found</h2>
        <p className="text-slate-400 text-center max-w-sm">
          This shared link is invalid or has been removed.
        </p>
      </div>
    );
  }

  const rendering = project.renderings?.[0];

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <Play className="w-3.5 h-3.5 fill-white text-white" />
          </div>
          <span className="font-bold">EduVideo</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
            {project.description && (
              <p className="text-slate-400">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
              <span className="capitalize">{project.mode.replace('_', ' ')} mode</span>
              {rendering?.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(rendering.duration)}
                </span>
              )}
            </div>
          </div>

          {/* Video */}
          {videoUrl ? (
            <div className="card p-0 overflow-hidden mb-6">
              <div data-vjs-player>
                <video
                  ref={videoRef}
                  className="video-js vjs-big-play-centered"
                />
              </div>
              <div className="p-4 flex gap-3">
                <button
                  onClick={() => downloadFile(videoUrl, `${project.title}.mp4`)}
                  className="btn-secondary text-sm"
                >
                  <Download className="w-4 h-4" /> Download Video
                </button>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16 mb-6">
              <VideoIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">Video is still processing. Check back soon.</p>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-sm text-slate-500">
            Created with{' '}
            <a href="/" className="text-brand-400 hover:underline">EduVideo Platform</a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
