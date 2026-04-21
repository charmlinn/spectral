export type EditorPanelId =
  | "general"
  | "audio"
  | "visualizer"
  | "backdrop"
  | "text"
  | "lyrics"
  | "elements";

export type EditorField = {
  helper: string;
  label: string;
  multiline?: boolean;
  value: string;
};

export type EditorSection = {
  description: string;
  eyebrow: string;
  fields: EditorField[];
  highlights: string[];
  id: EditorPanelId;
  label: string;
};

export type EditorTrack = {
  accent: string;
  clips: number;
  durationLabel: string;
  id: string;
  kind: string;
  label: string;
};

export type EditorInspectorCard = {
  description: string;
  title: string;
  value: string;
};

export type EditorProjectSnapshot = {
  aspectRatio: "16:9" | "9:16" | "1:1";
  duration: string;
  id: string;
  inspectorCards: EditorInspectorCard[];
  lastSavedAt: string;
  notes: string;
  presetName: string;
  previewStats: Array<{ label: string; value: string }>;
  resolution: string;
  sections: EditorSection[];
  stageLabel: string;
  status: "Draft" | "Autosaved";
  title: string;
  tracks: EditorTrack[];
};

export type EditorEntry = {
  description: string;
  id: string;
  presetName: string;
  resolution: string;
  title: string;
};

