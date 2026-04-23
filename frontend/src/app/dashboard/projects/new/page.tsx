'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWizardStore, STEP_ORDER } from '@/store/wizard.store';
import type { WizardStep } from '@/types';

// Step components
import StepDetails from '@/components/wizard/StepDetails';
import StepMode from '@/components/wizard/StepMode';
import StepScript from '@/components/wizard/StepScript';
import StepSlides from '@/components/wizard/StepSlides';
import StepMapping from '@/components/wizard/StepMapping';
import StepAvatar from '@/components/wizard/StepAvatar';
import StepVoice from '@/components/wizard/StepVoice';
import StepReview from '@/components/wizard/StepReview';

import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronRight } from 'lucide-react';

const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Details',
  mode: 'Mode',
  script: 'Script',
  slides: 'Slides',
  mapping: 'Mapping',
  avatar: 'Avatar',
  voice: 'Voice',
  review: 'Review',
};

const STEP_COMPONENTS: Record<WizardStep, React.ComponentType> = {
  details: StepDetails,
  mode: StepMode,
  script: StepScript,
  slides: StepSlides,
  mapping: StepMapping,
  avatar: StepAvatar,
  voice: StepVoice,
  review: StepReview,
};

export default function NewProjectPage() {
  const router = useRouter();
  const { currentStep, completedSteps, project, setStep, reset, selectedMode } = useWizardStore();

  useEffect(() => {
    reset();
  }, []);

  const StepComponent = STEP_COMPONENTS[currentStep];
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  // Filter out avatar step if no-face mode
  const visibleSteps = STEP_ORDER.filter((s) => {
    if (s === 'avatar' && selectedMode === 'NO_FACE') return false;
    return true;
  });

  return (
    <div className="min-h-full bg-surface-0">
      {/* Progress header */}
      <div className="border-b border-white/[0.06] bg-surface-50/50 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {visibleSteps.map((step, i) => {
              const isActive = step === currentStep;
              const isDone = completedSteps.has(step);
              const isReachable = isDone || step === currentStep || i <= currentIndex;

              return (
                <div key={step} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mx-0.5" />
                  )}
                  <button
                    onClick={() => isReachable && setStep(step)}
                    disabled={!isReachable}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                        : isDone
                        ? 'text-accent-green hover:bg-white/[0.04] cursor-pointer'
                        : 'text-slate-500 cursor-default',
                    )}
                  >
                    {isDone && !isActive ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <span className={cn(
                        'w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold border',
                        isActive ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-600 text-slate-500',
                      )}>
                        {visibleSteps.indexOf(step) + 1}
                      </span>
                    )}
                    {STEP_LABELS[step]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
