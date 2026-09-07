FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core fonts-noto-color-emoji ca-certificates python3 python3-venv && rm -rf /var/lib/apt/lists/*
# Pinned public-video importer; default extras include the matching JS extractor.
# Uses the existing Node 22 runtime and never updates itself at application startup.
RUN python3 -m venv /opt/yt-dlp && /opt/yt-dlp/bin/pip install --no-cache-dir --disable-pip-version-check 'yt-dlp[default]==2026.8.19'
ENV YT_DLP_PATH=/opt/yt-dlp/bin/yt-dlp
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
