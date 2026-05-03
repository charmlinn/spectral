import { Container, Sprite } from "pixi.js";

import {
  getSpectrumMagnitude,
  processSpectrum,
  type ProcessSpectrumOptions,
} from "@spectral/audio-analysis";
import type { RenderSurface } from "@spectral/render-core";
import { toPixiColor } from "../shared";
import {
  clearAllTextures,
  createMediaTexture,
  getDefaultTextures,
} from "./texture-utils";
import type { ParticleTextureConfig } from "../../particles/config";

const BASE_HEIGHT = 500;
const BASE_SIZE = 50;
const MIN_SPEED = 0.3;
const MAX_SPEED = 0.9;
const SPEED_UP_FACTOR = 200;
const MIN_A = 0;
const MAX_A = 0.5;
const MIN_B = 100;
const MAX_B = 500;
const MIN_H = 0;
const MAX_H = MAX_B * 10 * Math.PI;
const BASE_FPS = 60;
const MAX_SPAWN_PER_FRAME = 5;
const MAX_ACTIVE_PARTICLES = 96;
const ATTACK_PER_SECOND = 9;
const RELEASE_PER_SECOND = 4;

type SidewaysParticle = {
  aX: number;
  aY: number;
  bX: number;
  bY: number;
  hX: number;
  hY: number;
  sprite: Sprite;
  x: number;
  xSpeed: number;
  y: number;
  ySpeed: number;
};

function normalizeDirection(direction: string | null | undefined) {
  return (direction ?? "up").trim().toUpperCase();
}

export class SidewaysParticlesRenderer {
  readonly container = new Container();
  readonly direction: string;
  private particles: SidewaysParticle[] = [];
  private calculatedWidth = BASE_HEIGHT;
  private calculatedHeight = BASE_HEIGHT;
  private fps = 60;
  private enabled = false;
  private speedUpEnabled = false;
  private particleTextures: ParticleTextureConfig[] = [];
  private activeParticles: ParticleTextureConfig[] = [];
  private lastTimeMs: number | null = null;
  private smoothedMagnitude = 0;
  private spawnAccumulators = new Map<string, number>();
  private spectrumOptions: ProcessSpectrumOptions = {
    barCount: undefined,
    loop: false,
    maxShiftPasses: 0,
    smoothed: false,
    smoothingPasses: 0,
    smoothingPoints: 0,
  };
  private particleOutOfFrame: (sprite: Sprite) => boolean = () => false;

  constructor(direction = "up") {
    this.container.zIndex = 2;
    this.direction = normalizeDirection(direction);
  }

  private randomValue(min: number, max: number, negative = false) {
    let result = Math.random() * (max - min) + min;

    if (negative) {
      result = Math.random() < 0.5 ? result : -result;
    }

    return result;
  }

  private resetParticles() {
    this.particles.forEach((particle) => particle.sprite.destroy());
    this.container.removeChildren();
    this.particles = [];
    this.lastTimeMs = null;
    this.smoothedMagnitude = 0;
    this.spawnAccumulators.clear();
  }

  updateSurface(surface: RenderSurface) {
    const multiplier = surface.height / BASE_HEIGHT;
    const nextWidth = (BASE_HEIGHT * surface.width) / surface.height;
    const nextHeight = BASE_HEIGHT;
    const dimensionsChanged =
      this.calculatedWidth !== nextWidth || this.calculatedHeight !== nextHeight;

    if (dimensionsChanged) {
      this.resetParticles();
    }

    this.calculatedWidth = nextWidth;
    this.calculatedHeight = nextHeight;
    this.container.position.set(surface.width * 0.5, surface.height * 0.5);
    this.container.scale.set(multiplier, multiplier);
  }

