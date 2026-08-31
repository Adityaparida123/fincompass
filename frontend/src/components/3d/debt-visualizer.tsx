"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface DebtVisualizerProps {
  debtRatio?: number; // percentage (e.g. 25%)
  totalDebt?: number;
  monthlyEMI?: number;
  size?: number;
  className?: string;
}

export function DebtVisualizer({
  debtRatio = 25,
  size = 180,
  className = "",
}: DebtVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5, 14);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    const isHigh = debtRatio > 40;
    const isMedium = debtRatio > 25 && debtRatio <= 40;
    const ringColor = isHigh ? 0xf43f5e : isMedium ? 0xf59e0b : 0x38bdf8;

    // Stacked disc balance representation
    const group = new THREE.Group();
    const discCount = 4;
    const discs: THREE.Mesh[] = [];

    for (let i = 0; i < discCount; i++) {
      const radius = 3.8 - i * 0.45;
      const discGeo = new THREE.CylinderGeometry(radius, radius, 0.35, 32);
      const discMat = new THREE.MeshStandardMaterial({
        color: i === 0 ? ringColor : 0x0f1d36,
        emissive: i === 0 ? ringColor : 0x00f2fe,
        emissiveIntensity: i === 0 ? 0.4 : 0.1,
        metalness: 0.8,
        roughness: 0.2,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.y = -1.2 + i * 0.8;
      group.add(disc);
      discs.push(disc);
    }

    // Outer gyro orbit ring
    const gyroGeo = new THREE.TorusGeometry(4.5, 0.07, 16, 48);
    const gyroMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.6,
    });
    const gyro = new THREE.Mesh(gyroGeo, gyroMat);
    gyro.rotation.x = Math.PI / 4;
    group.add(gyro);

    scene.add(group);

    // Light
    const light = new THREE.PointLight(ringColor, 2.5, 20);
    light.position.set(4, 6, 6);
    scene.add(light);

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      group.rotation.y += 0.006;
      gyro.rotation.z += 0.01;

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
      group.children.forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) {
            c.material.forEach((m) => m.dispose());
          } else {
            c.material.dispose();
          }
        }
      });
    };
  }, [debtRatio, size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`3D Debt Weight Visualizer: ${debtRatio}% Debt-to-Income`}
    />
  );
}
