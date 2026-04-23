import { create } from 'zustand';
import type { WizardStep, VideoMode, Project, Scene, Slide } from '@/types';

interface WizardStore {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  project: Project | null;
  scriptContent: string;
  scenes: Scene[];
  slides: Slide[];
  selectedMode: VideoMode;
  selectedAvatarId: string | null;
  selectedVoiceId: string | null;
  voiceSpeed: number;
  voicePitch: number;
  voiceLanguage: string;
  isLoading: boolean;

  setStep: (step: WizardStep) => void;
  markStepComplete: (step: WizardStep) => void;
  setProject: (project: Project) => void;
  setScriptContent: (content: string) => void;
  setScenes: (scenes: Scene[]) => void;
  setSlides: (slides: Slide[]) => void;
  setMode: (mode: VideoMode) => void;
  setAvatarId: (id: string) => void;
  setVoiceId: (id: string) => void;
  setVoiceSpeed: (speed: number) => void;
  setVoicePitch: (pitch: number) => void;
  setVoiceLanguage: (lang: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const STEP_ORDER: WizardStep[] = [
  'details',
  'mode',
  'script',
  'slides',
  'mapping',
  'avatar',
  'voice',
  'review',
];

const initialState = {
  currentStep: 'details' as WizardStep,
  completedSteps: new Set<WizardStep>(),
  project: null,
  scriptContent: '',
  scenes: [],
  slides: [],
  selectedMode: 'NO_FACE' as VideoMode,
  selectedAvatarId: null,
  selectedVoiceId: null,
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  voiceLanguage: 'en',
  isLoading: false,
};

export const useWizardStore = create<WizardStore>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  markStepComplete: (step) =>
    set((state) => ({
      completedSteps: new Set([...state.completedSteps, step]),
    })),

  setProject: (project) => set({ project }),

  setScriptContent: (content) => set({ scriptContent: content }),

  setScenes: (scenes) => set({ scenes }),

  setSlides: (slides) => set({ slides }),

  setMode: (mode) => set({ selectedMode: mode }),

  setAvatarId: (id) => set({ selectedAvatarId: id }),

  setVoiceId: (id) => set({ selectedVoiceId: id }),

  setVoiceSpeed: (speed) => set({ voiceSpeed: speed }),

  setVoicePitch: (pitch) => set({ voicePitch: pitch }),

  setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set({ ...initialState, completedSteps: new Set() }),

  nextStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      set((state) => ({
        currentStep: STEP_ORDER[currentIndex + 1],
        completedSteps: new Set([...state.completedSteps, currentStep]),
      }));
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: STEP_ORDER[currentIndex - 1] });
    }
  },
}));

export { STEP_ORDER };