  update(
    config: {
      enabled: boolean;
      particleTextures: ParticleTextureConfig[];
      spectrumOptions: ProcessSpectrumOptions;
      speedUpEnabled: boolean;
    },
    fps: number,
  ) {
    if (this.enabled !== config.enabled) {
      this.container.alpha = config.enabled ? 1 : 0;

      if (!config.enabled) {
        this.resetParticles();
      }
    }

    const texturesChanged =
      JSON.stringify(this.particleTextures) !==
      JSON.stringify(config.particleTextures ?? []);

    if (texturesChanged) {
      this.resetParticles();
    }

    this.enabled = config.enabled;
    this.speedUpEnabled = config.speedUpEnabled;
    this.particleTextures = config.particleTextures ?? [];
    this.spectrumOptions = config.spectrumOptions;
    this.activeParticles = this.particleTextures.filter(
      (particleTexture) => (particleTexture.birthRate ?? 0) > 0,
    );
    this.fps = fps;

    switch (this.direction) {
      case "RIGHT":
        this.particleOutOfFrame = (sprite) =>
          sprite.x - sprite.width > this.calculatedWidth * 0.5;
        break;
      case "LEFT":
        this.particleOutOfFrame = (sprite) =>
          sprite.x + sprite.width < -this.calculatedWidth * 0.5;
        break;
      case "DOWN":
        this.particleOutOfFrame = (sprite) =>
          sprite.y - sprite.height > this.calculatedHeight * 0.5;
        break;
      default:
        this.particleOutOfFrame = (sprite) =>
          sprite.y + sprite.height < -this.calculatedHeight * 0.5;
        break;
    }
  }

  private getDeltaSeconds(timeMs: number) {
    const previousTimeMs = this.lastTimeMs;
    this.lastTimeMs = timeMs;

    if (previousTimeMs === null) {
      return 1 / BASE_FPS;
    }

    const deltaSeconds = (timeMs - previousTimeMs) / 1000;

    if (deltaSeconds <= 0 || deltaSeconds > 0.25) {
      return 1 / BASE_FPS;
    }

    return deltaSeconds;
  }

  private smoothMagnitude(target: number, deltaSeconds: number) {
    const rate =
      target > this.smoothedMagnitude ? ATTACK_PER_SECOND : RELEASE_PER_SECOND;
    const alpha = Math.min(1, Math.max(0, deltaSeconds * rate));

    this.smoothedMagnitude += (target - this.smoothedMagnitude) * alpha;
    return this.smoothedMagnitude;
  }

  draw(spectrum: ArrayLike<number>, timeMs: number) {
    if (!this.enabled) {
      return;
    }

    const deltaSeconds = this.getDeltaSeconds(timeMs);
    const frameSteps = deltaSeconds * BASE_FPS;
    const processedSpectrum = processSpectrum(
      Array.from(spectrum ?? []),
      this.spectrumOptions,
    );
    const spectrumMagnitude = this.smoothMagnitude(
      getSpectrumMagnitude(processedSpectrum),
      deltaSeconds,
    );

    let speedMultiplier = this.speedUpEnabled
      ? 1 + (spectrumMagnitude / 255) * SPEED_UP_FACTOR
      : 1;

    if (!this.activeParticles.length) {
      speedMultiplier = this.fps === 30 ? speedMultiplier * 2 : speedMultiplier;
    } else {
      const totalBirthRate = this.activeParticles.reduce(
        (sum, config) => sum + (config.birthRate ?? 35),
        0,
      );
      const averagedTotalBirthRate = totalBirthRate / this.activeParticles.length;

      let spawnedThisFrame = 0;

      for (const particleConfig of this.activeParticles) {
        if (
          spawnedThisFrame >= MAX_SPAWN_PER_FRAME ||
          this.particles.length >= MAX_ACTIVE_PARTICLES
        ) {
          break;
        }

        const particleBirthRate = particleConfig.birthRate ?? 35;
        const proportionalBirthRate =
          (particleBirthRate / totalBirthRate) * averagedTotalBirthRate;
        const textureKey = JSON.stringify(particleConfig);
        const nextAccumulator =
          (this.spawnAccumulators.get(textureKey) ?? 0) +
          proportionalBirthRate * speedMultiplier * deltaSeconds;
        const spawnCount = Math.min(
          Math.floor(nextAccumulator),
          MAX_SPAWN_PER_FRAME - spawnedThisFrame,
          MAX_ACTIVE_PARTICLES - this.particles.length,
        );

        this.spawnAccumulators.set(
          textureKey,
          spawnCount > 0 ? nextAccumulator - spawnCount : nextAccumulator,
        );

        if (spawnCount > 0) {
          this.addNewParticles(spawnCount, particleConfig);
          spawnedThisFrame += spawnCount;
        }
      }

      speedMultiplier = this.fps === 30 ? speedMultiplier * 2 : speedMultiplier;
    }

    const removalIndexes: number[] = [];
    const removalParticles: Sprite[] = [];

    this.particles.forEach((particle, index) => {
      particle.x +=
        particle.xSpeed * speedMultiplier * frameSteps +
        particle.aX * Math.sin(particle.hX / particle.bX);
      particle.y +=
        particle.ySpeed * speedMultiplier * frameSteps +
        particle.aY * Math.sin(particle.hY / particle.bY);
      particle.sprite.position.set(particle.x, particle.y);

      if (this.particleOutOfFrame(particle.sprite)) {
        removalParticles.unshift(particle.sprite);
        removalIndexes.unshift(index);
      }
    });

    removalParticles.forEach((sprite) => sprite.destroy());
    removalIndexes.forEach((index) => this.particles.splice(index, 1));
  }

