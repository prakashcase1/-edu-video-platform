FROM node:20-alpine AS base
RUN apk add --no-cache ffmpeg python3 make g++
WORKDIR /app

# ─── Dependencies ────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# ─── Builder ─────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production ──────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Create uploads dir
RUN mkdir -p /app/uploads /tmp/edu-video

# Run migrations then start
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
