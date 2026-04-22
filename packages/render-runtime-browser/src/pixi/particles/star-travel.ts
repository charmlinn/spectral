import { Container, Sprite, type Texture } from "pixi.js";

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
const ORIGIN_Z = 100;
const BASE_SIZE = 10;
const BASE_MAX_VISUAL_SIZE = 60;
const MIN_SPEED = 0.01;
const MAX_SPEED = 0.1;
const SPEED_UP_FACTOR = 600;
const MIN_A = 0;
const MAX_A = 0.1;
const MIN_B = 20;
const MAX_B = 100;
const MIN_H = 0;
const MAX_H = MAX_B * 2 * Math.PI;

type TravelParticle = {
  aX: number;
  aY: number;
  bX: number;
  bY: number;
  hX: number;
  hY: number;
  maxVisualSize: number;
  size: number;
  sprite: Sprite;
  x: number;
  xSpeed: number;
  y: number;
  ySpeed: number;
  z: number;
  zSpeed: number;
};

export class StarTravelParticlesRenderer {
  readonly container = new Container();
  readonly direction = "OUT";
  private readonly defaultCircleTexture1: Texture;
  private readonly defaultCircleTexture2: Texture;
  private readonly defaultHeartTexture1: Texture;
  private readonly defaultHeartTexture2: Texture;
  private readonly defaultStarTexture1: Texture;
  private readonly defaultStarTexture2: Texture;
  private particles: TravelParticle[] = [];
  private calculatedWidth = BASE_HEIGHT;
  private fps = 60;
  private enabled = false;
  private speedUpEnabled = false;
  private particleTextures: ParticleTextureConfig[] = [];
  private activeParticles: ParticleTextureConfig[] = [];
  private spectrumOptions: ProcessSpectrumOptions = {
    barCount: undefined,
    loop: false,
    maxShiftPasses: 0,
    smoothed: false,
    smoothingPasses: 0,
    smoothingPoints: 0,
  };

  constructor() {
    const defaultTextures = getDefaultTextures();

    this.defaultCircleTexture1 = defaultTextures.circleTexture1;
    this.defaultCircleTexture2 = defaultTextures.circleTexture2;
    this.defaultHeartTexture1 = defaultTextures.heartTexture1;
    this.defaultHeartTexture2 = defaultTextures.heartTexture2;
    this.defaultStarTexture1 = defaultTextures.starTexture1;
    this.defaultStarTexture2 = defaultTextures.starTexture2;
    this.container.zIndex = 2;
  }

  private randomValue(min: number, max: number, negative = false) {
    let result = Math.random() * (max - min) + min;

    if (negative) {
      result = Math.random() < 0.5 ? result : -result;
    }

    return result;
  }

