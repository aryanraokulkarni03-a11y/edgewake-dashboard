'use client';

import { Cable, PlugZap } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  parseEsp32Telemetry,
  telemetryToWaveLevel,
  type Esp32Telemetry,
} from '@/lib/esp32-telemetry';

import { LiveWaveform } from './live-waveform';

type ConnectionState =
  | 'unsupported'
  | 'idle'
  | 'selecting'
  | 'connecting'
  | 'waiting'
  | 'live'
  | 'stale'
  | 'error';

type SerialPortLike = {
  close: () => Promise<void>;
  open: (options: { baudRate: number; bufferSize?: number }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

type SerialApi = {
  requestPort: () => Promise<SerialPortLike>;
};

type SerialNavigator = Navigator & {
  serial?: SerialApi;
};

const STALE_AFTER_MS = 1500;

const stateCopy: Record<ConnectionState, { detail: string; label: string }> = {
  unsupported: {
    label: 'Use Chrome on desktop',
    detail: 'Web Serial is unavailable in this browser.',
  },
  idle: { label: 'Connect device', detail: '' },
  selecting: { label: 'Select device', detail: 'Choose the CP210x USB device.' },
  connecting: { label: 'Connecting device', detail: 'Opening the selected ESP32.' },
  waiting: {
    label: 'Waiting for signal',
    detail: 'ESP32 connected. Waiting for audio telemetry.',
  },
  live: { label: 'Listening locally', detail: 'ESP32 · USB connected' },
  stale: { label: 'Signal paused', detail: 'No live data from ESP32.' },
  error: {
    label: 'Could not connect',
    detail: 'Close other serial tools and reconnect.',
  },
};

export function Esp32SerialMonitor() {
  const isSerialSupported = useSyncExternalStore(
    () => () => {},
    () => 'serial' in navigator,
    () => true,
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [waveLevel, setWaveLevel] = useState(0);
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const readTaskRef = useRef<Promise<void> | null>(null);
  const sessionRef = useRef(0);
  const lastPacketRef = useRef<Esp32Telemetry | null>(null);
  const lastPacketAtRef = useRef(0);

  const closePort = useCallback(async (nextState: ConnectionState) => {
    sessionRef.current += 1;
    const reader = readerRef.current;
    readerRef.current = null;
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // The port may already be gone.
      }
    }
    await readTaskRef.current?.catch(() => undefined);
    readTaskRef.current = null;

    const port = portRef.current;
    portRef.current = null;
    if (port) {
      try {
        await port.close();
      } catch {
        // The port may already be closed after a cable disconnect.
      }
    }

    lastPacketRef.current = null;
    lastPacketAtRef.current = 0;
    setWaveLevel(0);
    setConnectionState(nextState);
  }, []);

  const readPort = useCallback(
    async (port: SerialPortLike, session: number) => {
      const reader = port.readable?.getReader();
      if (!reader) {
        if (session === sessionRef.current) setConnectionState('error');
        return;
      }

      readerRef.current = reader;
      const decoder = new TextDecoder();
      let remainder = '';

      try {
        while (session === sessionRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          remainder += decoder.decode(value, { stream: true });
          const lines = remainder.split(/\r?\n/);
          remainder = lines.pop() ?? '';

          for (const line of lines) {
            const telemetry = parseEsp32Telemetry(line);
            if (!telemetry) continue;

            const previous = lastPacketRef.current;
            const isOutOfOrder =
              previous &&
              telemetry.uptimeMs >= previous.uptimeMs &&
              telemetry.seq <= previous.seq;
            if (isOutOfOrder) continue;

            lastPacketRef.current = telemetry;
            lastPacketAtRef.current = Date.now();
            setWaveLevel(telemetryToWaveLevel(telemetry));
            setConnectionState('live');
          }
        }
      } catch {
        if (session === sessionRef.current) setConnectionState('stale');
      } finally {
        reader.releaseLock();
        if (readerRef.current === reader) readerRef.current = null;
        readTaskRef.current = null;
        if (session === sessionRef.current && portRef.current === port) {
          portRef.current = null;
          setWaveLevel(0);
          setConnectionState('stale');
        }
      }
    },
    [],
  );

  const connect = useCallback(async () => {
    const serial = (navigator as SerialNavigator).serial;
    if (!serial) {
      setConnectionState('unsupported');
      return;
    }

    setConnectionState('selecting');
    try {
      const port = await serial.requestPort();
      setConnectionState('connecting');
      await port.open({ baudRate: 115200, bufferSize: 2048 });

      const session = sessionRef.current + 1;
      sessionRef.current = session;
      portRef.current = port;
      lastPacketRef.current = null;
      lastPacketAtRef.current = 0;
      setConnectionState('waiting');
      readTaskRef.current = readPort(port, session);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        setConnectionState('idle');
        return;
      }
      setConnectionState('error');
    }
  }, [readPort]);

  useEffect(() => {
    const checkFreshness = window.setInterval(() => {
      if (
        portRef.current &&
        lastPacketAtRef.current &&
        Date.now() - lastPacketAtRef.current > STALE_AFTER_MS
      ) {
        setWaveLevel(0);
        setConnectionState('stale');
      }
    }, 250);

    return () => window.clearInterval(checkFreshness);
  }, []);

  useEffect(() => {
    return () => {
      void closePort('idle');
    };
  }, [closePort]);

  const visibleState = isSerialSupported ? connectionState : 'unsupported';
  const isConnected =
    visibleState === 'waiting' ||
    visibleState === 'live' ||
    visibleState === 'stale';
  const isBusy = visibleState === 'selecting' || visibleState === 'connecting';
  const buttonLabel = isBusy
    ? 'Connecting'
    : visibleState === 'stale' || visibleState === 'error'
        ? 'Reconnect ESP32'
      : isConnected
        ? 'Disconnect'
        : 'Connect ESP32';
  const copy = stateCopy[visibleState];
  const handleConnection = () => {
    if (visibleState === 'stale') {
      void closePort('idle').then(connect);
      return;
    }
    if (isConnected) {
      void closePort('idle');
      return;
    }
    void connect();
  };

  return (
    <div className="edge-voice-layout">
      <div className="edge-voice-copy">
        <p aria-live="polite" className="edge-listening-state">
          {copy.label}
          {visibleState === 'live' && (
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
            disabled={isBusy || visibleState === 'unsupported'}
            onClick={handleConnection}
            type="button"
          >
            {isConnected ? <PlugZap strokeWidth={1.6} /> : <Cable strokeWidth={1.6} />}
            {buttonLabel}
          </button>
        </div>
        {copy.detail && <span className="edge-mic-message">{copy.detail}</span>}
      </div>

      <div className="edge-waveform">
        <LiveWaveform isConnected={isConnected} level={waveLevel} />
      </div>
    </div>
  );
}
