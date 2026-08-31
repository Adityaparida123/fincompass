"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface CashFlowStreamProps {
  income?: number;
  expenses?: number;
  netFlow?: number;
  height?: number;
  className?: string;
}

export function CashFlowStream({
  income = 100000,
  expenses = 60000,
  netFlow = 40000,
  height = 160,
  className = "",
}: CashFlowStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 16);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // Two dual energy wave streams (Income = Cyan upward, Expense = Indigo downward)
    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);
    const streamTypes = new Float32Array(particleCount); // 0 = income, 1 = expense

    const cyan = new THREE.Color("#00f2fe");
    const indigo = new THREE.Color("#818cf8");

    for (let i = 0; i < particleCount; i++) {
      const isIncome = i % 2 === 0;
      streamTypes[i] = isIncome ? 0 : 1;
      speeds[i] = 0.05 + Math.random() * 0.05;

      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

      const col = isIncome ? cyan : indigo;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const stream = new THREE.Points(geometry, material);
    scene.add(stream);

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const pos = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const isIncome = streamTypes[i] === 0;
        if (isIncome) {
          pos[i * 3 + 1] += speeds[i]; // Move upward
          if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] = -4.5;
        } else {
          pos[i * 3 + 1] -= speeds[i]; // Move downward
          if (pos[i * 3 + 1] < -4.5) pos[i * 3 + 1] = 4.5;
        }

        // Horizontal sinusoidal wave
        pos[i * 3] += Math.sin(pos[i * 3 + 1] * 1.2) * 0.02;
      }
      geometry.attributes.position.needsUpdate = true;

      stream.rotation.y += 0.003;

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
      geometry.dispose();
      material.dispose();
    };
  }, [income, expenses, netFlow, height]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
      role="img"
      aria-label="3D Cash Flow Visualizer"
    />
  );
}
