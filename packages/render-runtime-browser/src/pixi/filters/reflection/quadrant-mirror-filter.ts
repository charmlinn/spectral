import { Filter } from "pixi.js";

import { defaultFilterVertex } from "../default-filter-vertex";

const fragment = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uTexture;

uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec2 uDimensions;
uniform float uEnableLeftPart;
uniform float uEnableRightPart;
uniform float uEnableTopPart;
uniform float uEnableBottomPart;

void main(void)
{
    vec2 pixelCoord = vTextureCoord.xy * uInputSize.xy;
    vec2 normalizedCoord = pixelCoord / uDimensions;
    vec2 uv = vTextureCoord;
    bool isRightHalf = normalizedCoord.x > 0.5;
    bool isBottomHalf = normalizedCoord.y > 0.5;

    if (isRightHalf && uEnableLeftPart > 0.5) {
        float centerX = 0.5 * uDimensions.x / uInputSize.x;
        uv.x = centerX + centerX - vTextureCoord.x;
    } else if (!isRightHalf && uEnableRightPart > 0.5) {
        float centerX = 0.5 * uDimensions.x / uInputSize.x;
        uv.x = centerX + centerX - vTextureCoord.x;
    }

    if (isBottomHalf && uEnableTopPart > 0.5) {
        float centerY = 0.5 * uDimensions.y / uInputSize.y;
        uv.y = centerY + centerY - vTextureCoord.y;
    } else if (!isBottomHalf && uEnableBottomPart > 0.5) {
        float centerY = 0.5 * uDimensions.y / uInputSize.y;
        uv.y = centerY + centerY - vTextureCoord.y;
    }

    gl_FragColor = texture2D(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw));
}
`;

export type QuadrantMirrorFilterInstance = Filter & {
  resources: {
    quadrantMirrorUniforms: {
      uDimensions: Float32Array;
      uEnableBottomPart: number;
      uEnableLeftPart: number;
      uEnableRightPart: number;
      uEnableTopPart: number;
    };
  };
};

export function createQuadrantMirrorFilter() {
  return Filter.from({
    gl: {
      fragment,
      name: "spectral-quadrant-mirror-filter",
      vertex: defaultFilterVertex,
    },
    resources: {
      quadrantMirrorUniforms: {
        uDimensions: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        uEnableBottomPart: { value: 0, type: "f32" },
        uEnableLeftPart: { value: 0, type: "f32" },
        uEnableRightPart: { value: 0, type: "f32" },
        uEnableTopPart: { value: 0, type: "f32" },
      },
    },
  }) as QuadrantMirrorFilterInstance;
}

export function updateQuadrantMirrorFilter(
  filter: QuadrantMirrorFilterInstance,
  input: {
    direction: number;
    enabled: boolean;
    height: number;
    width: number;
  },
) {
  filter.enabled = input.enabled;
  filter.resources.quadrantMirrorUniforms.uDimensions[0] = input.width;
  filter.resources.quadrantMirrorUniforms.uDimensions[1] = input.height;
  filter.resources.quadrantMirrorUniforms.uEnableLeftPart = 0;
  filter.resources.quadrantMirrorUniforms.uEnableRightPart = 0;
  filter.resources.quadrantMirrorUniforms.uEnableTopPart = 0;
  filter.resources.quadrantMirrorUniforms.uEnableBottomPart = 0;

  if (input.direction === 1) {
    filter.resources.quadrantMirrorUniforms.uEnableRightPart = 1;
    filter.resources.quadrantMirrorUniforms.uEnableTopPart = 1;
    return;
  }

  if (input.direction === 0) {
    filter.resources.quadrantMirrorUniforms.uEnableLeftPart = 1;
    filter.resources.quadrantMirrorUniforms.uEnableTopPart = 1;
    return;
  }

  if (input.direction === 2) {
    filter.resources.quadrantMirrorUniforms.uEnableRightPart = 1;
    filter.resources.quadrantMirrorUniforms.uEnableBottomPart = 1;
    return;
  }

  if (input.direction === 3) {
    filter.resources.quadrantMirrorUniforms.uEnableLeftPart = 1;
    filter.resources.quadrantMirrorUniforms.uEnableBottomPart = 1;
  }
}
