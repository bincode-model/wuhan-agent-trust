/*
 * Adapted from dashersw/liquid-glass-js/container.js, commit 78cb6ccb0b9987bb60a88b14ccbd13a9e6e8ab2a.
 * Copyright (c) 2025 Armagan Amcalar. MIT License.
 * Full license: public/licenses/liquid-glass-js-MIT.txt.
 * Changes: known wallpaper texture replaces html2canvas; the horizontal tint
 * means are computed once on CPU; the original blur footprint is approximated
 * on a 5x5 grid for whole-interface use; zero blur safely bypasses the loop.
 */
export const liquidLensVertexShader = `
attribute vec2 a_position;
varying vec2 v_coord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_coord = vec2(a_position.x * .5 + .5, .5 - a_position.y * .5);
}
`

export const liquidLensFragmentShader = `
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_origin;
uniform vec2 u_imageOrigin;
uniform vec2 u_imageSize;
uniform vec3 u_topColor;
uniform vec3 u_midColor;
uniform vec3 u_bottomColor;
uniform float u_radius;
uniform float u_edgeIntensity;
uniform float u_rimIntensity;
uniform float u_baseIntensity;
uniform float u_edgeDistance;
uniform float u_rimDistance;
uniform float u_baseDistance;
uniform float u_cornerBoost;
uniform float u_rippleEffect;
uniform float u_blurRadius;
uniform float u_tintOpacity;
uniform float u_warp;
varying vec2 v_coord;

float roundedRectDistance(vec2 coord, vec2 size, float radius) {
  vec2 center = size * .5;
  vec2 pixelCoord = coord * size;
  vec2 toCorner = abs(pixelCoord - center) - (center - radius);
  float outsideCorner = length(max(toCorner, 0.0));
  float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
  return outsideCorner + insideCorner - radius;
}
float circleDistance(vec2 coord, vec2 size, float radius) {
  return length(coord * size - size * .5) - radius;
}
bool isPill(vec2 size, float radius) {
  return abs(radius - size.y * .5) < 2.0 && size.x > size.y + 4.0;
}
bool isCircle(vec2 size, float radius) {
  return abs(radius - min(size.x, size.y) * .5) < 1.0 && abs(size.x - size.y) < 4.0;
}
vec2 capsuleClosestPoint(vec2 coord, vec2 size, float radius) {
  vec2 capsuleStart = vec2(radius, size.y * .5);
  vec2 capsuleEnd = vec2(size.x - radius, size.y * .5);
  vec2 axis = capsuleEnd - capsuleStart;
  float axisLengthSquared = dot(axis, axis);
  float t = axisLengthSquared > .0001 ? clamp(dot(coord * size - capsuleStart, axis) / axisLengthSquared, 0.0, 1.0) : .5;
  return capsuleStart + t * axis;
}
float pillDistance(vec2 coord, vec2 size, float radius) {
  return length(coord * size - capsuleClosestPoint(coord, size, radius)) - radius;
}
vec2 safeNormal(vec2 direction) {
  float size = length(direction);
  return size > .0001 ? direction / size : vec2(0.0, 1.0);
}

void main() {
  vec2 coord = v_coord;
  vec2 viewportPixel = u_origin + coord * u_resolution;
  vec2 textureCoord = (viewportPixel - u_imageOrigin) / u_imageSize;
  float maskDistance;
  vec2 shapeNormal;
  if (isPill(u_resolution, u_radius)) {
    maskDistance = pillDistance(coord, u_resolution, u_radius);
    shapeNormal = safeNormal(coord * u_resolution - capsuleClosestPoint(coord, u_resolution, u_radius));
  } else if (isCircle(u_resolution, u_radius)) {
    maskDistance = circleDistance(coord, u_resolution, u_radius);
    shapeNormal = safeNormal(coord - .5);
  } else {
    maskDistance = roundedRectDistance(coord, u_resolution, u_radius);
    shapeNormal = safeNormal(coord - .5);
  }
  float normalizedDistance = max(-maskDistance, 0.0);
  float distFromEdge = normalizedDistance / min(u_resolution.x, u_resolution.y);
  float baseIntensity = 1.0 - exp(-normalizedDistance * u_baseDistance);
  float edgeIntensity = exp(-normalizedDistance * u_edgeDistance);
  float rimIntensity = exp(-normalizedDistance * u_rimDistance);
  float baseComponent = u_warp > .5 ? baseIntensity * u_baseIntensity : 0.0;
  float totalIntensity = baseComponent + edgeIntensity * u_edgeIntensity + rimIntensity * u_rimIntensity;
  vec2 baseRefraction = shapeNormal * totalIntensity;

  float cornerProximityX = min(coord.x, 1.0 - coord.x);
  float cornerProximityY = min(coord.y, 1.0 - coord.y);
  float cornerNormalized = max(cornerProximityX, cornerProximityY) * min(u_resolution.x, u_resolution.y);
  float cornerBoost = exp(-cornerNormalized * .3) * u_cornerBoost;
  vec2 cornerRefraction = shapeNormal * cornerBoost;
  vec2 perpendicular = vec2(-shapeNormal.y, shapeNormal.x);
  float rippleEffect = sin(distFromEdge * 25.0) * u_rippleEffect * rimIntensity;
  vec2 textureRefraction = perpendicular * rippleEffect;
  textureCoord += baseRefraction + cornerRefraction + textureRefraction;

  vec3 color = vec3(0.0);
  if (u_blurRadius <= .001) {
    color = texture2D(u_image, textureCoord).rgb;
  } else {
    // Sample the upstream circular footprint on a 5x5 grid (21 live taps)
    // instead of 13x13 (113 taps), keeping the same radius/weight equations.
    float sigma = u_blurRadius / 2.0;
    vec2 blurStep = vec2(sigma) / u_imageSize;
    float totalWeight = 0.0;
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        float distanceSquared = float(i * i + j * j) * 9.0;
        if (distanceSquared <= 36.0) {
          float weight = exp(-distanceSquared / (2.0 * sigma * sigma));
          color += texture2D(u_image, textureCoord + vec2(float(i), float(j)) * 3.0 * blurStep).rgb * weight;
          totalWeight += weight;
        }
      }
    }
    color /= max(totalWeight, .00001);
  }

  // Full-surface tint remains visible in the center, as in the upstream demo.
  vec3 gradientTint = mix(vec3(1.0), vec3(.7), coord.y);
  color = mix(color, gradientTint, u_tintOpacity);
  vec3 sampledGradient;
  if (coord.y < .1) {
    sampledGradient = u_topColor;
  } else if (coord.y > .9) {
    sampledGradient = u_bottomColor;
  } else {
    float position = (coord.y - .1) / .8;
    sampledGradient = position < .5 ? mix(u_topColor, u_midColor, position * 2.0) : mix(u_midColor, u_bottomColor, (position - .5) * 2.0);
  }
  color = mix(color, sampledGradient, u_tintOpacity * .3);
  float mask = 1.0 - smoothstep(-1.0, 1.0, maskDistance);
  gl_FragColor = vec4(color, mask);
}
`
