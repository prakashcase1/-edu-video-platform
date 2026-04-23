'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, Layers, Image as ImageIcon, Loader2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { scriptsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { cn, formatDuration } from '@/lib/utils';
import type { Scene, Slide } from '@/types';

export default function StepMapping() {
  const { project, nextStep, prevStep, markStepComplete } = useWizardStore();
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mappings', project?.id],
    queryFn: () => scriptsApi.getMappings(project!.id),
    enabled: !!project?.id,
  });

  const mapMutation = useMutation({
    mutationFn: ({ sceneId, slideId }: { sceneId: string; slideId: string | null }) =>
      scriptsApi.mapSceneToSlide(project!.id, sceneId, slideId),
    onSuccess: (_, { sceneId, slideId }) => {
      setMappings((prev) => ({ ...prev, [sceneId]: slideId || '' }));
      toast.success('Mapping updated');
      refetch();
    },
    onError: () => toast.error('Failed to update mapping'),
  });

  useEffect(() => {
    if (data?.scenes) {
      const initial: Record<string, string> = {};
      data.scenes.forEach((s) => {
        const slide = data.slides.find((sl) => sl.sceneId === s.id);
        if (slide) initial[s.id] = slide.id;
      });
      setMappings(initial);
    }
  }, [data]);

  const scenes = data?.scenes || [];
  const slides = data?.slides || [];

  const handleMapSlide = (sceneId: string, slideId: string) => {
    mapMutation.mutate({ sceneId, slideId: slideId || null });
    setSelectedScene(null);
  };

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/15 flex items-center justify-center mb-4">
          <Layers className="w-6 h-6 text-brand-400" />
        </div>
        <h2 className="text-2xl font-bold">Scene-Slide Mapping</h2>
        <p className="text-slate-400 mt-1">
          Map each script scene to the slide it should display. AI has auto-assigned them — adjust as needed.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-100 rounded-xl shimmer animate-pulse" />
          ))}
        </div>
      ) : scenes.length === 0 ? (
        <div className="card text-center py-10 text-slate-400">
          No scenes found. Please go back and parse your script first.
        </div>
      ) : (
        <div className="space-y-3 mb-6 max-h-[480px] overflow-y-auto pr-1">
          {scenes.map((scene, i) => {
            const mappedSlideId = mappings[scene.id];
            const mappedSlide = slides.find((s) => s.id === mappedSlideId);
            const isExpanded = selectedScene === scene.id;

            return (
              <div key={scene.id} className="card p-4">
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setSelectedScene(isExpanded ? null : scene.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-600/15 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 line-clamp-2">{scene.scriptText}</p>
                    {scene.duration && (
                      <span className="text-xs text-slate-500 mt-1">~{formatDuration(scene.duration)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {mappedSlide ? (
                      <div className="flex items-center gap-2 text-xs text-accent-green">
                        <div className="w-6 h-6 bg-surface-200 rounded overflow-hidden">
                          {mappedSlide.url && (
                            <img src={mappedSlide.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        Slide {mappedSlide.order}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No slide</span>
                    )}
                    <ChevronRight
                      className={cn('w-4 h-4 text-slate-500 transition-transform', isExpanded && 'rotate-90')}
                    />
                  </div>
                </div>

                {/* Slide picker */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-slate-400 mb-2">Pick a slide for this scene:</p>
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                      <button
                        onClick={() => handleMapSlide(scene.id, '')}
                        className={cn(
                          'aspect-video rounded-lg border-2 transition-all flex items-center justify-center text-xs',
                          !mappedSlideId
                            ? 'border-brand-500 bg-brand-600/15 text-brand-400'
                            : 'border-white/[0.06] bg-surface-200 text-slate-500 hover:border-white/20',
                        )}
                      >
                        None
                      </button>
                      {slides.map((slide) => (
                        <button
                          key={slide.id}
                          onClick={() => handleMapSlide(scene.id, slide.id)}
                          className={cn(
                            'aspect-video rounded-lg border-2 overflow-hidden transition-all relative',
                            mappedSlideId === slide.id
                              ? 'border-brand-500 ring-1 ring-brand-500/50'
                              : 'border-white/[0.06] hover:border-white/20',
                          )}
                        >
                          {slide.url ? (
                            <img src={slide.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-surface-200 flex items-center justify-center">
                              <ImageIcon className="w-3 h-3 text-slate-600" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center py-0.5">
                            {slide.order}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => { markStepComplete('mapping'); nextStep(); }}
          className="btn-primary px-8"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
