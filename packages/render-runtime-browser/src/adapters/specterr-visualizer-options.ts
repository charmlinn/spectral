/**
 * Source adapted from:
 * /Users/linncharm/Project/specterr/recovered/tree/components/pages/CreatePage/Preview/helpers.js
 * 保持 Specterr 的 visualizer layer / delay / reflection 组合逻辑。
 */

type SpecterrWaveSpectrumOptions = {
  smoothingPoints: number;
  smoothingPasses: number;
  maxShiftPasses: number;
  barCount: number;
  smoothed: boolean;
  loop: boolean;
};

export type SpecterrWaveCircleRenderOptions = {
  scale: number;
  waveScale: number;
  spectrumOptions: SpecterrWaveSpectrumOptions;
  frameDelay: number;
  heightAdjust: number;
};

type SpecterrCustomWaveCircleSetting = {
  enabled?: boolean;
  waveType?: string;
  reflectionType?: string;
  barCount?: number;
  smoothed?: boolean;
  waveScaleFactor?: number;
};

const BASS_SMOOTHING_POINTS = 5;
const WIDE_SMOOTHING_POINTS = 5;

function normalizeWaveType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "wide spectrum";

  if (normalized.includes("bass")) {
    return "bass spectrum";
  }

  if (normalized.includes("waveform")) {
    return "waveform";
  }

  return "wide spectrum";
}

function normalizeLayoutType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "default";

  if (normalized.includes("webbed")) {
    return "webbed";
  }

  if (normalized.includes("layered")) {
    return "layered";
  }

  if (normalized.includes("stacked")) {
    return "stacked";
  }

  if (normalized.includes("target")) {
    return "target";
  }

  return "default";
}

function normalizeReflectionType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "none";

  if (normalized.includes("four")) {
    return "four way";
  }

  if (normalized.includes("three")) {
    return "three way";
  }

  if (normalized.includes("slanted")) {
    return "slanted";
  }

  if (normalized.includes("vertical")) {
    return "vertical";
  }

  if (normalized.includes("1 side") || normalized.includes("one side")) {
    return "1 side";
  }

  if (normalized.includes("2 side") || normalized.includes("two side")) {
    return "2 sides";
  }

  if (normalized.includes("combo")) {
    return "combo";
  }

  return "none";
}

function getSpectrumOptionsAndBaseWaveScale(
  waveType: string,
  shape: string,
  reflectionType: string,
  computedBarCount: number,
  smoothed: boolean,
) {
  switch (normalizeWaveType(waveType)) {
    case "bass spectrum":
      return {
        primarySpectrumOptions: {
          smoothingPoints: BASS_SMOOTHING_POINTS,
          smoothingPasses: 4,
          maxShiftPasses: 0,
          barCount: computedBarCount,
          smoothed,
          loop:
            shape === "circle" &&
            normalizeReflectionType(reflectionType) !== "vertical",
        },
        baseWaveScale: 2,
      };
    case "wide spectrum":
      return {
        primarySpectrumOptions: {
          smoothingPoints: WIDE_SMOOTHING_POINTS,
          smoothingPasses: 4,
          maxShiftPasses: 0,
          barCount: computedBarCount,
          smoothed,
          loop:
            shape === "circle" &&
            normalizeReflectionType(reflectionType) !== "vertical",
        },
        baseWaveScale: 0.333,
      };
    default:
      return {
        primarySpectrumOptions: {
          smoothingPoints: WIDE_SMOOTHING_POINTS,
          smoothingPasses: 0,
          maxShiftPasses: 0,
          barCount: computedBarCount,
          smoothed,
          loop: false,
        },
        baseWaveScale: 1,
      };
  }
}

function createAvailableOptions(
  baseWaveScale: number,
  waveScale: number,
  primarySpectrumOptions: SpecterrWaveSpectrumOptions,
) {
  const createOption = (): SpecterrWaveCircleRenderOptions => ({
    scale: 1,
    waveScale: baseWaveScale * waveScale,
    spectrumOptions: { ...primarySpectrumOptions },
    frameDelay: 0,
    heightAdjust: 0,
  });

  return Array.from({ length: 7 }, createOption);
}

