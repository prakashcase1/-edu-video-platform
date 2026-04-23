'use client';

import { useMutation } from '@tanstack/react-query';
import { MonitorPlay, Users, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { cn } from '@/lib/utils';
import type { VideoMode } from '@/types';

const modes: { id: VideoMode; icon: React.ElementType; label: string; desc: string; color: string; bg: string; features: string[] }[] = [
  {
    id: 'NO_FACE',
    icon: MonitorPlay,
    label: 'No-Face Mode',
    desc: 'Slides + AI narration — no presenter visible.',
    color: 'text-brand-400',
    bg: 'bg-brand-600/10 border-brand-500/30',
    features: ['Upload slides (PNG/JPG)', 'AI voice narration', 'Auto slide-audio sync', 'Clean professional look'],
  },
  {
    id: 'AVATAR',
    icon: Users,
    label: 'Avatar Presenter',
    desc: 'AI avatar presents your content on screen.',
    color: 'text-accent-violet',
    bg: 'bg-accent-violet/10 border-accent-violet/30',
    features: ['Choose from 6 avatars', 'Slides as background', 'Lifelike expressions', 'Engaging for learners'],
  },
];

export default function StepMode() {
  const { project, selectedMode, setMode, setProject, nextStep, prevStep, markStepComplete } = useWizardStore();

  const mutation = useMutation({
    mutationFn: (mode: VideoMode) =>
      projectsApi.update(project!.id, { mode }),
    onSuccess: (updatedProject) => {
      setProject(updatedProject);
      markStepComplete('mode');
      nextStep();
    },
    onError: () => toast.error('Failed to update project mode'),
  });

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Choose Video Mode</h2>
        <p className="text-slate-400 mt-1">How do you want to present your content?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={cn(
              'text-left p-5 rounded-2xl border-2 transition-all duration-200',
              selectedMode === mode.id
                ? `${mode.bg} border-opacity-100`
                : 'border-white/[0.06] bg-surface-100 hover:bg-surface-200',
            )}
          >
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
              selectedMode === mode.id ? mode.bg.split(' ')[0] : 'bg-surface-200',
            )}>
              <mode.icon className={cn('w-6 h-6', selectedMode === mode.id ? mode.color : 'text-slate-400')} />
            </div>
            <h3 className="font-semibold text-base mb-1">{mode.label}</h3>
            <p className="text-sm text-slate-400 mb-4">{mode.desc}</p>
            <ul className="space-y-1.5">
              {mode.features.map((f) => (
                <li key={f} className="text-xs text-slate-400 flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', selectedMode === mode.id ? mode.color.replace('text-', 'bg-') : 'bg-slate-600')} />
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => mutation.mutate(selectedMode)}
          disabled={mutation.isPending}
          className="btn-primary px-8"
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
