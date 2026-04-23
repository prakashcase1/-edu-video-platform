'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '@/lib/api';
import { useWizardStore } from '@/store/wizard.store';
import { cn } from '@/lib/utils';

// ─── Cartoon avatar config ────────────────────────────────────────────────────
// Each avatar gets a unique skin tone, hair color, and hair style.
// These are rendered as inline SVG — no external images needed for the UI.
// The Unsplash photo URLs are still stored in the DB and used by the pipeline
// (D-ID needs a real face photo to animate; that hasn't changed).
type HairStyle = 'short' | 'long' | 'bun' | 'natural' | 'straight';

interface AvatarVisual {
  skinTone: string;
  hairColor: string;
  hairStyle: HairStyle;
  accentColor: string; // ring color behind the face circle
}

const AVATAR_VISUALS: Record<string, AvatarVisual> = {
  avatar_alex:     { skinTone: '#f5c5a3', hairColor: '#6b3a1f', hairStyle: 'short',    accentColor: '#3b5bdb' },
  avatar_sophia:   { skinTone: '#f5c5a3', hairColor: '#1a1a1a', hairStyle: 'bun',      accentColor: '#e64980' },
  avatar_marcus:   { skinTone: '#8d5524', hairColor: '#0d0500', hairStyle: 'short',    accentColor: '#0ca678' },
  avatar_isabella: { skinTone: '#c68642', hairColor: '#3d1c02', hairStyle: 'long',     accentColor: '#9c36b5' },
  avatar_chen:     { skinTone: '#e0b48a', hairColor: '#111111', hairStyle: 'straight', accentColor: '#1971c2' },
  avatar_amara:    { skinTone: '#6b3a1f', hairColor: '#0a0604', hairStyle: 'natural',  accentColor: '#e67700' },
};

// Unsplash photo URLs — still passed to the pipeline for D-ID rendering
const AVATAR_IMAGE_URLS: Record<string, string> = {
  avatar_alex:     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=533&fit=crop&crop=face',
  avatar_sophia:   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=533&fit=crop&crop=face',
  avatar_marcus:   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=533&fit=crop&crop=face',
  avatar_isabella: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=533&fit=crop&crop=face',
  avatar_chen:     'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=533&fit=crop&crop=face',
  avatar_amara:    'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=533&fit=crop&crop=face',
};

// ─── Hair shape variants ──────────────────────────────────────────────────────
function HairShape({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'short':
      return <ellipse cx="50" cy="33" rx="21" ry="13" fill={color} />;

    case 'bun':
      return (
        <>
          <ellipse cx="50" cy="34" rx="20" ry="12" fill={color} />
          <circle cx="50" cy="21" r="9" fill={color} />
        </>
      );

    case 'long':
      return (
        <>
          <ellipse cx="50" cy="34" rx="21" ry="13" fill={color} />
          <rect x="27" y="44" width="7" height="24" rx="3.5" fill={color} />
          <rect x="66" y="44" width="7" height="24" rx="3.5" fill={color} />
        </>
      );

    case 'straight':
      return (
        <>
          <ellipse cx="50" cy="34" rx="21" ry="13" fill={color} />
          <rect x="27" y="44" width="6" height="16" rx="3" fill={color} />
          <rect x="67" y="44" width="6" height="16" rx="3" fill={color} />
        </>
      );

    case 'natural':
      return (
        <>
          <ellipse cx="50" cy="31" rx="23" ry="16" fill={color} />
          <circle cx="32" cy="38" r="9" fill={color} />
          <circle cx="68" cy="38" r="9" fill={color} />
          <circle cx="50" cy="24" r="9" fill={color} />
        </>
      );
  }
}