function configureAvailableOptions(
  availableOptions: SpecterrWaveCircleRenderOptions[],
  layoutType: string,
  separation: number,
) {
  const normalizedLayoutType = normalizeLayoutType(layoutType);

  if (normalizedLayoutType === "webbed" || normalizedLayoutType === "layered") {
    availableOptions[0]!.spectrumOptions.smoothingPasses = 4;
    availableOptions[0]!.spectrumOptions.maxShiftPasses = 0;
    availableOptions[1]!.spectrumOptions.smoothingPasses += Math.floor(
      8 * separation,
    );
    availableOptions[1]!.spectrumOptions.maxShiftPasses += Math.floor(
      4 * separation,
    );
    availableOptions[2]!.spectrumOptions.smoothingPasses += Math.floor(
      12 * separation,
    );
    availableOptions[2]!.spectrumOptions.maxShiftPasses += Math.floor(
      8 * separation,
    );
    availableOptions[3]!.spectrumOptions.smoothingPasses += Math.floor(
      16 * separation,
    );
    availableOptions[3]!.spectrumOptions.maxShiftPasses += Math.floor(
      12 * separation,
    );
    availableOptions[4]!.spectrumOptions.smoothingPasses += Math.floor(
      20 * separation,
    );
    availableOptions[4]!.spectrumOptions.maxShiftPasses += Math.floor(
      16 * separation,
    );
    availableOptions[5]!.spectrumOptions.smoothingPasses += Math.floor(
      24 * separation,
    );
    availableOptions[5]!.spectrumOptions.maxShiftPasses += Math.floor(
      20 * separation,
    );
    availableOptions[6]!.spectrumOptions.smoothingPasses += Math.floor(
      28 * separation,
    );
    availableOptions[6]!.spectrumOptions.maxShiftPasses += Math.floor(
      24 * separation,
    );
  }

  if (
    normalizedLayoutType === "layered" ||
    normalizedLayoutType === "stacked"
  ) {
    availableOptions[0]!.waveScale *= 0.25;
    availableOptions[1]!.waveScale *= 0.25 + 0.25 * separation;
    availableOptions[2]!.waveScale *= 0.25 + 0.5 * separation;
    availableOptions[3]!.waveScale *= 0.25 + 0.75 * separation;
    availableOptions[4]!.waveScale *= 0.25 + separation;
    availableOptions[5]!.waveScale *= 0.25 + 1.25 * separation;
    availableOptions[6]!.waveScale *= 0.25 + 1.5 * separation;
  }

  if (normalizedLayoutType === "target") {
    availableOptions[0]!.scale = 1;
    availableOptions[1]!.scale += 0.1 * separation;
    availableOptions[2]!.scale += 0.2 * separation;
    availableOptions[3]!.scale += 0.3 * separation;
    availableOptions[4]!.scale += 0.4 * separation;
    availableOptions[5]!.scale += 0.5 * separation;
    availableOptions[6]!.scale += 0.6 * separation;

    availableOptions[0]!.heightAdjust = 0;
    availableOptions[1]!.heightAdjust = 15 * separation;
    availableOptions[2]!.heightAdjust = 30 * separation;
    availableOptions[3]!.heightAdjust = 45 * separation;
    availableOptions[4]!.heightAdjust = 60 * separation;
    availableOptions[5]!.heightAdjust = 75 * separation;
    availableOptions[6]!.heightAdjust = 90 * separation;
  }
}

function initializeWaveCircles(
  count: number,
  layoutType: string,
  availableOptions: SpecterrWaveCircleRenderOptions[],
) {
  const options: SpecterrWaveCircleRenderOptions[] = [];
  const normalizedLayoutType = normalizeLayoutType(layoutType);

  if (count === 1) {
    options.unshift(availableOptions[0]!);
  }

  if (count === 2) {
    if (normalizedLayoutType === "webbed") {
      options.unshift(availableOptions[0]!);
      options.unshift(availableOptions[4]!);
    } else {
      options.unshift(availableOptions[0]!);
      options.unshift(availableOptions[1]!);
    }
  }

  if (count === 3) {
    if (normalizedLayoutType === "webbed") {
      options.unshift(availableOptions[0]!);
      options.unshift(availableOptions[2]!);
      options.unshift(availableOptions[4]!);
    } else {
      options.unshift(availableOptions[0]!);
      options.unshift(availableOptions[1]!);
      options.unshift(availableOptions[2]!);
    }
  }

  if (count === 4) {
    options.unshift(availableOptions[0]!);
    options.unshift(availableOptions[1]!);
    options.unshift(availableOptions[2]!);
    options.unshift(availableOptions[3]!);
  }

  if (count === 5) {
    options.unshift(availableOptions[0]!);
    options.unshift(availableOptions[1]!);
    options.unshift(availableOptions[2]!);
    options.unshift(availableOptions[3]!);
    options.unshift(availableOptions[4]!);
  }

  if (count === 6) {
    options.unshift(availableOptions[0]!);
    options.unshift(availableOptions[1]!);
    options.unshift(availableOptions[2]!);
    options.unshift(availableOptions[3]!);
    options.unshift(availableOptions[4]!);
    options.unshift(availableOptions[5]!);
  }

  if (count >= 7) {
    options.unshift(availableOptions[0]!);
    options.unshift(availableOptions[1]!);
    options.unshift(availableOptions[2]!);
    options.unshift(availableOptions[3]!);
    options.unshift(availableOptions[4]!);
    options.unshift(availableOptions[5]!);
    options.unshift(availableOptions[6]!);
  }

  return options;
}

