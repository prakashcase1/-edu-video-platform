'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, Rocket, CheckCircle2, Layers, Mic,
  Users, MonitorPlay, FileText, Image, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { renderingApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { formatDuration, estimateScriptDuration } from '@/lib/utils';

export default function StepReview() {
  const router = useRouter();
  const {
    project, scriptContent, scenes, slides,
    selectedMode, selectedAvatarId, selectedVoiceId,
    voiceSpeed, voiceLanguage, prevStep, reset
  } = useWizardStore();

  const mutation = useMutation({
    mutationFn: () => renderingApi.start(project!.id),
    onSuccess: () => {
      toast.success('Rendering started! We\'ll notify you when it\'s done.');
      reset();
      router.push(`/dashboard/projects/${project!.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to start rendering');
    },
  });

  const checks = [
    { label: 'Project created', done: !!project?.id, icon: FileText },
    { label: `Mode: ${selectedMode === 'NO_FACE' ? 'No-Face Slides' : 'Avatar Presenter'}`, done: true, icon: selectedMode === 'NO_FACE' ? MonitorPlay : Users },
    { label: `Script: ${scriptContent.trim().split(/\s+/).length} words, ${scenes.length} scenes`, done: scriptContent.length > 0 && scenes.length > 0, icon: FileText },
    { label: `Slides: ${slides.length} uploaded`, done: selectedMode === 'AVATAR' || slides.length > 0, icon: Image },
    { label: `Voice: ${voiceLanguage.toUpperCase()}, ${voiceSpeed}x speed`, done: true, icon: Mic },
    ...(selectedMode === 'AVATAR' ? [{ label: `Avatar: ${selectedAvatarId || 'Selected'}`, done: !!selectedAvatarId, icon: Users }] : []),
  ];

  const allReady = checks.every((c) => c.done);
  const estimatedTime = Math.ceil(estimateScriptDuration(scriptContent) / 60 * 1.5);

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent-green/10 flex items-center justify-center mb-4">
          <Rocket className="w-6 h-6 text-accent-green" />
        </div>
        <h2 className="text-2xl font-bold">Ready to Generate</h2>
        <p className="text-slate-400 mt-1">Review your project settings before starting the AI render.</p>
      </div>

      {/* Checklist */}
      <div className="card mb-6 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Project Summary</h3>
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-3">
            {check.done ? (
              <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-rose-400/50 shrink-0" />
            )}
            <check.icon className="w-4 h-4 text-slate-500 shrink-0" />
            <span className={`text-sm ${check.done ? 'text-slate-300' : 'text-rose-400'}`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>

      {/* Time estimate */}
      <div className="card bg-brand-600/5 border border-brand-500/10 mb-8">
        <div className="flex items-start gap-3">
          <Rocket className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm mb-1">Estimated render time: ~{estimatedTime} minutes</p>
            <p className="text-xs text-slate-400">
              Your video will be processed in the background using our AI pipeline.
              Audio generation → slide sync → video encoding → upload. You'll be redirected to track progress.
            </p>
          </div>
        </div>
      </div>

      {!allReady && (
        <div className="card bg-rose-400/5 border border-rose-400/15 mb-6 text-sm text-rose-300">
          Some required steps are incomplete. Please go back and complete them.
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!allReady || mutation.isPending}
          className="btn-primary px-10 bg-accent-green/80 hover:bg-accent-green text-surface-0"
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Starting render...</>
          ) : (
            <><Rocket className="w-4 h-4" /> Generate Video</>
          )}
        </button>
      </div>
    </div>
  );
}
