'use client';

import { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowRight, ArrowLeft, Upload, Image as ImageIcon,
  X, Loader2, GripVertical, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { cn } from '@/lib/utils';
import type { Slide } from '@/types';

export default function StepSlides() {
  const { project, slides, setSlides, selectedMode, nextStep, prevStep, markStepComplete } = useWizardStore();

  // Init from project slides
  useEffect(() => {
    if (project?.slides && slides.length === 0) {
      setSlides(project.slides);
    }
  }, [project?.slides, slides.length, setSlides]);

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => projectsApi.uploadSlides(project!.id, files),
    onSuccess: (newSlides) => {
      setSlides([...slides, ...newSlides]);
      toast.success(`${newSlides.length} slide(s) uploaded`);
    },
    onError: () => toast.error('Upload failed. Please check file formats.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (slideId: string) => projectsApi.deleteSlide(project!.id, slideId),
    onSuccess: (_, slideId) => {
      setSlides(slides.filter((s) => s.id !== slideId));
      toast.success('Slide removed');
    },
    onError: () => toast.error('Failed to remove slide'),
  });

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;
      uploadMutation.mutate(accepted);
    },
    [slides],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
    },
    maxFiles: 50,
    maxSize: 50 * 1024 * 1024, // increased to 50MB for pptx
  });

  const handleContinue = () => {
    markStepComplete('slides');
    nextStep();
  };

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/15 flex items-center justify-center mb-4">
          <ImageIcon className="w-6 h-6 text-brand-400" />
        </div>
        <h2 className="text-2xl font-bold">Upload Slides</h2>
        <p className="text-slate-400 mt-1">
          {selectedMode === 'NO_FACE'
            ? 'Upload slides that will be shown alongside the narration.'
            : 'Slides will appear as the background behind your avatar presenter.'}
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer mb-6',
          isDragActive
            ? 'border-brand-500 bg-brand-600/10'
            : 'border-white/10 hover:border-brand-500/40 hover:bg-brand-600/5',
        )}
      >
        <input {...getInputProps()} />
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
            <p className="text-slate-400">Uploading slides...</p>
          </div>
        ) : (
          <>
            <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragActive ? 'text-brand-400' : 'text-slate-500')} />
            <p className="font-medium mb-1">
              {isDragActive ? 'Drop slides here' : 'Drag & drop slides'}
            </p>
            <p className="text-sm text-slate-400">
              or <span className="text-brand-400 hover:underline">browse files</span> — PNG, JPG, WebP, up to 10MB each
            </p>
          </>
        )}
      </div>

      {selectedMode === 'NO_FACE' && slides.length === 0 && (
        <div className="card bg-amber-400/5 border border-amber-400/15 mb-6 flex gap-3 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-slate-300">
            <strong className="text-amber-400">No-Face mode requires slides.</strong> Please upload at least one slide image, or switch to Avatar mode.
          </p>
        </div>
      )}

      {/* Slides grid */}
      {slides.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">{slides.length} slide(s)</h3>
            <span className="text-xs text-slate-500">Drag to reorder (coming soon)</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {slides
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((slide) => (
                <SlideThumb
                  key={slide.id}
                  slide={slide}
                  onDelete={() => deleteMutation.mutate(slide.id)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleContinue}
          disabled={selectedMode === 'NO_FACE' && slides.length === 0}
          className="btn-primary px-8"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SlideThumb({ slide, onDelete, isDeleting }: { slide: Slide; onDelete: () => void; isDeleting: boolean }) {
  return (
    <div className="relative group aspect-video bg-surface-200 rounded-lg overflow-hidden border border-white/[0.06]">
      {slide.url ? (
        <img src={slide.url} alt={slide.filename} className="w-full h-full object-cover" />
      ) : (
        <div className="flex items-center justify-center h-full">
          <ImageIcon className="w-5 h-5 text-slate-600" />
        </div>
      )}
      <div className="absolute top-1 left-1 w-4 h-4 rounded bg-black/60 flex items-center justify-center text-[9px] text-white font-bold">
        {slide.order}
      </div>
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="absolute top-1 right-1 w-5 h-5 rounded bg-rose-600/80 items-center justify-center hidden group-hover:flex hover:bg-rose-600"
      >
        {isDeleting ? (
          <Loader2 className="w-3 h-3 animate-spin text-white" />
        ) : (
          <X className="w-3 h-3 text-white" />
        )}
      </button>
    </div>
  );
}