function setFrameDelays(
  count: number,
  delayed: boolean,
  options: SpecterrWaveCircleRenderOptions[],
) {
  if (!delayed) {
    return;
  }

  if (count === 2) {
    options[0]!.frameDelay = 3;
  } else if (count === 3) {
    options[1]!.frameDelay = 2;
    options[0]!.frameDelay = 4;
  } else if (count === 4) {
    options[2]!.frameDelay = 1;
    options[1]!.frameDelay = 2;
    options[0]!.frameDelay = 3;
  } else if (count === 5) {
    options[3]!.frameDelay = 1;
    options[2]!.frameDelay = 2;
    options[1]!.frameDelay = 3;
    options[0]!.frameDelay = 4;
  } else if (count === 6) {
    options[4]!.frameDelay = 1;
    options[3]!.frameDelay = 2;
    options[2]!.frameDelay = 3;
    options[1]!.frameDelay = 4;
    options[0]!.frameDelay = 5;
  } else if (count >= 7) {
    options[5]!.frameDelay = 1;
    options[4]!.frameDelay = 2;
    options[3]!.frameDelay = 3;
    options[2]!.frameDelay = 4;
    options[1]!.frameDelay = 5;
    options[0]!.frameDelay = 6;
  }
}

function adjustBarCount(
  barCount: number,
  reflectionType: string,
  waveStyle: string,
) {
  const normalizedReflectionType = normalizeReflectionType(reflectionType);

  if ((waveStyle ?? "").toLowerCase() === "solid") {
    return barCount;
  }

  switch (normalizedReflectionType) {
    case "vertical":
    case "slanted":
    case "1 side":
    case "combo":
      return Math.ceil(barCount / 2);
    case "three way":
      return Math.ceil(barCount / 3);
    case "four way":
      return Math.ceil(barCount / 4);
    default:
      return barCount;
  }
}

function applyCustomSettings(
  customSettings: SpecterrCustomWaveCircleSetting[],
  options: SpecterrWaveCircleRenderOptions[],
  shape: string,
) {
  customSettings.forEach((settings, index) => {
    if (!settings?.enabled || !options[index]) {
      return;
    }

    const { primarySpectrumOptions, baseWaveScale } =
      getSpectrumOptionsAndBaseWaveScale(
        settings.waveType ?? "wide spectrum",
        shape,
        settings.reflectionType ?? "none",
        settings.barCount ?? options[index]!.spectrumOptions.barCount,
        settings.smoothed ?? true,
      );

    options[index]!.waveScale = baseWaveScale * (settings.waveScaleFactor ?? 1);
    options[index]!.spectrumOptions = primarySpectrumOptions;
  });
}

export function createSpecterrWaveCircleOptions(input: {
  barCount: number;
  customSettings?: unknown[];
  delayed: boolean;
  layoutType: string;
  reflectionType: string;
  ringCount: number;
  separation: number;
  shape: string;
  smoothed: boolean;
  waveScale: number;
  waveStyle: string;
  waveType: string;
}) {
  const computedBarCount = adjustBarCount(
    input.barCount,
    input.reflectionType,
    input.waveStyle,
  );
  const { primarySpectrumOptions, baseWaveScale } =
    getSpectrumOptionsAndBaseWaveScale(
      input.waveType,
      input.shape,
      input.reflectionType,
      computedBarCount,
      input.smoothed,
    );

  const availableOptions = createAvailableOptions(
    baseWaveScale,
    input.waveScale,
    primarySpectrumOptions,
  );

  configureAvailableOptions(
    availableOptions,
    input.layoutType,
    input.separation,
  );

  const options = initializeWaveCircles(
    input.ringCount,
    input.layoutType,
    availableOptions,
  );

  setFrameDelays(input.ringCount, input.delayed, options);
  applyCustomSettings(
    (input.customSettings ?? []) as SpecterrCustomWaveCircleSetting[],
    options,
    input.shape,
  );

  return options;
}
