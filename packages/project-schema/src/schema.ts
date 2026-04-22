import { z } from "zod";

import { supportedAspectRatios } from "./aspect-ratio";
import {
  DEFAULT_EXPORT_DIMENSIONS,
  DEFAULT_FRAME_RATE,
  DEFAULT_PROJECT_DIMENSIONS,
  DEFAULT_PROJECT_DURATION_MS,
  VIDEO_PROJECT_SCHEMA_VERSION,
} from "./constants";

const createDefaultPoint = () => ({
  x: 0,
  y: 0,
});

const createDefaultDriftSettings = () => ({
  enabled: false,
  intensity: 0,
  customMode: false,
  amplitudeX: 0,
  amplitudeY: 0,
  rotation: 0,
  speed: 0,
  octaves: 1,
  scale: 1,
  acceleration: 0,
});

const createDefaultShadowSettings = () => ({
  enabled: false,
  color: "#000000",
  blur: 0,
  opacity: 1,
});

const createDefaultGlowSettings = () => ({
  enabled: false,
  glowType: "outer",
  blur: 0,
  scale: 1,
});

const createDefaultFireSettings = () => ({
  enabled: false,
  intensity: 0,
  detail: 0,
});

const createDefaultSpinSettings = () => ({
  enabled: false,
  speed: 0,
  acceleration: 0,
  logoLocked: false,
});

const createDefaultReflectionSettings = () => ({
  type: "none",
  direction: "down",
});

const createDefaultHlsAdjustment = () => ({
  enabled: false,
  colorize: false,
  alpha: 0,
  hue: 0,
  lightness: 0,
  saturation: 0,
});

const createDefaultTextStyle = () => ({
  text: "",
  color: "#ffffff",
  anchorPoint: "center",
  font: "Montserrat",
  fontSize: 48,
  bold: false,
  shadow: createDefaultShadowSettings(),
  position: createDefaultPoint(),
  drift: createDefaultDriftSettings(),
});

const createDefaultParticleSettings = () => ({
  enabled: false,
  speedUpEnabled: false,
  direction: "up",
  items: "dots",
  color: "#ffffff",
  birthRate: 0,
  maxSize: 0,
  minSize: 0,
  maxOpacity: 1,
  minOpacity: 0,
});

const createDefaultSourceMetadata = () => ({
  legacyPresetId: null,
  legacyPresetVersion: null,
  legacyAspectRatioCode: null,
});

export const mediaReferenceSchema = z.object({
  assetId: z.string().nullable().default(null),
  storageKey: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  kind: z
    .enum(["image", "video", "audio", "logo", "font", "thumbnail", "unknown"])
    .default("unknown"),
  origin: z
    .enum([
      "upload",
      "preset",
      "legacy-url",
      "generated",
      "external",
      "unknown",
    ])
    .default("unknown"),
  mimeType: z.string().nullable().default(null),
});

export const driftSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  intensity: z.number().default(0),
  customMode: z.boolean().default(false),
  amplitudeX: z.number().default(0),
  amplitudeY: z.number().default(0),
  rotation: z.number().default(0),
  speed: z.number().default(0),
  octaves: z.number().default(1),
  scale: z.number().default(1),
  acceleration: z.number().default(0),
});

export const pointSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
});

export const shadowSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  color: z.string().default("#000000"),
  blur: z.number().default(0),
  opacity: z.number().default(1),
});

export const glowSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  glowType: z.string().default("outer"),
  blur: z.number().default(0),
  scale: z.number().default(1),
});

export const fireSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  intensity: z.number().default(0),
  detail: z.number().default(0),
});

export const spinSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  speed: z.number().default(0),
  acceleration: z.number().default(0),
  logoLocked: z.boolean().default(false),
});

export const reflectionSettingsSchema = z.object({
  type: z.string().default("none"),
  direction: z.string().default("down"),
});

export const hlsAdjustmentSchema = z.object({
  enabled: z.boolean().default(false),
  colorize: z.boolean().default(false),
  alpha: z.number().default(0),
  hue: z.number().default(0),
  lightness: z.number().default(0),
  saturation: z.number().default(0),
});

export const textStyleSchema = z.object({
  text: z.string().default(""),
  color: z.string().default("#ffffff"),
  anchorPoint: z.string().default("center"),
  font: z.string().default("Montserrat"),
  fontSize: z.number().default(48),
  bold: z.boolean().default(false),
  shadow: shadowSettingsSchema.default(createDefaultShadowSettings),
  position: pointSchema.default(createDefaultPoint),
  drift: driftSettingsSchema.default(createDefaultDriftSettings),
});