const baseSections: EditorSection[] = [
  {
    id: "general",
    label: "General",
    eyebrow: "Project",
    description: "Name, format, pacing, and delivery defaults for the shell.",
    highlights: ["Autosave checkpoint", "Canvas sizing", "Preset metadata"],
    fields: [
      {
        label: "Project title",
        value: "Signal Bloom",
        helper: "Server project metadata plugs in here.",
      },
      {
        label: "Output profile",
        value: "1080p / 30 fps / SDR",
        helper: "Project schema can replace this placeholder with typed options.",
      },
      {
        label: "Creative note",
        value: "Build toward a restrained neon bloom with generous breathing room.",
        helper: "Long-form project notes map cleanly to a future textarea field.",
        multiline: true,
      },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    eyebrow: "Sound",
    description: "Spectrum, source binding, and analyzer checkpoints.",
    highlights: ["Primary waveform", "FFT handoff", "Playback sync"],
    fields: [
      {
        label: "Track source",
        value: "anthem-master-v12.wav",
        helper: "Media package should surface upload binding and duration.",
      },
      {
        label: "Analyzer preset",
        value: "Dense bars / 512 bins",
        helper: "Audio-analysis package should provide the option list.",
      },
      {
        label: "Mix note",
        value: "Duck the backing visuals when vocal peaks cross the bridge.",
        helper: "Reserved for future automation controls.",
        multiline: true,
      },
    ],
  },
  {
    id: "visualizer",
    label: "Visualizer",
    eyebrow: "Motion",
    description: "Shape language, bar behavior, and reactive motion groups.",
    highlights: ["Layer stack", "Palette routing", "Peak response"],
    fields: [
      {
        label: "Shape system",
        value: "Arc lattice / mirrored",
        helper: "Render-core will replace this shell value.",
      },
      {
        label: "Color routing",
        value: "Amber -> cyan split",
        helper: "Tokenized gradients can land here later.",
      },
      {
        label: "Behavior note",
        value: "Keep the low-end bars broad and slow to avoid chatter.",
        helper: "Future advanced controls can replace the note field.",
        multiline: true,
      },
    ],
  },
  {
    id: "backdrop",
    label: "Backdrop",
    eyebrow: "Scene",
    description: "Background media, overlays, and visual atmosphere.",
    highlights: ["Media slot", "Mask stack", "Depth overlays"],
    fields: [
      {
        label: "Backdrop source",
        value: "studio-gradient-plate.mov",
        helper: "Media bindings and thumbnails land here later.",
      },
      {
        label: "Overlay mode",
        value: "Soft glow / grain",
        helper: "Token-driven look presets can reuse this slot.",
      },
      {
        label: "Scene note",
        value: "Use a subtle radial pulse behind the center lockup.",
        helper: "Placeholder for richer backdrop controls.",
        multiline: true,
      },
    ],
  },
  {
    id: "text",
    label: "Text",
    eyebrow: "Copy",
    description: "Title, CTA, and typographic hierarchy for the composition.",
    highlights: ["Primary heading", "Secondary lockup", "Callout styling"],
    fields: [
      {
        label: "Headline",
        value: "Catch the chorus before it breaks.",
        helper: "Future object inspector can own typography controls.",
      },
      {
        label: "CTA",
        value: "Pre-save the drop",
        helper: "Reserved for element-level action copy.",
      },
      {
        label: "Copy note",
        value: "Keep line lengths short to preserve legibility in the portrait cut.",
        helper: "Placeholder until object-level editing arrives.",
        multiline: true,
      },
    ],
  },
  {
    id: "lyrics",
    label: "Lyrics",
    eyebrow: "Timing",
    description: "Lyric source, sync quality, and handoff into the timeline package.",
    highlights: ["Transcript source", "Cue list", "Selection handoff"],
    fields: [
      {
        label: "Lyric mode",
        value: "Timed transcript / chorus emphasized",
        helper: "Timeline package should own cue editing.",
      },
      {
        label: "Language",
        value: "English (US)",
        helper: "Project schema can carry lyric localization later.",
      },
      {
        label: "Sync note",
        value: "Second verse needs a slight lead-in to stay under the snare hits.",
        helper: "Reserved for diagnostic notes from the timeline engine.",
        multiline: true,
      },
    ],
  },
  {
    id: "elements",
    label: "Elements",
    eyebrow: "Layers",
    description: "Logos, lower-thirds, particle accents, and optional overlays.",
    highlights: ["Brand lockup", "Particle groups", "CTA container"],
    fields: [
      {
        label: "Overlay kit",
        value: "Brand frame / logo pulse",
        helper: "Element metadata can attach here later.",
      },
      {
        label: "Particle pass",
        value: "Dust drift / low opacity",
        helper: "Render-core element presets plug into this slot.",
      },
      {
        label: "Layer note",
        value: "Keep floating particles off the lower CTA lane.",
        helper: "Reserved for future layer routing and inspector controls.",
        multiline: true,
      },
    ],
  },
];

const baseTracks: EditorTrack[] = [
  {
    id: "audio-master",
    label: "Master audio",
    kind: "Waveform",
    clips: 1,
    accent: "bg-amber-400/80",
    durationLabel: "00:45",
  },
  {
    id: "lyrics-main",
    label: "Lyric cues",
    kind: "Text track",
    clips: 6,
    accent: "bg-cyan-400/75",
    durationLabel: "00:42",
  },
  {
    id: "visualizer-main",
    label: "Visualizer",
    kind: "Scene automation",
    clips: 4,
    accent: "bg-emerald-400/75",
    durationLabel: "00:45",
  },
];

const inspectorCards: EditorInspectorCard[] = [
  {
    title: "Preview runtime",
    value: "Reserved slot",
    description: "The browser runtime from Codex2 can mount into the stage panel without changing the shell.",
  },
  {
    title: "Timeline package",
    value: "Container ready",
    description: "The bottom panel exposes a stable mount area for the future timeline package.",
  },
  {
    title: "Project persistence",
    value: "Server placeholder",
    description: "Codex4 can replace static actions with save, export, and stream-backed status.",
  },
];

export async function listEditorEntries(): Promise<EditorEntry[]> {
  return [
    {
      id: "signal-bloom",
      title: "Signal Bloom",
      description: "Landscape workspace with a restrained neon atmosphere.",
      presetName: "Amber Bloom",
      resolution: "1920 x 1080",
    },
    {
      id: "chorus-frame",
      title: "Chorus Frame",
      description: "Vertical promo cut with tighter lyric pacing and CTA space.",
      presetName: "Portrait Pulse",
      resolution: "1080 x 1920",
    },
  ];
}

export async function getEditorProject(projectId: string): Promise<EditorProjectSnapshot> {
  const normalizedId = decodeURIComponent(projectId);
  const portraitProject = normalizedId.includes("chorus") || normalizedId.includes("portrait");

  return {
    id: normalizedId,
    title: portraitProject ? "Chorus Frame" : "Signal Bloom",
    status: portraitProject ? "Autosaved" : "Draft",
    presetName: portraitProject ? "Portrait Pulse" : "Amber Bloom",
    resolution: portraitProject ? "1080 x 1920" : "1920 x 1080",
    aspectRatio: portraitProject ? "9:16" : "16:9",
    duration: portraitProject ? "00:30" : "00:45",
    lastSavedAt: "2026-04-21T15:22:00.000Z",
    stageLabel: portraitProject ? "Portrait performance cut" : "Landscape performance cut",
    notes: portraitProject
      ? "Optimized for mobile-first preview, lyric legibility, and CTA spacing."
      : "Balanced for hero banners, export queue handoff, and wide preview staging.",
    previewStats: [
      {
        label: "Aspect",
        value: portraitProject ? "9:16" : "16:9",
      },
      {
        label: "Resolution",
        value: portraitProject ? "1080p vertical" : "1080p landscape",
      },
      {
        label: "Runtime",
        value: "Shell placeholder",
      },
      {
        label: "Frames",
        value: portraitProject ? "900" : "1350",
      },
    ],
    sections: baseSections,
    tracks: baseTracks,
    inspectorCards,
  };
}

