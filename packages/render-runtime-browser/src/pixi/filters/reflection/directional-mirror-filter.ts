import { Filter } from "pixi.js";

import { defaultFilterVertex } from "../default-filter-vertex";

const fragment = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uTexture;

uniform vec4 uInputSize;
uniform vec2 uDimensions;
uniform float uBoundary;
uniform int uDirection;

void applyLeftToRightMirror() {
    vec2 pixelCoord = vTextureCoord.xy * uInputSize.xy;
    vec2 coord = pixelCoord / uDimensions;

    if (coord.x < uBoundary) {
        gl_FragColor = texture2D(uTexture, vTextureCoord);
        return;
    }

    float areaX = uBoundary * uDimensions.x / uInputSize.x;
    float mirroredX = areaX + areaX - vTextureCoord.x;
    gl_FragColor = texture2D(uTexture, vec2(mirroredX, vTextureCoord.y));
}

void applyRightToLeftMirror() {
    vec2 pixelCoord = vTextureCoord.xy * uInputSize.xy;
    vec2 coord = pixelCoord / uDimensions;

    if (coord.x > (1.0 - uBoundary)) {
        gl_FragColor = texture2D(uTexture, vTextureCoord);
        return;
    }

    float areaX = (1.0 - uBoundary) * uDimensions.x / uInputSize.x;
    float mirroredX = areaX + areaX - vTextureCoord.x;
    gl_FragColor = texture2D(uTexture, vec2(mirroredX, vTextureCoord.y));
}

void applyTopToBottomMirror() {
    vec2 pixelCoord = vTextureCoord.xy * uInputSize.xy;
    vec2 coord = pixelCoord / uDimensions;

    if (coord.y < uBoundary) {
        gl_FragColor = texture2D(uTexture, vTextureCoord);
        return;
    }

    float areaY = uBoundary * uDimensions.y / uInputSize.y;
    float mirroredY = areaY + areaY - vTextureCoord.y;
    gl_FragColor = texture2D(uTexture, vec2(vTextureCoord.x, mirroredY));
}

void applyBottomToTopMirror() {
    vec2 pixelCoord = vTextureCoord.xy * uInputSize.xy;
    vec2 coord = pixelCoord / uDimensions;

    if (coord.y > (1.0 - uBoundary)) {
        gl_FragColor = texture2D(uTexture, vTextureCoord);
        return;
    }

    float areaY = (1.0 - uBoundary) * uDimensions.y / uInputSize.y;
    float mirroredY = areaY + areaY - vTextureCoord.y;
    gl_FragColor = texture2D(uTexture, vec2(vTextureCoord.x, mirroredY));
}

void main(void) {
    if (uDirection == 1) {
        applyLeftToRightMirror();
    } else if (uDirection == 3) {
        applyRightToLeftMirror();
    } else if (uDirection == 0) {
        applyTopToBottomMirror();
    } else if (uDirection == 2) {
        applyBottomToTopMirror();
    } else {
        gl_FragColor = texture2D(uTexture, vTextureCoord);
    }
}
`;

type DirectionalMirrorUniforms = {
  uBoundary: number;
  uDirection: number;
  uDimensions: Float32Array;
};

type DirectionalMirrorUniformGroup = {
  uniforms: DirectionalMirrorUniforms;
  update(): void;
};

export type DirectionalMirrorFilterInstance = Filter & {
  resources: {
    directionalMirrorUniforms: DirectionalMirrorUniformGroup;
  };
};

export function createDirectionalMirrorFilter() {
  return Filter.from({
    gl: {
      fragment,
      name: "spectral-directional-mirror-filter",
      vertex: defaultFilterVertex,
    },
    resources: {
      directionalMirrorUniforms: {
        uBoundary: { value: 0.5, type: "f32" },
        uDirection: { value: 1, type: "i32" },
        uDimensions: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
      },
    },
  }) as DirectionalMirrorFilterInstance;
}

export function updateDirectionalMirrorFilter(
  filter: DirectionalMirrorFilterInstance,
  input: {
    boundary: number;
    direction: number;
    enabled: boolean;
    height: number;
    width: number;
  },
) {
  const uniformGroup = filter.resources.directionalMirrorUniforms;
  const uniforms = uniformGroup.uniforms;

  filter.enabled = input.enabled;
  uniforms.uBoundary = input.boundary;
  uniforms.uDirection = input.direction;
  uniforms.uDimensions[0] = input.width;
  uniforms.uDimensions[1] = input.height;
  uniformGroup.update();
}
