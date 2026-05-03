FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    ffmpeg \
    fontconfig \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    locales \
  && sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
  && sed -i -e 's/# zh_CN.UTF-8 UTF-8/zh_CN.UTF-8 UTF-8/' /etc/locale.gen \
  && locale-gen \
  && fc-cache -fv \
  && rm -rf /var/lib/apt/lists/*

ENV LANG=zh_CN.UTF-8 \
    LANGUAGE=zh_CN:en \
    LC_ALL=zh_CN.UTF-8 \
    CHROMIUM_BIN=/usr/bin/chromium \
    FFMPEG_BIN=/usr/bin/ffmpeg \
    EXPORT_WORK_ROOT=/tmp/spectral-renders

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spectral/render-runtime-browser build:offline

CMD ["pnpm", "--filter", "@spectral/render-worker", "start"]
