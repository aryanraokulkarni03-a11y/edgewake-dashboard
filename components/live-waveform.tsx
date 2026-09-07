'use client';

import { Mic, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type MicrophoneState = 'idle' | 'starting' | 'active' | 'error';
type WorkletEnvelope = { endTime: number; values: Int16Array };

const ENVELOPE_COLUMNS = 32;
const FRAME_DURATION_SECONDS = 0.01;
const HORIZON_SECONDS = 1.2;
const HISTORY_FRAMES = HORIZON_SECONDS / FRAME_DURATION_SECONDS;
const MAX_DISPLAY_COLUMNS = 144;
const PRESENTATION_DELAY_SECONDS = 0.03;
const fromQ15 = (value: number) => (value < 0 ? value / 32768 : value / 32767);

export function LiveWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const envelopeRingRef = useRef(
    Array.from(
      { length: HISTORY_FRAMES },
      () => new Int16Array(ENVELOPE_COLUMNS * 2),
    ),
  );
  const frameEndRingRef = useRef(new Float64Array(HISTORY_FRAMES));
  const frameValidRef = useRef(new Uint8Array(HISTORY_FRAMES));
  const ringWriteIndexRef = useRef(0);
  const peakColumnsRef = useRef(new Float32Array(MAX_DISPLAY_COLUMNS));
  const canvasMetricsRef = useRef({ width: 0, height: 0, pixelRatio: 1 });
  const canvasColorsRef = useRef({ line: '#e1e4e6', waveform: '#4f63d8' });
  const horizonEndRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastReducedMotionPaintRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<{
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: AudioWorkletNode;
    silentGain: GainNode;
  } | null>(null);
  const reducedMotionRef = useRef(false);
  const [microphoneState, setMicrophoneState] =
    useState<MicrophoneState>('idle');
  const [message, setMessage] = useState('');

  const syncCanvasTheme = useCallback(() => {
    const styles = getComputedStyle(document.documentElement);
    canvasColorsRef.current = {
      line: styles.getPropertyValue('--wave-line').trim() || '#e1e4e6',
      waveform: styles.getPropertyValue('--wave-accent').trim() || '#4f63d8',
    };
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height, pixelRatio } = canvasMetricsRef.current;
    if (!width || !height) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = canvasColorsRef.current.line;
    context.lineWidth = 1;
    context.beginPath();
    const centerY = Math.floor(height / 2) + 0.5;
    context.moveTo(0, centerY);
    context.lineTo(width, centerY);
    context.stroke();

    const rawHorizonEnd = Math.max(
      0,
      (audioRef.current?.context.currentTime ?? 0) - PRESENTATION_DELAY_SECONDS,
    );
    const horizonEnd = Math.max(horizonEndRef.current, rawHorizonEnd);
    horizonEndRef.current = horizonEnd;
    if (!horizonEnd) return;

    const horizontalPadding = 28;
    const drawWidth = width - horizontalPadding * 2;
    const displayColumns = Math.min(
      MAX_DISPLAY_COLUMNS,
      Math.max(48, Math.floor(drawWidth / 5)),
    );
    const horizontalStep = drawWidth / displayColumns;
    const halfHeight = Math.min(centerY - 26, height - 26 - centerY);
    const horizonStart = horizonEnd - HORIZON_SECONDS;
    const peakColumns = peakColumnsRef.current;
    peakColumns.fill(0, 0, displayColumns);

    for (let slot = 0; slot < HISTORY_FRAMES; slot += 1) {
      if (!frameValidRef.current[slot]) continue;
      const endTime = frameEndRingRef.current[slot];
      if (
        endTime <= horizonStart ||
        endTime - FRAME_DURATION_SECONDS >= horizonEnd
      )
        continue;
      const frameStart = endTime - FRAME_DURATION_SECONDS;
      const values = envelopeRingRef.current[slot];

      for (let bucket = 0; bucket < ENVELOPE_COLUMNS; bucket += 1) {
        const bucketTime =
          frameStart +
          ((bucket + 0.5) * FRAME_DURATION_SECONDS) / ENVELOPE_COLUMNS;
        const column = Math.floor(
          ((bucketTime - horizonStart) / HORIZON_SECONDS) * displayColumns,
        );
        if (column < 0 || column >= displayColumns) continue;
        const peak = Math.max(
          Math.abs(fromQ15(values[bucket * 2])),
          Math.abs(fromQ15(values[bucket * 2 + 1])),
        );
        peakColumns[column] = Math.max(peakColumns[column], peak);
      }
    }

    context.strokeStyle = canvasColorsRef.current.waveform;
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.beginPath();

    for (let column = 0; column < displayColumns; column += 1) {
      const x =
        horizontalPadding + horizontalStep * column + horizontalStep / 2;
      const peak = peakColumns[column];
      if (!peak) continue;
      context.moveTo(x, centerY - peak * halfHeight);
      context.lineTo(x, centerY + peak * halfHeight);
    }

    context.stroke();
  }, []);

  const releaseMicrophone = useCallback(
    (resetInterface = true) => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      frameValidRef.current.fill(0);
      frameEndRingRef.current.fill(0);
      ringWriteIndexRef.current = 0;
      horizonEndRef.current = 0;
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
          data.values.length !== ENVELOPE_COLUMNS * 2 ||
          !Number.isFinite(data.endTime)
        )
          return;
        const slot = ringWriteIndexRef.current;
        envelopeRingRef.current[slot].set(data.values);
        frameEndRingRef.current[slot] = data.endTime;
        frameValidRef.current[slot] = 1;
        ringWriteIndexRef.current =
          (ringWriteIndexRef.current + 1) % HISTORY_FRAMES;
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
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      reducedMotionRef.current = mediaQuery.matches;
    };
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    requestAnimationFrame(paint);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
      releaseMicrophone(false);
    };
  }, [paint, releaseMicrophone]);

  useEffect(() => {
    if (microphoneState !== 'active') return;

    const drawLoop = (timestamp: number) => {
      if (
        !reducedMotionRef.current ||
        timestamp - lastReducedMotionPaintRef.current >= 250
      ) {
        lastReducedMotionPaintRef.current = timestamp;
        paint();
      }
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
              <i />
              <i />
              <i />
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
