"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface SavingsVaultProps {
  progress?: number; // 0 to 100
  size?: number;
  className?: string;
}

export function SavingsVault({ progress = 65, size = 180, className = "" }: SavingsVaultProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4, 14);
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

    const pct = Math.max(0.05, Math.min(1, progress / 100));

    // Outer glass cylinder cage
    const outerGeo = new THREE.CylinderGeometry(3.5, 3.5, 7, 32, 1, true);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const outerCylinder = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outerCylinder);

    // Inner liquid energy core
    const liquidHeight = 6.8 * pct;
    const liquidGeo = new THREE.CylinderGeometry(3.2, 3.2, liquidHeight, 32);
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
    });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.position.y = -3.5 + liquidHeight / 2;
    scene.add(liquidMesh);

    // Vault Base & Top Cap
    const capGeo = new THREE.CylinderGeometry(3.7, 3.7, 0.4, 32);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f1d36,
      metalness: 0.8,
      roughness: 0.3,
    });

    const topCap = new THREE.Mesh(capGeo, capMat);
    topCap.position.y = 3.6;
    scene.add(topCap);

    const bottomCap = new THREE.Mesh(capGeo, capMat);
    bottomCap.position.y = -3.6;
    scene.add(bottomCap);

    // Floating Target Ring
    const targetRingGeo = new THREE.TorusGeometry(3.9, 0.08, 16, 48);
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.8,
    });
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.y = -3.5 + 6.8 * pct;
    scene.add(targetRing);

    // Lighting
    const pointLight = new THREE.PointLight(0x00f2fe, 3, 20);
    pointLight.position.set(5, 5, 8);
    scene.add(pointLight);

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      outerCylinder.rotation.y += 0.005;
      liquidMesh.rotation.y -= 0.003;
      targetRing.rotation.z += 0.01;

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
      outerGeo.dispose();
      outerMat.dispose();
      liquidGeo.dispose();
      liquidMat.dispose();
      capGeo.dispose();
      capMat.dispose();
      targetRingGeo.dispose();
      targetRingMat.dispose();
    };
  }, [progress, size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`3D Savings Vault: ${progress}% funded`}
    />
  );
}