  updateSurface(surface: RenderSurface) {
    const multiplier = surface.height / BASE_HEIGHT;

    this.calculatedWidth = (BASE_HEIGHT * surface.width) / surface.height;
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
        this.particles.forEach((particle) => particle.sprite.destroy());
        this.container.removeChildren();
        this.particles = [];
      }
    }

    const texturesChanged =
      JSON.stringify(this.particleTextures) !==
      JSON.stringify(config.particleTextures ?? []);

    if (texturesChanged) {
      this.particles.forEach((particle) => particle.sprite.destroy());
      this.container.removeChildren();
      this.particles = [];
    }

    this.enabled = config.enabled;
    this.speedUpEnabled = config.speedUpEnabled;
    this.particleTextures = config.particleTextures ?? [];
    this.spectrumOptions = config.spectrumOptions;
    this.activeParticles = this.particleTextures.filter(
      (particleTexture) => (particleTexture.birthRate ?? 0) > 0,
    );
    this.fps = fps;
  }

  draw(spectrum: ArrayLike<number>) {
    if (!this.enabled) {
      return;
    }

    const processedSpectrum = processSpectrum(
      Array.from(spectrum ?? []),
      this.spectrumOptions,
    );
    const spectrumMagnitude = getSpectrumMagnitude(processedSpectrum);

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

      this.activeParticles.forEach((particleConfig) => {
        const particleBirthRate = particleConfig.birthRate ?? 35;
        const proportionalBirthRate =
          (particleBirthRate / totalBirthRate) * averagedTotalBirthRate;

        this.addNewParticles(
          proportionalBirthRate * speedMultiplier,
          this.fps,
          particleConfig,
        );
      });

      speedMultiplier = this.fps === 30 ? speedMultiplier * 2 : speedMultiplier;
    }

    const removalIndexes: number[] = [];
    const removalParticles: Sprite[] = [];

    this.particles.forEach((particle, index) => {
      const newZ =
        particle.z +
        particle.zSpeed * speedMultiplier * ((ORIGIN_Z + particle.z) / ORIGIN_Z);

      particle.x +=
        particle.xSpeed * speedMultiplier +
        particle.aX * Math.sin((newZ - particle.hX) / particle.bX);
      particle.y +=
        particle.ySpeed * speedMultiplier +
        particle.aY * Math.sin((newZ - particle.hY) / particle.bY);
      particle.z = newZ;

      const converted = this.convert3dTo2d(
        particle.x,
        particle.y,
        particle.z,
        particle.size,
      );

      particle.sprite.position.set(converted.x, converted.y);
      const size =
        converted.size > particle.maxVisualSize
          ? particle.maxVisualSize
          : converted.size;
      particle.sprite.width = size;
      particle.sprite.height = size;

      if (
        Math.abs(particle.sprite.x) - particle.sprite.width >
          this.calculatedWidth * 0.5 ||
        Math.abs(particle.sprite.y) - particle.sprite.height > BASE_HEIGHT * 0.5
      ) {
        removalParticles.unshift(particle.sprite);
        removalIndexes.unshift(index);
      }
    });

    removalParticles.forEach((sprite) => sprite.destroy());
    removalIndexes.forEach((index) => this.particles.splice(index, 1));
  }

  private addNewParticles(
    birthRate: number,
    fps: number,
    particleConfig: ParticleTextureConfig,
  ) {
    let count = birthRate / fps;
    const diff = count - Math.floor(count);
    count = Math.floor(count);

    if (Math.random() < diff) {
      count += 1;
    }

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

    if (!texture) {
      if (normalizedShape === "heart") {
        texture =
          Math.random() < 0.5
            ? this.defaultHeartTexture1
            : this.defaultHeartTexture2;
      } else if (normalizedShape === "star") {
        texture =
          Math.random() < 0.5
            ? this.defaultStarTexture1
            : this.defaultStarTexture2;
      } else {
        texture =
          Math.random() < 0.5
            ? this.defaultCircleTexture1
            : this.defaultCircleTexture2;
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

    return {
      aX: this.randomValue(MIN_A, MAX_A),
      aY: this.randomValue(MIN_A, MAX_A),
      bX: this.randomValue(MIN_B, MAX_B),
      bY: this.randomValue(MIN_B, MAX_B),
      hX: this.randomValue(MIN_H, MAX_H),
      hY: this.randomValue(MIN_H, MAX_H),
      maxVisualSize: BASE_MAX_VISUAL_SIZE * parsedConfig.maxSize,
      size: this.randomValue(
        BASE_SIZE * parsedConfig.minSize,
        BASE_SIZE * parsedConfig.maxSize,
      ),
      sprite,
      x: 0,
      xSpeed: this.randomValue(0, MAX_SPEED, true),
      y: 0,
      ySpeed: this.randomValue(0, MAX_SPEED, true),
      z: ORIGIN_Z,
      zSpeed: this.randomValue(MIN_SPEED, MAX_SPEED),
    };
  }

  private convert3dTo2d(x: number, y: number, z: number, size: number) {
    return {
      size: (size * z) / ORIGIN_Z,
      x: x / (ORIGIN_Z / z),
      y: y / (ORIGIN_Z / z),
    };
  }

  destroy() {
    this.container.destroy({ children: true });
    this.particles = [];
    clearAllTextures();
  }
}
