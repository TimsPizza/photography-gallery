"use client";

import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

export type RaysOrigin =
  | "top-center"
  | "top-left"
  | "top-right"
  | "right"
  | "left"
  | "bottom-center"
  | "bottom-right"
  | "bottom-left";

type LightRaysProps = {
  raysOrigin?: RaysOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  className?: string;
};

type Vec2 = [number, number];
type Vec3 = [number, number, number];

type Uniforms = {
  iTime: { value: number };
  iResolution: { value: Vec2 };
  rayPos: { value: Vec2 };
  rayDir: { value: Vec2 };
  raysColor: { value: Vec3 };
  raysSpeed: { value: number };
  lightSpread: { value: number };
  rayLength: { value: number };
  pulsating: { value: number };
  fadeDistance: { value: number };
  saturation: { value: number };
  mousePos: { value: Vec2 };
  mouseInfluence: { value: number };
  noiseAmount: { value: number };
  distortion: { value: number };
};

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(
  vec2 raySource,
  vec2 rayRefDirection,
  vec2 coord,
  float seedA,
  float seedB,
  float speed
) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle =
    cosAngle +
    distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor =
    pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff =
    clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeRange = max(iResolution.x * fadeDistance, 0.001);
  float fadeFalloff =
    clamp((fadeRange - distance) / fadeRange, 0.35, 1.0);
  float pulse =
    pulsating > 0.5 ? 0.82 + 0.18 * sin(iTime * speed * 3.0) : 1.0;
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0,
    1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
  vec2 finalRayDir = rayDir;

  if (mouseInfluence > 0.0) {
    vec2 mouseDirection = normalize(mousePos * iResolution.xy - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  float rays =
    rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed) * 0.5 +
    rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed) * 0.4;

  if (noiseAmount > 0.0) {
    float grain = noise(coord * 0.01 + iTime * 0.1);
    rays *= 1.0 - noiseAmount + noiseAmount * grain;
  }

  float brightness = 1.0 - coord.y / iResolution.y;
  vec3 color = raysColor * rays;
  color.r *= 0.22 + brightness * 0.78;
  color.g *= 0.38 + brightness * 0.62;
  color.b *= 0.58 + brightness * 0.42;

  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, saturation);

  gl_FragColor = vec4(color, clamp(rays * 0.86, 0.0, 0.86));
}
`;

function hexToRgb(hex: string): Vec3 {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [1, 1, 1];

  return [
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255,
  ];
}

function getAnchorAndDirection(
  origin: RaysOrigin,
  width: number,
  height: number,
): { anchor: Vec2; direction: Vec2 } {
  const outside = 0.2;

  switch (origin) {
    case "top-left":
      return { anchor: [0, -outside * height], direction: [0, 1] };
    case "top-right":
      return { anchor: [width, -outside * height], direction: [0, 1] };
    case "left":
      return {
        anchor: [-outside * width, height * 0.5],
        direction: [1, 0],
      };
    case "right":
      return {
        anchor: [(1 + outside) * width, height * 0.5],
        direction: [-1, 0],
      };
    case "bottom-left":
      return {
        anchor: [0, (1 + outside) * height],
        direction: [0, -1],
      };
    case "bottom-center":
      return {
        anchor: [width * 0.5, (1 + outside) * height],
        direction: [0, -1],
      };
    case "bottom-right":
      return {
        anchor: [width, (1 + outside) * height],
        direction: [0, -1],
      };
    default:
      return {
        anchor: [width * 0.5, -outside * height],
        direction: [0, 1],
      };
  }
}

export default function LightRays({
  raysOrigin = "top-center",
  raysColor = "#ffffff",
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0,
  distortion = 0,
  className = "",
}: LightRaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new Renderer({
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    const gl = renderer.gl;
    const geometry = new Triangle(gl);
    const mouse = { x: 0.5, y: 0.5 };
    const smoothMouse = { x: 0.5, y: 0.5 };
    let animationFrame: number | null = null;
    let visible = false;

    gl.clearColor(0, 0, 0, 0);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    container.replaceChildren(gl.canvas);

    const uniforms: Uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(raysColor) },
      raysSpeed: { value: raysSpeed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1 : 0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: mouseInfluence },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },
    };
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);

      const pixelWidth = width * renderer.dpr;
      const pixelHeight = height * renderer.dpr;
      const placement = getAnchorAndDirection(
        raysOrigin,
        pixelWidth,
        pixelHeight,
      );
      uniforms.iResolution.value = [pixelWidth, pixelHeight];
      uniforms.rayPos.value = placement.anchor;
      uniforms.rayDir.value = placement.direction;
    };

    const render = (time: number) => {
      if (!visible) return;

      uniforms.iTime.value = time * 0.001;
      if (followMouse && mouseInfluence > 0) {
        const smoothing = 0.92;
        smoothMouse.x =
          smoothMouse.x * smoothing + mouse.x * (1 - smoothing);
        smoothMouse.y =
          smoothMouse.y * smoothing + mouse.y * (1 - smoothing);
        uniforms.mousePos.value = [smoothMouse.x, smoothMouse.y];
      }
      renderer.render({ scene: mesh });

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    const start = () => {
      visible = true;
      if (animationFrame !== null) return;
      animationFrame = requestAnimationFrame((time) => {
        animationFrame = null;
        render(time);
      });
    };

    const stop = () => {
      visible = false;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      mouse.x = (event.clientX - rect.left) / rect.width;
      mouse.y = (event.clientY - rect.top) / rect.height;
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { rootMargin: "120px 0px", threshold: 0.01 },
    );

    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    if (followMouse) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
    }
    resize();
    renderer.render({ scene: mesh });

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      geometry.remove();
      program.remove();
      const loseContext = gl.getExtension("WEBGL_lose_context");
      loseContext?.loseContext();
      gl.canvas.remove();
    };
  }, [
    distortion,
    fadeDistance,
    followMouse,
    lightSpread,
    mouseInfluence,
    noiseAmount,
    pulsating,
    rayLength,
    raysColor,
    raysOrigin,
    raysSpeed,
    saturation,
  ]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none h-full w-full overflow-hidden ${className}`.trim()}
      ref={containerRef}
    />
  );
}
