'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, Loader2, FileText, Sparkles, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { scriptsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { estimateScriptDuration, formatDuration } from '@/lib/utils';

export default function StepScript() {
  const { project, scriptContent, setScriptContent, setScenes, nextStep, prevStep, markStepComplete } = useWizardStore();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (project?.script?.content) {
      setScriptContent(project.script.content);
    }
  }, [project]);

  const saveMutation = useMutation({
    mutationFn: () => scriptsApi.save(project!.id, scriptContent),
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: () => {
      toast.error('Failed to save script');
      setIsSaving(false);
    },
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      await scriptsApi.save(project!.id, scriptContent);
      return scriptsApi.parse(project!.id);
    },
    onSuccess: (data) => {
      setScenes(data.scenes);
      markStepComplete('script');
      toast.success(`Script split into ${data.totalScenes} scenes`);
      nextStep();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to parse script');
    },
  });

  const wordCount = scriptContent.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDuration = estimateScriptDuration(scriptContent);
  const sceneEstimate = Math.max(1, Math.ceil(wordCount / 80));

  const handleAutoSave = () => {
    if (scriptContent.length > 20) {
      setIsSaving(true);
      saveMutation.mutate();
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/15 flex items-center justify-center mb-4">
          <FileText className="w-6 h-6 text-brand-400" />
        </div>
        <h2 className="text-2xl font-bold">Write Your Script</h2>
        <p className="text-slate-400 mt-1">
          Type or paste the narration script for your video. Our AI will split it into scenes.
        </p>
      </div>

      <div className="relative mb-3">
        <textarea
          value={scriptContent}
          onChange={(e) => setScriptContent(e.target.value)}
          onBlur={handleAutoSave}
          rows={16}
          className="textarea-field font-mono text-sm leading-relaxed"
          placeholder={`Write your script here...

Example:
Welcome to our lesson on photosynthesis. Today we'll explore how plants convert sunlight into energy.

Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to produce oxygen and energy in the form of sugar.

The process takes place in the chloroplasts, which contain a green pigment called chlorophyll...`}
        />
        {(isSaving || saveMutation.isPending) && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-5 text-xs text-slate-500 mb-6 px-1">
        <span>{wordCount} words</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> ~{formatDuration(estimatedDuration)}
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> ~{sceneEstimate} scenes
        </span>
        {lastSaved && (
          <span className="ml-auto text-accent-green/60">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="card bg-brand-600/5 border border-brand-500/10 mb-6 text-sm text-slate-400">
        <p className="flex gap-2">
          <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-white">AI Scene Parsing:</strong> Click "Continue" and our AI will automatically split your script into scenes, each mapped to a slide. You can adjust the mapping on the next step.
          </span>
        </p>
      </div>

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => parseMutation.mutate()}
          disabled={scriptContent.trim().length < 20 || parseMutation.isPending}
          className="btn-primary px-8"
        >
          {parseMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Parsing with AI...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