  private addNewParticles(count: number, particleConfig: ParticleTextureConfig) {
    const parsedConfig = {
      maxOpacity:
        particleConfig.maxOpacity !== undefined ? particleConfig.maxOpacity : 1,
      maxSize:
        particleConfig.maxSize !== undefined ? particleConfig.maxSize : 0.3,
      mediaData: particleConfig.mediaData,
      minOpacity:
        particleConfig.minOpacity !== undefined ? particleConfig.minOpacity : 0.2,
      minSize:
        particleConfig.minSize !== undefined ? particleConfig.minSize : 0.1,
      shape: particleConfig.shape,
      tint:
        particleConfig.color !== undefined && particleConfig.color !== null
          ? toPixiColor(particleConfig.color)
          : 0xffffff,
    };

    for (let index = 0; index < count; index += 1) {
      const particle = this.createParticle(parsedConfig);
      this.particles.push(particle);
      this.container.addChild(particle.sprite);
    }
  }

  private createParticle(parsedConfig: {
    maxOpacity: number;
    maxSize: number;
    mediaData?: string | null;
    minOpacity: number;
    minSize: number;
    shape?: string | null;
    tint: number;
  }) {
    let texture = createMediaTexture(parsedConfig.shape, parsedConfig.mediaData);
    const normalizedShape = parsedConfig.shape?.trim().toLowerCase();
    const defaultTextures = getDefaultTextures();

    if (!texture) {
      if (normalizedShape === "heart") {
        texture =
          Math.random() < 0.5
            ? defaultTextures.heartTexture1
            : defaultTextures.heartTexture2;
      } else if (normalizedShape === "star") {
        texture =
          Math.random() < 0.5
            ? defaultTextures.starTexture1
            : defaultTextures.starTexture2;
      } else {
        texture =
          Math.random() < 0.5
            ? defaultTextures.circleTexture1
            : defaultTextures.circleTexture2;
      }
    }

    const sprite = new Sprite(texture);

    sprite.tint = parsedConfig.tint;
    sprite.anchor.set(0.5);
    sprite.alpha = this.randomValue(
      parsedConfig.minOpacity,
      parsedConfig.maxOpacity,
    );
    sprite.width = this.randomValue(
      BASE_SIZE * parsedConfig.minSize,
      BASE_SIZE * parsedConfig.maxSize,
    );
    sprite.height = sprite.width;

    let x = 0;
    let y = 0;
    let xSpeed = 0;
    let ySpeed = 0;

    switch (this.direction) {
      case "RIGHT":
        x = -this.calculatedWidth * 0.5 - sprite.width;
        y = this.randomValue(this.calculatedHeight * 0.5, 0, true);
        xSpeed = this.randomValue(MIN_SPEED, MAX_SPEED);
        break;
      case "LEFT":
        x = this.calculatedWidth * 0.5 + sprite.width;
        y = this.randomValue(this.calculatedHeight * 0.5, 0, true);
        xSpeed = this.randomValue(-MAX_SPEED, -MIN_SPEED);
        break;
      case "DOWN":
        x = this.randomValue(this.calculatedWidth * 0.5, 0, true);
        y = -this.calculatedHeight * 0.5 - sprite.height;
        ySpeed = this.randomValue(MIN_SPEED, MAX_SPEED);
        break;
      default:
        x = this.randomValue(this.calculatedWidth * 0.5, 0, true);
        y = this.calculatedHeight * 0.5 + sprite.height;
        ySpeed = this.randomValue(-MAX_SPEED, -MIN_SPEED);
        break;
    }

    return {
      aX: this.randomValue(MIN_A, MAX_A),
      aY: this.randomValue(MIN_A, MAX_A),
      bX: this.randomValue(MIN_B, MAX_B),
      bY: this.randomValue(MIN_B, MAX_B),
      hX: this.randomValue(MIN_H, MAX_H),
      hY: this.randomValue(MIN_H, MAX_H),
      sprite,
      x,
      xSpeed,
      y,
      ySpeed,
    };
  }

  destroy() {
    this.container.destroy({ children: true });
    this.particles = [];
    clearAllTextures();
  }
}
