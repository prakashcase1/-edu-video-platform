export const appConfig = () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
    type: 'mysql',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET || 'edu-video-platform',
    endpoint: process.env.AWS_ENDPOINT || undefined,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    baseUrl: 'https://api.elevenlabs.io/v1',
  },

  did: {
    apiKey: process.env.DID_API_KEY,
    baseUrl: 'https://api.d-id.com',
  },

  ffmpeg: {
    path: process.env.FFMPEG_PATH || 'ffmpeg',
    tempDir: process.env.FFMPEG_TEMP_DIR || '/tmp/edu-video',
  },

  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localPath: process.env.LOCAL_STORAGE_PATH || './uploads',
    baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3001',
  },
});
