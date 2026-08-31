"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface FinancialGlobeProps {
  size?: number;
  className?: string;
}

export function FinancialGlobe({ size = 200, className = "" }: FinancialGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 15);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // Globe core
    const coreGeo = new THREE.SphereGeometry(4.6, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x07111e,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Wireframe grid sphere
    const wireGeo = new THREE.SphereGeometry(4.8, 18, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // Institutional Node points on sphere
    const nodeCount = 12;
    const nodeGroup = new THREE.Group();
    for (let i = 0; i < nodeCount; i++) {
      const lat = (Math.random() - 0.5) * Math.PI;
      const lon = Math.random() * Math.PI * 2;
      const r = 4.85;

      const nodeGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const nodeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const node = new THREE.Mesh(nodeGeo, nodeMat);

      node.position.set(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon)
      );
      nodeGroup.add(node);
    }
    scene.add(nodeGroup);

    // Outer orbital halo
    const haloGeo = new THREE.TorusGeometry(6.2, 0.05, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.5,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 3;
    scene.add(halo);

    // Light
    const light = new THREE.PointLight(0x00f2fe, 3, 25);
    light.position.set(8, 8, 10);
    scene.add(light);

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      core.rotation.y += 0.003;
      wire.rotation.y += 0.003;
      nodeGroup.rotation.y += 0.003;
      halo.rotation.z += 0.006;

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
      wireGeo.dispose();
      wireMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      nodeGroup.children.forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      });
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="3D Financial Globe"
    />
  );
}
