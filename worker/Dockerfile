FROM node:20-alpine AS base
# Install FFmpeg and build dependencies
RUN apk add --no-cache ffmpeg python3 make g++ curl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Copy prisma schema from backend for shared database access
COPY ../backend/prisma ./prisma
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
ENV FFMPEG_PATH=ffmpeg

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

RUN mkdir -p /app/uploads /tmp/edu-video

EXPOSE 0
CMD ["node", "dist/index.js"]