export const lyricsSegmentSchema = z.object({
  id: z.string().default(""),
  startMs: z.number().nonnegative().default(0),
  endMs: z.number().nonnegative().default(0),
  text: z.string().default(""),
});

export const textLayerSchema = z.object({
  id: z.string().default(""),
  visible: z.boolean().default(true),
  startMs: z.number().nonnegative().default(0),
  endMs: z.number().nonnegative().nullable().default(null),
  style: textStyleSchema,
});

export const visualizerWaveCircleSchema = z.object({
  fillColor: z.string().default("0xffffff"),
  secondaryFillColor: z.string().default("0xffffff"),
  lineColor: z.string().default("0xffffff"),
  secondaryLineColor: z.string().default("0xffffff"),
  fillAlpha: z.number().default(1),
  secondaryFillAlpha: z.number().default(1),
  lineWidth: z.number().default(1),
  lineAlpha: z.number().default(1),
  secondaryLineAlpha: z.number().default(1),
  visible: z.boolean().default(true),
  spinSettings: spinSettingsSchema.default(createDefaultSpinSettings),
  customOptions: z.record(z.string(), z.unknown()).default({}),
});

export const visualizerSchema = z.object({
  enabled: z.boolean().default(true),
  pipeline: z.string().default("CircleWavePipeline"),
  logoVisible: z.boolean().default(true),
  mediaSource: mediaReferenceSchema.nullable().default(null),
  logoSource: mediaReferenceSchema.nullable().default(null),
  waveCircles: z.array(visualizerWaveCircleSchema).default([]),
  waveType: z.string().default("spectrum"),
  layoutType: z.string().default("default"),
  reflectionType: z.string().default("none"),
  shakeAmount: z.string().default("none"),
  radiusFactor: z.number().default(0),
  seperationFactor: z.number().default(0),
  waveScaleFactor: z.number().default(1),
  logoSizeFactor: z.number().default(1),
  bounceFactor: z.number().default(1),
  centerCutoutFactor: z.number().default(0),
  delayed: z.boolean().default(false),
  inverted: z.boolean().default(false),
  waveStyle: z.string().default("solid"),
  barCount: z.number().default(128),
  barWidth: z.number().default(1),
  pointRadius: z.number().default(1),
  smoothed: z.boolean().default(true),
  glowSettings: glowSettingsSchema.default(createDefaultGlowSettings),
  fireSettings: fireSettingsSchema.default(createDefaultFireSettings),
  dropShadowSettings: shadowSettingsSchema.default(createDefaultShadowSettings),
  position: pointSchema.default(createDefaultPoint),
  spinSettings: spinSettingsSchema.default(createDefaultSpinSettings),
  drift: driftSettingsSchema.default(createDefaultDriftSettings),
  width: z.number().default(0),
  baseHeight: z.number().default(0),
  rotation: z.number().default(0),
  shape: z.string().default("circle"),
  glowType: z.string().default("outer"),
});

export const backdropSchema = z.object({
  source: mediaReferenceSchema.nullable().default(null),
  shakeEnabled: z.boolean().default(false),
  filterEnabled: z.boolean().default(false),
  rotation: z.number().default(0),
  reflection: reflectionSettingsSchema.default(createDefaultReflectionSettings),
  hlsAdjustment: hlsAdjustmentSchema.default(createDefaultHlsAdjustment),
  drift: driftSettingsSchema.default(createDefaultDriftSettings),
});

export const particleSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  speedUpEnabled: z.boolean().default(false),
  direction: z.string().default("up"),
  items: z.string().default("dots"),
  color: z.string().default("#ffffff"),
  birthRate: z.number().default(0),
  maxSize: z.number().default(0),
  minSize: z.number().default(0),
  maxOpacity: z.number().default(1),
  minOpacity: z.number().default(0),
});

export const overlaysSchema = z.object({
  particles: particleSettingsSchema.default(createDefaultParticleSettings),
  youTubeCta: z
    .object({
      enabled: z.boolean().default(false),
      cornerPosition: z.string().default("bottom-right"),
    })
    .default(() => ({
      enabled: false,
      cornerPosition: "bottom-right",
    })),
  emojiImages: z.array(z.unknown()).default([]),
});

