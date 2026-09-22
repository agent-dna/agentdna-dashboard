import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

function Orb({ position, color, size }: { position: [number, number, number]; color: string; size: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const speed = useMemo(() => Math.random() * 0.5 + 0.2, []);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    meshRef.current.position.y = position[1] + Math.sin(t) * 0.5;
    meshRef.current.position.x = position[0] + Math.cos(t * 0.7) * 0.3;
    meshRef.current.rotation.x += 0.01;
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <icosahedronGeometry args={[size, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.6}
        roughness={0.3}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

function Scene() {
  const orbs = useMemo(() => [
    { position: [-3, 2, -5] as [number, number, number], color: '#2563EB', size: 0.6 },
    { position: [3, -1, -8] as [number, number, number], color: '#7C3AED', size: 0.8 },
    { position: [-2, -2, -6] as [number, number, number], color: '#0EA5E9', size: 0.5 },
    { position: [2, 3, -7] as [number, number, number], color: '#6366F1', size: 0.7 },
    { position: [0, 0, -9] as [number, number, number], color: '#8B5CF6', size: 0.4 },
    { position: [-4, 0, -10] as [number, number, number], color: '#3B82F6', size: 0.6 },
    { position: [4, 1, -6] as [number, number, number], color: '#4F46E5', size: 0.5 },
  ], []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#7C3AED" />
      {orbs.map((orb, i) => (
        <Orb key={i} {...orb} />
      ))}
    </>
  );
}

export function FloatingOrbs() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none',
      opacity: 0.4,
    }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
