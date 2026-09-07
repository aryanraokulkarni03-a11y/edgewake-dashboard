'use client';

import { Mic, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type MicrophoneState = 'idle' | 'starting' | 'active' | 'error';
type WorkletEnvelope = { endTime: number; values: Int16Array };
type WaveBar = { level: number; x: number };

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_STEP = BAR_WIDTH + BAR_GAP;
const BAR_SPEED = 96;
const EDGE_FADE_WIDTH = 28;
const MINIMUM_LEVEL = 0.035;
const fromQ15 = (value: number) => (value < 0 ? value / 32768 : value / 32767);

export function LiveWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<WaveBar[]>([]);
  const targetLevelRef = useRef(0);
  const displayedLevelRef = useRef(0);
  const lastPaintRef = useRef(0);
  const canvasMetricsRef = useRef({ width: 0, height: 0, pixelRatio: 1 });
  const canvasColorRef = useRef('#4f63d8');
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<{
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: AudioWorkletNode;
    silentGain: GainNode;
  } | null>(null);
  const [microphoneState, setMicrophoneState] =
    useState<MicrophoneState>('idle');
  const [message, setMessage] = useState('');

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
    if (!audioRef.current) return;

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

  const releaseMicrophone = useCallback(
    (resetInterface = true) => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      barsRef.current = [];
      targetLevelRef.current = 0;
      displayedLevelRef.current = 0;
      lastPaintRef.current = 0;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const audio = audioRef.current;
      if (audio) {
        audio.processor.port.onmessage = null;
        audio.source.disconnect();
        audio.processor.disconnect();
        audio.silentGain.disconnect();
        void audio.context.close();
        audioRef.current = null;
      }

      if (resetInterface) {
        setMicrophoneState('idle');
        setMessage('');
        requestAnimationFrame(paint);
      }
    },
    [paint],
  );

  const enableMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setMicrophoneState('error');
      setMessage('Microphone access is unavailable in this browser context.');
      return;
    }

    setMicrophoneState('starting');
    setMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const context = new AudioContext();
      await context.audioWorklet.addModule(
        '/worklets/pcm-envelope-processor.js',
      );

      const source = context.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(context, 'pcm-envelope');
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      audioRef.current = { context, source, processor, silentGain };
      processor.port.onmessage = ({ data }: MessageEvent<WorkletEnvelope>) => {
        if (
          !(data?.values instanceof Int16Array) ||
          !Number.isFinite(data.endTime)
        )
          return;

        let peak = 0;
        for (const value of data.values)
          peak = Math.max(peak, Math.abs(fromQ15(value)));
        targetLevelRef.current = Math.min(1, Math.pow(peak, 0.62) * 1.7);
      };
      source
        .connect(processor)
        .connect(silentGain)
        .connect(context.destination);
      await context.resume();

      setMicrophoneState('active');
      setMessage('Audio remains in this browser.');
    } catch (error) {
      releaseMicrophone(false);
      setMicrophoneState('error');
      setMessage(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone permission was not granted. You can try again.'
          : 'A microphone could not be started. Check your device and try again.',
      );
      requestAnimationFrame(paint);
    }
  }, [paint, releaseMicrophone]);

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
    requestAnimationFrame(paint);

    return () => releaseMicrophone(false);
  }, [paint, releaseMicrophone]);

  useEffect(() => {
    if (microphoneState !== 'active') return;

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
  }, [microphoneState, paint]);

  const isActive = microphoneState === 'active';
  const isStarting = microphoneState === 'starting';
  const stateLabel = isActive
    ? 'Listening locally'
    : isStarting
      ? 'Waiting for permission'
      : microphoneState === 'error'
        ? 'Microphone unavailable'
        : 'Enable microphone';

  return (
    <div className="edge-voice-layout">
      <div className="edge-voice-copy">
        <p className="edge-listening-state">
          {stateLabel}
          {isActive && (
            <span aria-hidden="true" className="edge-listening-dots">
              {[0, 0.14, 0.28].map((delay) => (
                <motion.span
                  animate={{
                    opacity: [0.2, 1, 0.2],
                    scale: [0.72, 1, 0.72],
                    y: [3, -2, 3],
                  }}
                  className="edge-listening-dot"
                  key={delay}
                  transition={{
                    delay,
                    duration: 0.84,
                    ease: [0.45, 0, 0.55, 1],
                    repeat: Infinity,
                  }}
                />
              ))}
            </span>
          )}
        </p>
        <div className="edge-microphone-control">
          <button
            className="edge-mic-button"
            disabled={isStarting}
            onClick={isActive ? () => releaseMicrophone() : enableMicrophone}
            type="button"
          >
            {isActive ? (
              <Square strokeWidth={1.6} />
            ) : (
              <Mic strokeWidth={1.6} />
            )}
            {isStarting
              ? 'Requesting access'
              : isActive
                ? 'Stop microphone'
                : microphoneState === 'error'
                  ? 'Retry microphone'
                  : 'Enable microphone'}
          </button>
        </div>
        {message && (
          <span aria-live="polite" className="edge-mic-message">
            {message}
          </span>
        )}
      </div>

      <div className="edge-waveform">
        <canvas
          aria-hidden="true"
          className="edge-wave-canvas"
          ref={canvasRef}
        />
      </div>
    </div>
  );
}
