'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, ArrowRight, Clapperboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { cn } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
});

type Form = z.infer<typeof schema>;

export default function StepDetails() {
  const { setProject, nextStep, markStepComplete } = useWizardStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const titleValue = watch('title', '');

  const mutation = useMutation({
    mutationFn: (data: Form) =>
      projectsApi.create({ title: data.title, description: data.description }),
    onSuccess: (project) => {
      setProject(project);
      markStepComplete('details');
      nextStep();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create project');
    },
  });

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/15 flex items-center justify-center mb-4">
          <Clapperboard className="w-6 h-6 text-brand-400" />
        </div>
        <h2 className="text-2xl font-bold">Project Details</h2>
        <p className="text-slate-400 mt-1">Give your educational video a title and description.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Project Title <span className="text-rose-400">*</span>
          </label>
          <input
            {...register('title')}
            className={cn('input-field text-lg', errors.title && 'border-rose-500/50')}
            placeholder="e.g. Introduction to Quantum Physics"
          />
          <div className="flex justify-between items-center mt-1.5">
            {errors.title ? (
              <p className="text-rose-400 text-xs">{errors.title.message}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-500">{titleValue.length}/200</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className={cn('textarea-field', errors.description && 'border-rose-500/50')}
            placeholder="Brief description of what this video covers..."
          />
          {errors.description && (
            <p className="text-rose-400 text-xs mt-1.5">{errors.description.message}</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary px-8"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