export const projectMetaSchema = z.object({
  name: z.string().default("Untitled Project"),
  description: z.string().nullable().default(null),
  presetId: z.string().nullable().default(null),
  source: z.enum(["editor", "preset", "import"]).default("editor"),
  tags: z.array(z.string()).default([]),
});

export const projectTimingSchema = z.object({
  durationMs: z.number().positive().default(DEFAULT_PROJECT_DURATION_MS),
  fps: z.number().positive().default(DEFAULT_FRAME_RATE),
  beatOffsetMs: z.number().default(0),
});

export const viewportSchema = z.object({
  width: z.number().positive().default(DEFAULT_PROJECT_DIMENSIONS.width),
  height: z.number().positive().default(DEFAULT_PROJECT_DIMENSIONS.height),
  backgroundColor: z.string().default("#000000"),
  aspectRatio: z.enum(supportedAspectRatios).default("1:1"),
});

export const audioSchema = z.object({
  assetId: z.string().nullable().default(null),
  source: mediaReferenceSchema.nullable().default(null),
  analysisId: z.string().nullable().default(null),
  trimStartMs: z.number().nonnegative().default(0),
  trimEndMs: z.number().nonnegative().nullable().default(null),
  gain: z.number().default(1),
});

export const exportSettingsSchema = z.object({
  format: z.enum(["mp4", "mov", "webm"]).default("mp4"),
  width: z.number().positive().default(DEFAULT_EXPORT_DIMENSIONS.width),
  height: z.number().positive().default(DEFAULT_EXPORT_DIMENSIONS.height),
  fps: z.number().positive().default(DEFAULT_FRAME_RATE),
  videoBitrateKbps: z.number().positive().nullable().default(null),
  audioBitrateKbps: z.number().positive().nullable().default(null),
});

export const sourceMetadataSchema = z.object({
  legacyPresetId: z.string().nullable().default(null),
  legacyPresetVersion: z.string().nullable().default(null),
  legacyAspectRatioCode: z.number().nullable().default(null),
});

export const videoProjectSchema = z.object({
  version: z.number().int().positive().default(VIDEO_PROJECT_SCHEMA_VERSION),
  projectId: z.string().default(""),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  meta: projectMetaSchema,
  timing: projectTimingSchema,
  viewport: viewportSchema,
  audio: audioSchema,
  visualizer: visualizerSchema,
  backdrop: backdropSchema,
  lyrics: z.object({
    style: textStyleSchema.default(createDefaultTextStyle),
    segments: z.array(lyricsSegmentSchema).default([]),
  }),
  textLayers: z.array(textLayerSchema).default([]),
  overlays: overlaysSchema,
  export: exportSettingsSchema,
  source: sourceMetadataSchema.default(createDefaultSourceMetadata),
});

export type MediaReference = z.infer<typeof mediaReferenceSchema>;
export type DriftSettings = z.infer<typeof driftSettingsSchema>;
export type Point = z.infer<typeof pointSchema>;
export type ShadowSettings = z.infer<typeof shadowSettingsSchema>;
export type GlowSettings = z.infer<typeof glowSettingsSchema>;
export type FireSettings = z.infer<typeof fireSettingsSchema>;
export type SpinSettings = z.infer<typeof spinSettingsSchema>;
export type ReflectionSettings = z.infer<typeof reflectionSettingsSchema>;
export type HlsAdjustment = z.infer<typeof hlsAdjustmentSchema>;
export type TextStyle = z.infer<typeof textStyleSchema>;
export type LyricsSegment = z.infer<typeof lyricsSegmentSchema>;
export type TextLayer = z.infer<typeof textLayerSchema>;
export type VisualizerWaveCircle = z.infer<typeof visualizerWaveCircleSchema>;
export type VisualizerConfig = z.infer<typeof visualizerSchema>;
export type BackdropConfig = z.infer<typeof backdropSchema>;
export type ParticleSettings = z.infer<typeof particleSettingsSchema>;
export type ProjectMeta = z.infer<typeof projectMetaSchema>;
export type ProjectTiming = z.infer<typeof projectTimingSchema>;
export type ViewportSettings = z.infer<typeof viewportSchema>;
export type AudioSettings = z.infer<typeof audioSchema>;
export type ExportSettings = z.infer<typeof exportSettingsSchema>;
export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;
export type VideoProject = z.infer<typeof videoProjectSchema>;
