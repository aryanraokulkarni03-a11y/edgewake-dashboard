'use client';

import { useCallback, useEffect, useRef } from 'react';

type LiveWaveformProps = {
  isConnected: boolean;
  level: number;
};

type WaveBar = { level: number; x: number };

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_STEP = BAR_WIDTH + BAR_GAP;
const BAR_SPEED = 96;
const EDGE_FADE_WIDTH = 28;
const MINIMUM_LEVEL = 0.035;

export function LiveWaveform({ isConnected, level }: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<WaveBar[]>([]);
  const targetLevelRef = useRef(0);
  const displayedLevelRef = useRef(0);
  const lastPaintRef = useRef(0);
  const canvasMetricsRef = useRef({ width: 0, height: 0, pixelRatio: 1 });
  const canvasColorRef = useRef('#4f63d8');
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number | null>(null);
  const isConnectedRef = useRef(isConnected);

  const syncCanvasTheme = useCallback(() => {
    const styles = getComputedStyle(document.documentElement);
    canvasColorRef.current =
      styles.getPropertyValue('--wave-accent').trim() || '#4f63d8';
  }, []);

  const paint = useCallback((timestamp = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height, pixelRatio } = canvasMetricsRef.current;
    if (!width || !height) return;

    const context = canvasContextRef.current ?? canvas.getContext('2d');
    if (!context) return;
    canvasContextRef.current = context;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!isConnectedRef.current) return;

    const deltaSeconds = Math.min(
      0.05,
      lastPaintRef.current ? (timestamp - lastPaintRef.current) / 1000 : 0,
    );
    lastPaintRef.current = timestamp;

    const responseRate =
      targetLevelRef.current > displayedLevelRef.current ? 42 : 14;
    const smoothing = 1 - Math.exp(-responseRate * deltaSeconds);
    displayedLevelRef.current +=
      (targetLevelRef.current - displayedLevelRef.current) * smoothing;

    if (!barsRef.current.length) {
      for (let x = -BAR_STEP; x < width + BAR_STEP; x += BAR_STEP) {
        barsRef.current.push({ level: MINIMUM_LEVEL, x });
      }
    }

    for (const bar of barsRef.current) bar.x -= BAR_SPEED * deltaSeconds;
    barsRef.current = barsRef.current.filter(
      (bar) => bar.x + BAR_WIDTH > -BAR_STEP,
    );

    while (
      !barsRef.current.length ||
      barsRef.current[barsRef.current.length - 1].x < width
    ) {
      const lastBar = barsRef.current[barsRef.current.length - 1];
      barsRef.current.push({
        level: Math.max(MINIMUM_LEVEL, displayedLevelRef.current),
        x: lastBar ? lastBar.x + BAR_STEP : width,
      });
    }

    context.fillStyle = canvasColorRef.current;
    for (const bar of barsRef.current) {
      if (bar.x >= width || bar.x + BAR_WIDTH <= 0) continue;
      const barHeight = Math.max(3, bar.level * height * 0.54);
      context.globalAlpha = 0.28 + bar.level * 0.72;
      context.beginPath();
      context.roundRect(
        bar.x,
        (height - barHeight) / 2,
        BAR_WIDTH,
        barHeight,
        2,
      );
      context.fill();
    }

    const fadeWidth = Math.min(EDGE_FADE_WIDTH, width * 0.16);
    const edgeFade = context.createLinearGradient(0, 0, width, 0);
    edgeFade.addColorStop(0, 'rgb(0 0 0)');
    edgeFade.addColorStop(fadeWidth / width, 'rgb(0 0 0 / 0)');
    edgeFade.addColorStop(1 - fadeWidth / width, 'rgb(0 0 0 / 0)');
    edgeFade.addColorStop(1, 'rgb(0 0 0)');
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = edgeFade;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
  }, []);

  useEffect(() => {
    targetLevelRef.current = level;
  }, [level]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
    if (!isConnected) {
      barsRef.current = [];
      targetLevelRef.current = 0;
      displayedLevelRef.current = 0;
      lastPaintRef.current = 0;
    }
    paint();
  }, [isConnected, paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      const pixelRatio = window.devicePixelRatio || 1;
      canvasMetricsRef.current = { width, height, pixelRatio };
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      barsRef.current = [];
      paint();
    };
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    const refreshCanvasTheme = () => {
      syncCanvasTheme();
      paint();
    };
    refreshCanvasTheme();
    window.addEventListener('edgewake-theme-change', refreshCanvasTheme);

    return () =>
      window.removeEventListener('edgewake-theme-change', refreshCanvasTheme);
  }, [paint, syncCanvasTheme]);

  useEffect(() => {
    if (!isConnected) return;

    const drawLoop = (timestamp: number) => {
      paint(timestamp);
      animationRef.current = requestAnimationFrame(drawLoop);
    };

    animationRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [isConnected, paint]);

  return <canvas aria-hidden="true" className="edge-wave-canvas" ref={canvasRef} />;
}
