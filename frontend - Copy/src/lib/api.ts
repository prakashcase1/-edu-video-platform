import apiClient from './api-client';
import type {
  Project,
  Script,
  Slide,
  Scene,
  Rendering,
  Voice,
  Avatar,
  AvatarConfig,
  VoiceConfig,
  PaginatedResponse,
  User,
} from '@/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (data: { name: string; email: string; password: string }) => {
    const res = await apiClient.post('/auth/register', data);
    return res.data.data;
  },
  login: async (data: { email: string; password: string }) => {
    const res = await apiClient.post('/auth/login', data);
    return res.data.data;
  },
  logout: async (refreshToken: string) => {
    const res = await apiClient.post('/auth/logout', { refreshToken });
    return res.data.data;
  },
  getProfile: async (): Promise<User> => {
    const res = await apiClient.get('/auth/profile');
    return res.data.data;
  },
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectsApi = {
  create: async (data: { title: string; description?: string; mode?: string }): Promise<Project> => {
    const res = await apiClient.post('/projects', data);
    return res.data.data;
  },
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedResponse<Project>> => {
    const res = await apiClient.get('/projects', { params });
    return res.data.data;
  },
  get: async (id: string): Promise<Project> => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data.data;
  },
  update: async (id: string, data: Partial<Project>): Promise<Project> => {
    const res = await apiClient.patch(`/projects/${id}`, data);
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
  setAvatarConfig: async (id: string, data: Omit<AvatarConfig, 'id' | 'projectId'>): Promise<AvatarConfig> => {
    const res = await apiClient.post(`/projects/${id}/avatar-config`, data);
    return res.data.data;
  },
  setVoiceConfig: async (
    id: string,
    data: Omit<VoiceConfig, 'id' | 'projectId'>,
  ): Promise<VoiceConfig> => {
    const res = await apiClient.post(`/projects/${id}/voice-config`, data);
    return res.data.data;
  },
  uploadSlides: async (id: string, files: File[]): Promise<Slide[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('slides', f));
    const res = await apiClient.post(`/projects/${id}/slides`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  reorderSlides: async (id: string, slideOrder: { id: string; order: number }[]): Promise<Slide[]> => {
    const res = await apiClient.put(`/projects/${id}/slides/reorder`, { slideOrder });
    return res.data.data;
  },
  deleteSlide: async (projectId: string, slideId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/slides/${slideId}`);
  },
  generateShareLink: async (id: string): Promise<{ shareToken: string; shareUrl: string }> => {
    const res = await apiClient.post(`/projects/${id}/share`);
    return res.data.data;
  },
  getShared: async (token: string): Promise<Project> => {
    const res = await apiClient.get(`/projects/share/${token}`);
    return res.data.data;
  },
};

// ─── Scripts ─────────────────────────────────────────────────────────────────

export const scriptsApi = {
  save: async (projectId: string, content: string): Promise<Script> => {
    const res = await apiClient.put(`/projects/${projectId}/scripts`, { content });
    return res.data.data;
  },
  get: async (projectId: string): Promise<Script> => {
    const res = await apiClient.get(`/projects/${projectId}/scripts`);
    return res.data.data;
  },
  parse: async (projectId: string): Promise<{ scenes: Scene[]; totalScenes: number }> => {
    const res = await apiClient.post(`/projects/${projectId}/scripts/parse`);
    return res.data.data;
  },
  getMappings: async (
    projectId: string,
  ): Promise<{ scenes: Scene[]; slides: Slide[] }> => {
    const res = await apiClient.get(`/projects/${projectId}/scripts/mappings`);
    return res.data.data;
  },
  mapSceneToSlide: async (
    projectId: string,
    sceneId: string,
    slideId: string | null,
  ): Promise<Scene> => {
    const res = await apiClient.put(`/projects/${projectId}/scripts/map-scene-slide`, {
      sceneId,
      slideId,
    });
    return res.data.data;
  },
};

// ─── Rendering ───────────────────────────────────────────────────────────────

export const renderingApi = {
  start: async (projectId: string): Promise<Rendering> => {
    const res = await apiClient.post(`/projects/${projectId}/render/start`);
    return res.data.data;
  },
  getStatus: async (projectId: string): Promise<Rendering | null> => {
    const res = await apiClient.get(`/projects/${projectId}/render/status`);
    return res.data.data;
  },
  getHistory: async (projectId: string): Promise<Rendering[]> => {
    const res = await apiClient.get(`/projects/${projectId}/render/history`);
    return res.data.data;
  },
  cancel: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/render/cancel`);
  },
};

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiApi = {
  listVoices: async (): Promise<Voice[]> => {
    const res = await apiClient.get('/ai/voices');
    return res.data.data;
  },
  listAvatars: async (): Promise<Avatar[]> => {
    const res = await apiClient.get('/ai/avatars');
    return res.data.data;
  },
};
