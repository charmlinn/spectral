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

type QuadrantMirrorUniforms = {
  uDimensions: Float32Array;
  uEnableBottomPart: number;
  uEnableLeftPart: number;
  uEnableRightPart: number;
  uEnableTopPart: number;
};

type QuadrantMirrorUniformGroup = {
  uniforms: QuadrantMirrorUniforms;
  update(): void;
};

export type QuadrantMirrorFilterInstance = Filter & {
  resources: {
    quadrantMirrorUniforms: QuadrantMirrorUniformGroup;
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
  const uniformGroup = filter.resources.quadrantMirrorUniforms;
  const uniforms = uniformGroup.uniforms;

  filter.enabled = input.enabled;
  uniforms.uDimensions[0] = input.width;
  uniforms.uDimensions[1] = input.height;
  uniforms.uEnableLeftPart = 0;
  uniforms.uEnableRightPart = 0;
  uniforms.uEnableTopPart = 0;
  uniforms.uEnableBottomPart = 0;

  if (input.direction === 1) {
    uniforms.uEnableRightPart = 1;
    uniforms.uEnableTopPart = 1;
    uniformGroup.update();
    return;
  }

  if (input.direction === 0) {
    uniforms.uEnableLeftPart = 1;
    uniforms.uEnableTopPart = 1;
    uniformGroup.update();
    return;
  }

  if (input.direction === 2) {
    uniforms.uEnableRightPart = 1;
    uniforms.uEnableBottomPart = 1;
    uniformGroup.update();
    return;
  }

  if (input.direction === 3) {
    uniforms.uEnableLeftPart = 1;
    uniforms.uEnableBottomPart = 1;
  }

  uniformGroup.update();
}
