"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface AIOrbProps {
  thinking?: boolean;
  size?: number;
  className?: string;
}

export function AIOrb({ thinking = false, size = 120, className = "" }: AIOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 12;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // Core neural mesh
    const coreGeo = new THREE.IcosahedronGeometry(2.4, 3);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x03182b,
      emissive: 0x00f2fe,
      emissiveIntensity: thinking ? 0.9 : 0.45,
      roughness: 0.2,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Wireframe halo
    const haloGeo = new THREE.IcosahedronGeometry(3.2, 1);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    scene.add(haloMesh);

    // Neural node points
    const pCount = 36;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 3.6 + Math.random() * 0.8;
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xa855f7,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    const neuralPoints = new THREE.Points(pGeo, pMat);
    scene.add(neuralPoints);

    // Lights
    const light1 = new THREE.PointLight(0x00f2fe, 3, 20);
    light1.position.set(5, 5, 5);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xa855f7, 2, 20);
    light2.position.set(-5, -5, -5);
    scene.add(light2);

    let frameId: number;
    let clock = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      clock += 0.02;
      const speed = thinking ? 0.03 : 0.008;

      coreMesh.rotation.y += speed;
      coreMesh.rotation.x += speed * 0.6;
      haloMesh.rotation.y -= speed * 0.8;
      haloMesh.rotation.z += speed * 0.5;
      neuralPoints.rotation.y += speed * 1.2;

      // Breathing pulse scale
      const scale = 1 + Math.sin(clock * (thinking ? 4 : 2)) * 0.05;
      coreMesh.scale.set(scale, scale, scale);

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
      coreGeo.dispose();
      coreMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      pGeo.dispose();
      pMat.dispose();
    };
  }, [thinking, size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="FinAI Neural Core"
    />
  );
}
