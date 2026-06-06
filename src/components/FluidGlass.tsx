"use client";
import { MeshTransmissionMaterial, useFBO, useGLTF } from "@react-three/drei";
import {
  Canvas,
  createPortal,
  ThreeElements,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { easing } from "maath";
import { ReactNode, memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Mode = "lens" | "bar" | "cube";
type ModeProps = Record<string, unknown>;

type FluidGlassProps = {
  mode?: Mode;
  lensProps?: ModeProps;
  barProps?: ModeProps;
  cubeProps?: ModeProps;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  interactive?: boolean;
};

export default function FluidGlass({
  mode = "lens",
  lensProps = {},
  barProps = {},
  cubeProps = {},
  children,
  className = "",
  contentClassName = "",
  interactive = false,
}: FluidGlassProps) {
  const modeProps =
    mode === "bar" ? barProps : mode === "cube" ? cubeProps : lensProps;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        <Canvas
          camera={{ position: [0, 0, 20], fov: 15 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
        >
          <GlassScene
            mode={mode}
            modeProps={modeProps}
            interactive={interactive}
          />
        </Canvas>
      </div>
      {children && (
        <div className={`relative z-[1] ${contentClassName}`}>{children}</div>
      )}
    </div>
  );
}

type MeshProps = ThreeElements["mesh"];

type GlassSceneProps = {
  mode: Mode;
  modeProps: ModeProps;
  interactive: boolean;
};

function GlassScene({ mode, modeProps, interactive }: GlassSceneProps) {
  if (mode === "bar") {
    return (
      <ModeWrapper
        glb="/assets/3d/bar.glb"
        geometryKey="Cube"
        followPointer={false}
        modeProps={{
          transmission: 1,
          roughness: 0,
          thickness: 10,
          ior: 1.15,
          color: "#ffffff",
          attenuationColor: "#fffaf0",
          attenuationDistance: 0.22,
          scale: 0.16,
          ...modeProps,
        }}
      />
    );
  }

  if (mode === "cube") {
    return (
      <ModeWrapper
        glb="/assets/3d/cube.glb"
        geometryKey="Cube"
        followPointer={interactive}
        modeProps={modeProps}
      />
    );
  }

  return (
    <ModeWrapper
      glb="/assets/3d/lens.glb"
      geometryKey="Cylinder"
      followPointer={interactive}
      modeProps={modeProps}
    />
  );
}

type ModeWrapperProps = MeshProps & {
  glb: string;
  geometryKey: string;
  followPointer?: boolean;
  modeProps?: ModeProps;
};

const ModeWrapper = memo(function ModeWrapper({
  glb,
  geometryKey,
  followPointer = false,
  modeProps = {},
  ...props
}: ModeWrapperProps) {
  const ref = useRef<THREE.Mesh>(null);
  const { nodes } = useGLTF(glb);
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useState<THREE.Scene>(() => new THREE.Scene());
  const geoWidthRef = useRef(1);

  useEffect(() => {
    const geo = (nodes[geometryKey] as THREE.Mesh | undefined)?.geometry;
    if (!geo) return;

    geo.computeBoundingBox();
    geoWidthRef.current = geo.boundingBox
      ? geo.boundingBox.max.x - geo.boundingBox.min.x || 1
      : 1;
  }, [geometryKey, nodes]);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;

    const { camera, gl, pointer, viewport } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
    const destX = followPointer ? (pointer.x * v.width) / 2 : 0;
    const destY = followPointer ? (pointer.y * v.height) / 2 : 0;

    easing.damp3(mesh.position, [destX, destY, 15], 0.16, delta);

    if ((modeProps as { scale?: number }).scale == null) {
      mesh.scale.setScalar(Math.min(0.16, (v.width * 0.9) / geoWidthRef.current));
    }

    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  const {
    scale,
    ior,
    thickness,
    anisotropy,
    chromaticAberration,
    ...extraMat
  } = modeProps as {
    scale?: number;
    ior?: number;
    thickness?: number;
    anisotropy?: number;
    chromaticAberration?: number;
    [key: string]: unknown;
  };
  const geometry = (nodes[geometryKey] as THREE.Mesh | undefined)?.geometry;

  return (
    <>
      {createPortal(<GlassBackdrop />, scene)}
      <mesh scale={[vp.width, vp.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent opacity={0.16} />
      </mesh>
      {geometry && (
        <mesh
          ref={ref}
          scale={scale ?? 0.15}
          rotation-x={Math.PI / 2}
          geometry={geometry}
          {...props}
        >
          <MeshTransmissionMaterial
            buffer={buffer.texture}
            ior={ior ?? 1.15}
            thickness={thickness ?? 5}
            anisotropy={anisotropy ?? 0.01}
            chromaticAberration={chromaticAberration ?? 0.08}
            {...(typeof extraMat === "object" && extraMat !== null
              ? extraMat
              : {})}
          />
        </mesh>
      )}
    </>
  );
});

function GlassBackdrop() {
  const { height, width } = useThree((state) => state.viewport);

  return (
    <group>
      <mesh position={[-width * 0.24, height * 0.12, 8]}>
        <circleGeometry args={[Math.max(0.8, width * 0.16), 48]} />
        <meshBasicMaterial color="#fff2c6" transparent opacity={0.42} />
      </mesh>
      <mesh position={[width * 0.22, -height * 0.08, 8]}>
        <circleGeometry args={[Math.max(0.65, width * 0.13), 48]} />
        <meshBasicMaterial color="#c9d7ff" transparent opacity={0.32} />
      </mesh>
      <mesh position={[0, 0, 7]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

useGLTF.preload("/assets/3d/lens.glb");
useGLTF.preload("/assets/3d/bar.glb");
useGLTF.preload("/assets/3d/cube.glb");