// ─── Cartoon face SVG ─────────────────────────────────────────────────────────
function CartoonFace({ avatarId }: { avatarId: string }) {
  const v = AVATAR_VISUALS[avatarId];
  if (!v) return null;

  // Slightly darker tone for nose
  const noseTone = v.skinTone + 'cc';

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Accent ring */}
      <circle cx="50" cy="50" r="46" fill={v.accentColor} opacity="0.25" />
      <circle cx="50" cy="50" r="42" fill="#161b26" />

      {/* Face */}
      <circle cx="50" cy="57" r="25" fill={v.skinTone} />

      {/* Hair — rendered after face so it overlaps correctly */}
      <HairShape style={v.hairStyle} color={v.hairColor} />

      {/* Eyes */}
      <circle cx="42" cy="55" r="3.2" fill="#1a1a1a" />
      <circle cx="58" cy="55" r="3.2" fill="#1a1a1a" />
      {/* Eye shine */}
      <circle cx="43.4" cy="53.6" r="1.1" fill="white" />
      <circle cx="59.4" cy="53.6" r="1.1" fill="white" />

      {/* Nose */}
      <ellipse cx="50" cy="62" rx="2.5" ry="1.8" fill={noseTone} />

      {/* Mouth */}
      <path
        d="M 43 68 Q 50 74 57 68"
        stroke="#1a1a1a"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Avatar card ──────────────────────────────────────────────────────────────
function AvatarCard({
  avatar,
  selected,
  onClick,
}: {
  avatar: any;
  selected: boolean;
  onClick: () => void;
}) {
  const visual = AVATAR_VISUALS[avatar.id];
  const accentHex = visual?.accentColor || '#7c3aed';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200',
        'bg-[#161b26] hover:bg-[#1c2333]',
        selected
          ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
          : 'border-white/[0.06] hover:border-white/20',
      )}
      style={{
        // Inline CSS vars so each card's glow matches its avatar accent color
        '--accent': accentHex,
        '--accent-soft': accentHex + '33',
      } as React.CSSProperties}
    >
      {/* Face */}
      <div className="w-20 h-20">
        <CartoonFace avatarId={avatar.id} />
      </div>

      {/* Name */}
      <span
        className={cn(
          'text-sm font-semibold transition-colors',
          selected ? 'text-white' : 'text-slate-400',
        )}
        style={selected ? { color: accentHex } : undefined}
      >
        {avatar.name}
      </span>

      {/* Gender + ethnicity badge */}
      <span className="text-[10px] text-slate-500 capitalize">
        {avatar.gender} · {avatar.ethnicity}
      </span>
    </button>
  );
}

// ─── Main step ────────────────────────────────────────────────────────────────
export default function StepAvatar() {
  const {
    project,
    selectedAvatarId,
    setAvatarId,
    nextStep,
    prevStep,
    markStepComplete,
  } = useWizardStore();

  // Pull avatar list from the backend (same API as before)
  const { data: avatars = [], isLoading } = useQuery({
    queryKey: ['avatars'],
    queryFn: () =>
      // ai.service.ts listAvatars() returns gender + ethnicity — used for badges
      import('@/lib/api').then((m) => m.aiApi.listAvatars()),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const avatar = avatars.find((a: any) => a.id === selectedAvatarId);
      if (!avatar) throw new Error('Select an avatar first');
      return projectsApi.setAvatarConfig(project!.id, {
        avatarId: avatar.id,
        avatarName: avatar.name,
        // Pipeline still needs the real photo URL for D-ID
        previewUrl: AVATAR_IMAGE_URLS[avatar.id] || avatar.previewUrl,
      });
    },
    onSuccess: () => {
      markStepComplete('avatar');
      nextStep();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err.message || 'Failed to save avatar'),
  });

  return (
    <div>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent-violet/10 flex items-center justify-center mb-4">
          <Users className="w-6 h-6 text-accent-violet" />
        </div>
        <h2 className="text-2xl font-bold">Choose Your Avatar</h2>
        <p className="text-slate-400 mt-1">Select the AI avatar that will present your content.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-40 bg-[#161b26] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {avatars.map((avatar: any) => (
            <AvatarCard
              key={avatar.id}
              avatar={avatar}
              selected={selectedAvatarId === avatar.id}
              onClick={() => setAvatarId(avatar.id)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={prevStep} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!selectedAvatarId || mutation.isPending}
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
