import type { RenderLayer } from "@spectral/render-core";

import type { BrowserRenderAdapterRenderInput } from "../contracts/runtime";
import {
  buildParticleTextureConfigs,
  type ParticleTextureConfig,
} from "../particles/config";
import { clamp, normalizeAmplitude, toColorString } from "./canvas-utils";

type ParticleLayer = Extract<RenderLayer, { kind: "particles" }>;

type SidewaysParticle = {
  alpha: number;
  color: string | null | undefined;
  driftPhaseX: number;
  driftPhaseY: number;
  driftRangeX: number;
  driftRangeY: number;
  driftSpeedX: number;
  driftSpeedY: number;
  shape: string;
  size: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type TravelParticle = {
  alpha: number;
  color: string | null | undefined;
  maxVisualSize: number;
  shape: string;
  size: number;
  vx: number;
  vy: number;
  vz: number;
  wobblePhaseX: number;
  wobblePhaseY: number;
  wobbleRangeX: number;
  wobbleRangeY: number;
  wobbleSpeedX: number;
  wobbleSpeedY: number;
  x: number;
  y: number;
  z: number;
};

type ParticleStore = {
  carryByConfig: Record<string, number>;
  configKey: string | null;
  lastTimeMs: number | null;
  sideways: SidewaysParticle[];
  travel: TravelParticle[];
};

const BASE_HEIGHT = 500;
const STAR_TRAVEL_ORIGIN_Z = 100;
const STAR_TRAVEL_BASE_SIZE = 10;
const STAR_TRAVEL_BASE_MAX_VISUAL_SIZE = 60;
const STAR_TRAVEL_MIN_SPEED = 0.01;
const STAR_TRAVEL_MAX_SPEED = 0.1;
const STAR_TRAVEL_SPEED_UP_FACTOR = 600;
const STAR_TRAVEL_MIN_A = 0;
const STAR_TRAVEL_MAX_A = 0.1;
const STAR_TRAVEL_MIN_B = 20;
const STAR_TRAVEL_MAX_B = 100;

const SIDEWAYS_BASE_SIZE = 50;
const SIDEWAYS_MIN_SPEED = 0.3;
const SIDEWAYS_MAX_SPEED = 0.9;
const SIDEWAYS_SPEED_UP_FACTOR = 200;
const SIDEWAYS_MIN_A = 0;
const SIDEWAYS_MAX_A = 0.5;
const SIDEWAYS_MIN_B = 100;
const SIDEWAYS_MAX_B = 500;

function randomValue(min: number, max: number, signed = false) {
  const value = Math.random() * (max - min) + min;
  if (!signed) {
    return value;
  }

  return Math.random() < 0.5 ? value : -value;
}

function drawParticleShape(
  context: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  size: number,
) {
  if (kind.toLowerCase().includes("star")) {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.45;

    context.beginPath();

    for (let index = 0; index < spikes * 2; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = (index * Math.PI) / spikes;
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;

      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }

    context.closePath();
    context.fill();
    return;
  }

  if (kind.toLowerCase().includes("heart")) {
    const radius = size * 0.55;
    context.beginPath();
    context.moveTo(x, y + radius * 0.7);
    context.bezierCurveTo(
      x - size,
      y - radius * 0.2,
      x - size * 0.7,
      y - size,
      x,
      y - radius * 0.25,
    );
    context.bezierCurveTo(
      x + size * 0.7,
      y - size,
      x + size,
      y - radius * 0.2,
      x,
      y + radius * 0.7,
    );
    context.closePath();
    context.fill();
    return;
  }

  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
}

function createConfigKey(layer: ParticleLayer) {
  const config = layer.props.particles;
  const particleTextures = buildParticleTextureConfigs(config);
  return JSON.stringify({
    direction: config.direction,
    enabled: config.enabled,
    particleTextures,
    speedUpEnabled: config.speedUpEnabled,
  });
}

function createSidewaysParticle(
  direction: string,
  width: number,
  height: number,
  minSize: number,
  maxSize: number,
  minOpacity: number,
  maxOpacity: number,
  particleConfig: ParticleTextureConfig,
): SidewaysParticle {
  const size = randomValue(
    SIDEWAYS_BASE_SIZE * minSize,
    SIDEWAYS_BASE_SIZE * maxSize,
  );
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  const normalizedDirection = direction.toLowerCase();

  if (normalizedDirection === "right") {
    x = -width / 2 - size;
    y = randomValue(-height / 2, height / 2);
    vx = randomValue(SIDEWAYS_MIN_SPEED, SIDEWAYS_MAX_SPEED);
  } else if (normalizedDirection === "left") {
    x = width / 2 + size;
    y = randomValue(-height / 2, height / 2);
    vx = -randomValue(SIDEWAYS_MIN_SPEED, SIDEWAYS_MAX_SPEED);
  } else if (normalizedDirection === "down") {
    x = randomValue(-width / 2, width / 2);
    y = -height / 2 - size;
    vy = randomValue(SIDEWAYS_MIN_SPEED, SIDEWAYS_MAX_SPEED);
  } else {
    x = randomValue(-width / 2, width / 2);
    y = height / 2 + size;
    vy = -randomValue(SIDEWAYS_MIN_SPEED, SIDEWAYS_MAX_SPEED);
  }

  return {
    alpha: randomValue(minOpacity, maxOpacity),
    color: particleConfig.color,
    driftPhaseX: randomValue(0, Math.PI * 20),
    driftPhaseY: randomValue(0, Math.PI * 20),
    driftRangeX: randomValue(SIDEWAYS_MIN_A, SIDEWAYS_MAX_A),
    driftRangeY: randomValue(SIDEWAYS_MIN_A, SIDEWAYS_MAX_A),
    driftSpeedX: randomValue(SIDEWAYS_MIN_B, SIDEWAYS_MAX_B),
    driftSpeedY: randomValue(SIDEWAYS_MIN_B, SIDEWAYS_MAX_B),
    shape: particleConfig.shape ?? "circle",
    size,
    vx,
    vy,
    x,
    y,
  };
}

function createTravelParticle(
  minSize: number,
  maxSize: number,
  minOpacity: number,
  maxOpacity: number,
  particleConfig: ParticleTextureConfig,
): TravelParticle {
  const size = randomValue(
    STAR_TRAVEL_BASE_SIZE * minSize,
    STAR_TRAVEL_BASE_SIZE * maxSize,
  );

  return {
    alpha: randomValue(minOpacity, maxOpacity),
    color: particleConfig.color,
    maxVisualSize: STAR_TRAVEL_BASE_MAX_VISUAL_SIZE * maxSize,
    shape: particleConfig.shape ?? "circle",
    size,
    vx: randomValue(0, STAR_TRAVEL_MAX_SPEED, true),
    vy: randomValue(0, STAR_TRAVEL_MAX_SPEED, true),
    vz: randomValue(STAR_TRAVEL_MIN_SPEED, STAR_TRAVEL_MAX_SPEED),
    wobblePhaseX: randomValue(0, STAR_TRAVEL_MAX_B * 2 * Math.PI),
    wobblePhaseY: randomValue(0, STAR_TRAVEL_MAX_B * 2 * Math.PI),
    wobbleRangeX: randomValue(STAR_TRAVEL_MIN_A, STAR_TRAVEL_MAX_A),
    wobbleRangeY: randomValue(STAR_TRAVEL_MIN_A, STAR_TRAVEL_MAX_A),
    wobbleSpeedX: randomValue(STAR_TRAVEL_MIN_B, STAR_TRAVEL_MAX_B),
    wobbleSpeedY: randomValue(STAR_TRAVEL_MIN_B, STAR_TRAVEL_MAX_B),
    x: 0,
    y: 0,
    z: STAR_TRAVEL_ORIGIN_Z,
  };
}

function convertTravel3dTo2d(
  particle: TravelParticle,
  multiplier: number,
) {
  const ratio = STAR_TRAVEL_ORIGIN_Z / particle.z;
  return {
    size: Math.min((particle.size * particle.z) / STAR_TRAVEL_ORIGIN_Z, particle.maxVisualSize) * multiplier,
    x: (particle.x / ratio) * multiplier,
    y: (particle.y / ratio) * multiplier,
  };
}

function updateParticles(
  store: ParticleStore,
  layer: ParticleLayer,
  input: BrowserRenderAdapterRenderInput,
) {
  const config = layer.props.particles;
  const configKey = createConfigKey(layer);
  const activeParticleTextures = buildParticleTextureConfigs(config).filter(
    (particleTexture) => (particleTexture.birthRate ?? 0) > 0,
  );

  if (store.configKey !== configKey) {
    store.configKey = configKey;
    store.sideways = [];
    store.travel = [];
    store.carryByConfig = {};
  }

  const nowMs = input.frameContext.timeMs;
  const deltaMs = Math.max(
    1000 / Math.max(1, input.frameContext.fps),
    store.lastTimeMs === null ? 1000 / Math.max(1, input.frameContext.fps) : nowMs - store.lastTimeMs,
  );
  store.lastTimeMs = nowMs;

  if (!config.enabled) {
    store.sideways = [];
    store.travel = [];
    store.carryByConfig = {};
    return;
  }

  const amplitude = normalizeAmplitude(layer.props.amplitude);
  const normalizedDirection = config.direction.toLowerCase();
  const speedMultiplier =
    1 +
    amplitude *
      (config.speedUpEnabled
        ? normalizedDirection === "out"
          ? STAR_TRAVEL_SPEED_UP_FACTOR
          : SIDEWAYS_SPEED_UP_FACTOR
        : 0);
  const totalBirthRate = activeParticleTextures.reduce(
    (sum, particleTexture) => sum + (particleTexture.birthRate ?? 35),
    0,
  );
  const averagedTotalBirthRate =
    activeParticleTextures.length > 0
      ? totalBirthRate / activeParticleTextures.length
      : 0;

  for (const particleTexture of activeParticleTextures) {
    const textureKey = JSON.stringify(particleTexture);
    const particleBirthRate = particleTexture.birthRate ?? 35;
    const proportionalBirthRate =
      totalBirthRate > 0
        ? (particleBirthRate / totalBirthRate) * averagedTotalBirthRate
        : 0;
    const spawnCountRaw =
      (Math.max(0, proportionalBirthRate) * speedMultiplier * deltaMs) / 1000 +
      (store.carryByConfig[textureKey] ?? 0);
    const spawnCount = Math.floor(spawnCountRaw);
    store.carryByConfig[textureKey] = spawnCountRaw - spawnCount;
    const minSize = clamp(particleTexture.minSize || 0.1, 0.02, 3);
    const maxSize = Math.max(
      minSize,
      clamp(particleTexture.maxSize || 0.3, minSize, 3),
    );
    const minOpacity = clamp(particleTexture.minOpacity ?? 0.2, 0.02, 1);
    const maxOpacity = Math.max(
      minOpacity,
      clamp(particleTexture.maxOpacity ?? 1, minOpacity, 1),
    );

    if (normalizedDirection === "out") {
      for (let index = 0; index < spawnCount; index += 1) {
        store.travel.push(
          createTravelParticle(
            minSize,
            maxSize,
            minOpacity,
            maxOpacity,
            particleTexture,
          ),
        );
      }
      continue;
    }

    for (let index = 0; index < spawnCount; index += 1) {
      store.sideways.push(
        createSidewaysParticle(
          config.direction,
          BASE_HEIGHT * (input.surface.width / input.surface.height),
          BASE_HEIGHT,
          minSize,
          maxSize,
          minOpacity,
          maxOpacity,
          particleTexture,
        ),
      );
    }
  }

  if (normalizedDirection === "out") {
    store.travel = store.travel.filter((particle) => {
      particle.z +=
        particle.vz *
        speedMultiplier *
        ((STAR_TRAVEL_ORIGIN_Z + particle.z) / STAR_TRAVEL_ORIGIN_Z) *
        (deltaMs / (1000 / 60));
      particle.x +=
        particle.vx * speedMultiplier +
        particle.wobbleRangeX *
          Math.sin((particle.z - particle.wobblePhaseX) / particle.wobbleSpeedX);
      particle.y +=
        particle.vy * speedMultiplier +
        particle.wobbleRangeY *
          Math.sin((particle.z - particle.wobblePhaseY) / particle.wobbleSpeedY);

      const projected = convertTravel3dTo2d(
        particle,
        input.surface.height / BASE_HEIGHT,
      );

      return !(
        Math.abs(projected.x) - projected.size > input.surface.width / 2 ||
        Math.abs(projected.y) - projected.size > input.surface.height / 2
      );
    });

    store.sideways = [];
    return;
  }

  const width = BASE_HEIGHT * (input.surface.width / input.surface.height);
  const height = BASE_HEIGHT;

  store.sideways = store.sideways.filter((particle) => {
    const frameMultiplier = (deltaMs / (1000 / 60)) * speedMultiplier;

    particle.x +=
      particle.vx * frameMultiplier +
      particle.driftRangeX *
        Math.sin((nowMs + particle.driftPhaseX) / particle.driftSpeedX);
    particle.y +=
      particle.vy * frameMultiplier +
      particle.driftRangeY *
        Math.sin((nowMs + particle.driftPhaseY) / particle.driftSpeedY);

    if (normalizedDirection === "right") {
      return particle.x - particle.size <= width / 2;
    }

    if (normalizedDirection === "left") {
      return particle.x + particle.size >= -width / 2;
    }

    if (normalizedDirection === "down") {
      return particle.y - particle.size <= height / 2;
    }

    return particle.y + particle.size >= -height / 2;
  });

  store.travel = [];
}

export function createParticleStore(): ParticleStore {
  return {
    carryByConfig: {},
    configKey: null,
    lastTimeMs: null,
    sideways: [],
    travel: [],
  };
}

export function drawParticlesLayer(
  context: CanvasRenderingContext2D,
  layer: ParticleLayer,
  input: BrowserRenderAdapterRenderInput,
  store: ParticleStore,
) {
  updateParticles(store, layer, input);

  if (!layer.props.particles.enabled) {
    return;
  }

  const multiplier = input.surface.height / BASE_HEIGHT;

  context.save();
  context.translate(input.surface.width / 2, input.surface.height / 2);

  if (layer.props.particles.direction.toLowerCase() === "out") {
    for (const particle of store.travel) {
      const projected = convertTravel3dTo2d(particle, multiplier);
      context.globalAlpha = particle.alpha;
      context.fillStyle = toColorString(particle.color ?? "#ffffff", 1);
      drawParticleShape(
        context,
        particle.shape,
        projected.x,
        projected.y,
        Math.max(0.5, projected.size),
      );
    }
  } else {
    for (const particle of store.sideways) {
      context.globalAlpha = particle.alpha;
      context.fillStyle = toColorString(particle.color ?? "#ffffff", 1);
      drawParticleShape(
        context,
        particle.shape,
        particle.x * multiplier,
        particle.y * multiplier,
        Math.max(0.5, particle.size * multiplier),
      );
    }
  }

  context.restore();
}
