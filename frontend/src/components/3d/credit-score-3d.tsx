"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface CreditScore3DProps {
  score: number;
  maxScore?: number;
  size?: number;
  className?: string;
}

export function CreditScore3D({
  score,
  maxScore = 100,
  size = 220,
  className = "",
}: CreditScore3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 18);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    const percentage = Math.max(0, Math.min(1, score / maxScore));

    // Gauge color determination
    let arcColor = 0x00f2fe;
    if (percentage >= 0.75) arcColor = 0x10b981;
    else if (percentage >= 0.5) arcColor = 0x38bdf8;
    else if (percentage >= 0.35) arcColor = 0xf59e0b;
    else arcColor = 0xf43f5e;

    // Background track arc (240 degrees)
    const startAngle = (Math.PI * 3) / 4;
    const totalAngle = (Math.PI * 3) / 2;
    const bgArcGeo = new THREE.RingGeometry(6.2, 7.0, 48, 1, startAngle, totalAngle);
    const bgArcMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const bgArc = new THREE.Mesh(bgArcGeo, bgArcMat);
    scene.add(bgArc);

    // Active illuminated score arc
    const activeAngle = totalAngle * percentage;
    const activeArcGeo = new THREE.RingGeometry(6.0, 7.2, 48, 1, startAngle, activeAngle);
    const activeArcMat = new THREE.MeshBasicMaterial({
      color: arcColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const activeArc = new THREE.Mesh(activeArcGeo, activeArcMat);
    scene.add(activeArc);

    // Indicator head node
    const headAngle = startAngle + activeAngle;
    const headRadius = 6.6;
    const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(Math.cos(headAngle) * headRadius, Math.sin(headAngle) * headRadius, 0.2);
    scene.add(headMesh);

    // Subtle inner glowing ring
    const innerRingGeo = new THREE.TorusGeometry(5.2, 0.05, 16, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: arcColor,
      transparent: true,
      opacity: 0.35,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    scene.add(innerRing);

    // Center pivot disc
    const pivotGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.2, 32);
    const pivotMat = new THREE.MeshStandardMaterial({
      color: 0x060d1b,
      emissive: arcColor,
      emissiveIntensity: 0.15,
      metalness: 0.8,
      roughness: 0.2,
    });
    const pivotMesh = new THREE.Mesh(pivotGeo, pivotMat);
    pivotMesh.rotation.x = Math.PI / 2;
    scene.add(pivotMesh);

    // Light
    const pointLight = new THREE.PointLight(arcColor, 2.5, 20);
    pointLight.position.set(0, 0, 8);
    scene.add(pointLight);

    let frameId: number;
    let wobble = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      wobble += 0.02;

      // Subtle dynamic 3D tilt
      scene.rotation.y = Math.sin(wobble * 0.5) * 0.08;
      scene.rotation.x = Math.cos(wobble * 0.4) * 0.05;

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix;
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
      bgArcGeo.dispose();
      bgArcMat.dispose();
      activeArcGeo.dispose();
      activeArcMat.dispose();
      headGeo.dispose();
      headMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      pivotGeo.dispose();
      pivotMat.dispose();
    };
  }, [score, maxScore, size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Credit Readiness Score Gauge: ${score} of ${maxScore}`}
    />
  );
}
