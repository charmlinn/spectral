import { Filter } from "pixi.js";

const defaultVertex = `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const fragment = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uHue;
uniform float uAlpha;
uniform float uColorize;
uniform float uSaturation;
uniform float uLightness;

const vec3 weight = vec3(0.299, 0.587, 0.114);
const vec3 k = vec3(0.57735, 0.57735, 0.57735);

float getWeightedAverage(vec3 rgb) {
    return rgb.r * weight.r + rgb.g * weight.g + rgb.b * weight.b;
}

vec3 hueShift(vec3 color, float angle) {
    float cosAngle = cos(angle);
    return vec3(
      color * cosAngle +
      cross(k, color) * sin(angle) +
      k * dot(k, color) * (1.0 - cosAngle)
    );
}

void main() {
    vec4 color = texture2D(uTexture, vTextureCoord);
    vec4 result = color;

    if (uColorize > 0.5) {
        result.rgb = vec3(getWeightedAverage(result.rgb), 0., 0.);
    }

    result.rgb = hueShift(result.rgb, uHue);

    float average = (result.r + result.g + result.b) / 3.0;

    if (uSaturation > 0.) {
        result.rgb += (average - result.rgb) * (1. - 1. / (1.001 - uSaturation));
    } else {
        result.rgb -= (average - result.rgb) * uSaturation;
    }

    result.rgb = mix(result.rgb, vec3(ceil(uLightness)) * color.a, abs(uLightness));
    gl_FragColor = mix(color, result, uAlpha);
}
`;

type HslUniforms = {
  uAlpha: number;
  uColorize: number;
  uHue: number;
  uLightness: number;
  uSaturation: number;
};

type HslUniformGroup = {
  uniforms: HslUniforms;
  update(): void;
};

type HslAdjustmentFilterInstance = Filter & {
  resources: {
    hslUniforms: HslUniformGroup;
  };
};

export function createHslAdjustmentFilter() {
  return Filter.from({
    gl: {
      fragment,
      name: "spectral-hsl-adjustment-filter",
      vertex: defaultVertex,
    },
    resources: {
      hslUniforms: {
        uAlpha: { value: 1, type: "f32" },
        uColorize: { value: 0, type: "f32" },
        uHue: { value: 0, type: "f32" },
        uLightness: { value: 0, type: "f32" },
        uSaturation: { value: 0, type: "f32" },
      },
    },
  }) as HslAdjustmentFilterInstance;
}

export function updateHslAdjustmentFilter(
  filter: HslAdjustmentFilterInstance,
  input: {
    alpha: number;
    colorize: boolean;
    hue: number;
    lightness: number;
    saturation: number;
  },
) {
  const uniformGroup = filter.resources.hslUniforms;
  const uniforms = uniformGroup.uniforms;

  filter.enabled =
    input.alpha > 0 ||
    input.colorize ||
    input.hue !== 0 ||
    input.lightness !== 0 ||
    input.saturation !== 0;
  uniforms.uHue = (input.hue * Math.PI) / 180;
  uniforms.uAlpha = input.alpha;
  uniforms.uColorize = input.colorize ? 1 : 0;
  uniforms.uLightness = input.lightness;
  uniforms.uSaturation = input.saturation;
  uniformGroup.update();
}
