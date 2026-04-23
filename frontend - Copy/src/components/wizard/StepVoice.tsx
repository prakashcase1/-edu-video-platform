'use client';

import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, Mic, Volume2, Loader2, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, projectsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { cn } from '@/lib/utils';

// Avatar gender map — mirrors listAvatars() in ai.service.ts
const AVATAR_GENDER: Record<string, string> = {
  avatar_alex:     'male',
  avatar_sophia:   'female',
  avatar_marcus:   'male',
  avatar_isabella: 'female',
  avatar_chen:     'male',
  avatar_amara:    'female',
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ar', label: 'Arabic' },
];

export default function StepVoice() {
  const {
    project, selectedVoiceId, voiceSpeed, voicePitch, voiceLanguage,
    selectedAvatarId,
    setVoiceId, setVoiceSpeed, setVoicePitch, setVoiceLanguage,
    nextStep, prevStep, markStepComplete,
  } = useWizardStore();

  const { data: voices = [], isLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: () => aiApi.listVoices(),
  });

  // Auto-select a voice matching the chosen avatar's gender when voices load.
  // Skipped if the user already picked a voice manually.
  useEffect(() => {
    if (!voices.length || selectedVoiceId) return;

    const avatarGender = selectedAvatarId
      ? AVATAR_GENDER[selectedAvatarId] || 'neutral'
      : 'neutral';

    const match = voices.find((v: any) => v.gender === avatarGender) || voices[0];

    if (match) {
      setVoiceId(match.id);
      toast.success(
        `Auto-selected ${match.name} to match your ${avatarGender} avatar`,
        { icon: '🎙️', duration: 3000 },
      );
    }
  }, [voices, selectedAvatarId]);

  const mutation = useMutation({
    mutationFn: () => {
      const voice = voices.find((v: any) => v.id === selectedVoiceId) || voices[0];
      if (!voice) throw new Error('No voice available');
      return projectsApi.setVoiceConfig(project!.id, {
        voiceId: voice.id,
        voiceName: voice.name,
        speed: voiceSpeed,
        pitch: voicePitch,
        language: voiceLanguage,
      });
    },
    onSuccess: () => {
      markStepComplete('voice');
      nextStep();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err.message || 'Failed to save voice'),
  });

  const avatarGender = selectedAvatarId ? AVATAR_GENDER[selectedAvatarId] : null;

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 flex items-center justify-center mb-4">
          <Mic className="w-6 h-6 text-accent-cyan" />
        </div>
        <h2 className="text-2xl font-bold">Voice Configuration</h2>
        <p className="text-slate-400 mt-1">Choose the voice and settings for your AI narrator.</p>
      </div>

      {/* Avatar gender hint banner */}
      {avatarGender && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-accent-cyan/5 border border-accent-cyan/15 text-sm text-slate-300">
          🎭 Your avatar is <span className="text-white font-medium capitalize">{avatarGender}</span> —
          {' '}voices below are sorted to show matching voices first.
        </div>
      )}

      {/* Language */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">Language</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setVoiceLanguage(lang.code)}
              className={cn(
                'py-2 px-3 rounded-xl text-xs font-medium border transition-all',
                voiceLanguage === lang.code
                  ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
                  : 'border-white/[0.06] text-slate-400 hover:text-white hover:border-white/20',
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Voice selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">Voice</label>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-surface-200 rounded-xl shimmer animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {[...voices]
              .sort((a: any, b: any) => {
                if (!avatarGender) return 0;
                const aMatch = a.gender === avatarGender ? -1 : 0;
                const bMatch = b.gender === avatarGender ? -1 : 0;
                return aMatch - bMatch;
              })
              .map((voice: any) => {
                const selected =
                  selectedVoiceId === voice.id ||
                  (!selectedVoiceId && voices[0]?.id === voice.id);
                const genderMatch = avatarGender && voice.gender === avatarGender;

                return (
                  <button
                    key={voice.id}
                    onClick={() => setVoiceId(voice.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      selected
                        ? 'border-accent-cyan/40 bg-accent-cyan/5 text-white'
                        : 'border-white/[0.06] hover:border-white/15 text-slate-400',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      selected ? 'bg-accent-cyan/15' : 'bg-surface-200',
                    )}>
                      <Volume2 className={cn('w-4 h-4', selected ? 'text-accent-cyan' : 'text-slate-500')} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{voice.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {voice.gender && voice.gender !== 'neutral' && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            voice.gender === 'female'
                              ? 'bg-pink-500/15 text-pink-300'
                              : 'bg-blue-500/15 text-blue-300',
                          )}>
                            {voice.gender === 'female' ? '♀' : '♂'} {voice.gender}
                          </span>
                        )}
                        {genderMatch && (
                          <span className="text-[10px] text-accent-cyan">✓ matches avatar</span>
                        )}
                      </div>
                    </div>

                    {voice.preview_url && (
                      <a
                        href={voice.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-500 hover:text-white p-1"
                      >
                        <Play className="w-3 h-3" />
                      </a>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Speed + Pitch */}
      <div className="grid sm:grid-cols-2 gap-5 mb-8">
        <div>
          <label className="flex items-center justify-between text-sm font-medium text-slate-300 mb-3">
            <span>Speech Speed</span>
            <span className="text-accent-cyan font-mono text-xs">{voiceSpeed.toFixed(1)}x</span>
          </label>
          <input
            type="range" min="0.5" max="2.0" step="0.1"
            value={voiceSpeed}
            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
            className="w-full accent-accent-cyan"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Slow</span><span>Fast</span>
          </div>
        </div>
        <div>
          <label className="flex items-center justify-between text-sm font-medium text-slate-300 mb-3">
            <span>Pitch</span>
            <span className="text-accent-violet font-mono text-xs">{voicePitch.toFixed(1)}x</span>
          </label>
          <input
            type="range" min="0.5" max="2.0" step="0.1"
            value={voicePitch}
            onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
            className="w-full accent-accent-violet"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Lower</span><span>Higher</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || voices.length === 0}
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
