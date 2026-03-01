FROM node:22-slim AS base
# Install Arabic/Noto fonts for Sharp SVG text rendering (OG images)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-core fonts-noto-extra \
    fontconfig ca-certificates \
    && fc-cache -fv \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS build
ARG RAILWAY_GIT_COMMIT_SHA
ENV RAILWAY_GIT_COMMIT_SHA=${RAILWAY_GIT_COMMIT_SHA}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle.config.ts ./

# Create uploads directory for local file storage
RUN mkdir -p /app/uploads && chmod 777 /app/uploads
ENV UPLOAD_DIR=/app/uploads

# Copy start script and column fix utility
COPY --from=build /app/start.sh ./
COPY --from=build /app/fix-columns.mjs ./
RUN chmod +x start.sh

EXPOSE ${PORT:-3000}
CMD ["./start.sh"]
