"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface FinancialOrbProps {
  status?: "good" | "stable" | "attention" | "nodata";
  score?: number;
  size?: number;
  className?: string;
}

export function FinancialOrb({
  status = "stable",
  score,
  size = 200,
  className = "",
}: FinancialOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 24;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // Color mapping by financial health status
    const statusColors = {
      good: { primary: 0x00f2fe, secondary: 0x10b981, core: 0x022026 },
      stable: { primary: 0x38bdf8, secondary: 0xf59e0b, core: 0x0d1b2a },
      attention: { primary: 0xf43f5e, secondary: 0xfb923c, core: 0x270711 },
      nodata: { primary: 0x64748b, secondary: 0x00f2fe, core: 0x0b1324 },
    };

    const config = statusColors[status] || statusColors.stable;

    // Outer wireframe orb
    const outerGeo = new THREE.IcosahedronGeometry(7, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: config.primary,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outerMesh);

    // Inner glowing sphere
    const innerGeo = new THREE.SphereGeometry(4.8, 24, 24);
    const innerMat = new THREE.MeshStandardMaterial({
      color: config.core,
      emissive: config.primary,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.8,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    // Orbital ring 1 (horizontal / tilted)
    const ring1Geo = new THREE.TorusGeometry(8.5, 0.08, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: config.primary,
      transparent: true,
      opacity: 0.7,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    // Orbital ring 2 (tilted other way)
    const ring2Geo = new THREE.TorusGeometry(9.2, 0.06, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: config.secondary,
      transparent: true,
      opacity: 0.5,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 6;
    scene.add(ring2);

    // Satellite node on orbital ring
    const satGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const satMat = new THREE.MeshBasicMaterial({ color: config.secondary });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    scene.add(satMesh);

    // Orbiting particle cloud
    const pCount = 70;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const radius = 6.5 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = radius * Math.cos(phi);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: config.primary,
      size: 0.4,
      transparent: true,
      opacity: 0.8,
    });
    const particleCloud = new THREE.Points(pGeo, pMat);
    scene.add(particleCloud);

    // Subtle lighting
    const pointLight = new THREE.PointLight(config.primary, 2, 40);
    pointLight.position.set(10, 10, 15);
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    let animationFrameId: number;
    let angle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      angle += 0.015;

      outerMesh.rotation.y += 0.005;
      outerMesh.rotation.x += 0.002;

      innerMesh.rotation.y -= 0.003;

      ring1.rotation.z += 0.008;
      ring2.rotation.z -= 0.006;
      particleCloud.rotation.y += 0.004;

      // Satellite position along ring
      satMesh.position.x = Math.cos(angle) * 8.5;
      satMesh.position.y = Math.sin(angle) * 8.5 * Math.cos(Math.PI / 3);
      satMesh.position.z = Math.sin(angle) * 8.5 * Math.sin(Math.PI / 3);

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
      outerGeo.dispose();
      outerMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      satGeo.dispose();
      satMat.dispose();
      pGeo.dispose();
      pMat.dispose();
    };
  }, [status, size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`3D Financial Health Indicator: ${status}${score ? `, Score: ${score}` : ""}`}
    />
  );
}
