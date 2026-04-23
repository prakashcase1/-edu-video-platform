export type VideoMode = 'NO_FACE' | 'AVATAR';
export type ProjectStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type RenderingStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  _count?: { projects: number };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  mode: VideoMode;
  status: ProjectStatus;
  userId: string;
  script?: Script;
  slides: Slide[];
  scenes: Scene[];
  avatar?: AvatarConfig;
  voiceConfig?: VoiceConfig;
  renderings: Rendering[];
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { slides: number; scenes: number };
}

export interface Script {
  id: string;
  content: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Slide {
  id: string;
  filename: string;
  storageKey: string;
  url?: string;
  order: number;
  projectId: string;
  sceneId?: string;
  createdAt: string;
}

export interface Scene {
  id: string;
  order: number;
  scriptText: string;
  duration?: number;
  audioKey?: string;
  audioUrl?: string;
  projectId: string;
  slides?: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface AvatarConfig {
  id: string;
  avatarId: string;
  avatarName: string;
  previewUrl?: string;
  projectId: string;
}

export interface VoiceConfig {
  id: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  pitch: number;
  language: string;
  projectId: string;
}

export interface Rendering {
  id: string;
  jobId?: string;
  status: RenderingStatus;
  progress: number;
  videoKey?: string;
  videoUrl?: string;
  duration?: number;
  fileSize?: number;
  errorMessage?: string;
  projectId: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  queueStatus?: {
    state: string;
    progress: number;
  };
}

export interface Voice {
  id: string;
  name: string;
  language?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface Avatar {
  id: string;
  name: string;
  gender: string;
  ethnicity: string;
  previewUrl: string;
}

export interface PaginatedResponse<T> {
  projects: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export type WizardStep =
  | 'details'
  | 'mode'
  | 'script'
  | 'slides'
  | 'mapping'
  | 'avatar'
  | 'voice'
  | 'review';
