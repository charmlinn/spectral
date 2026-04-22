import { normalizeVideoProject, type VideoProject } from "@spectral/project-schema";

function isWhitePlaceholderColor(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "#ffffff" || normalized === "0xffffff";
}

function isPresetDerivedProject(projectData: VideoProject) {
  return (
    projectData.meta.source === "preset" ||
    projectData.meta.presetId !== null ||
    projectData.source.legacyPresetId !== null
  );
}

export function repairPresetDerivedProjectData(
  projectData: VideoProject,
  presetProjectData: VideoProject,
): VideoProject {
  if (!isPresetDerivedProject(projectData)) {
    return projectData;
  }

  let changed = false;

  const repairedWaveCircles = projectData.visualizer.waveCircles.map(
    (circle, index) => {
      const presetCircle = presetProjectData.visualizer.waveCircles[index];

      if (!presetCircle) {
        return circle;
      }

      let nextCircle = circle;

      if (
        isWhitePlaceholderColor(circle.secondaryFillColor) &&
        presetCircle.secondaryFillColor === null
      ) {
        nextCircle = {
          ...nextCircle,
          secondaryFillColor: null,
        };
      }

      if (
        isWhitePlaceholderColor(circle.secondaryLineColor) &&
        presetCircle.secondaryLineColor === null
      ) {
        nextCircle = {
          ...nextCircle,
          secondaryLineColor: null,
        };
      }

      if (nextCircle !== circle) {
        changed = true;
      }

      return nextCircle;
    },
  );

  const repairedParticles =
    typeof projectData.overlays.particles.items === "string" &&
    Array.isArray(presetProjectData.overlays.particles.items)
      ? {
          ...projectData.overlays.particles,
          items: presetProjectData.overlays.particles.items,
        }
      : projectData.overlays.particles;

  if (repairedParticles !== projectData.overlays.particles) {
    changed = true;
  }

  if (!changed) {
    return projectData;
  }

  return normalizeVideoProject({
    ...projectData,
    visualizer: {
      ...projectData.visualizer,
      waveCircles: repairedWaveCircles,
    },
    overlays: {
      ...projectData.overlays,
      particles: repairedParticles,
    },
  });
}
