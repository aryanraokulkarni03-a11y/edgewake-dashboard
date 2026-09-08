'use client';

import { useEffect, useState } from 'react';

type EventMessage = {
  device?: string;
  durationMs?: number;
  text?: string;
  type: string;
};

type ConnectionState = 'connecting' | 'connected' | 'offline';

const socketUrl =
  process.env.NEXT_PUBLIC_EDGEWAKE_WS_URL ?? 'ws://127.0.0.1:8770/dashboard';

export function LiveCommandStatus() {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [event, setEvent] = useState<EventMessage | null>(null);

  useEffect(() => {
    let retry: number | undefined;
    let socket: WebSocket | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setConnection('connecting');
      socket = new WebSocket(socketUrl);
      socket.onopen = () => setConnection('connected');
      socket.onmessage = (message) => {
        try {
          const next = JSON.parse(message.data) as EventMessage;
          if (next.type === 'partial' || next.type === 'final') setEvent(next);
        } catch {
          // Ignore malformed dashboard events.
        }
      };
      socket.onclose = () => {
        setConnection('offline');
        if (!stopped) retry = window.setTimeout(connect, 2000);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const label =
    connection === 'connected'
      ? 'Live server connected'
      : connection === 'connecting'
        ? 'Connecting to server'
        : 'Server offline';

  return (
    <section className="edge-live-status" aria-live="polite">
      <div className="edge-live-status-head">
        <span className={`edge-status-dot edge-status-${connection}`} aria-hidden="true" />
        <span>{label}</span>
        <span className="edge-live-status-route">/dashboard</span>
      </div>
      <div className="edge-transcript">
        <p className={event ? undefined : 'edge-transcript-empty'}>
          {event?.text || 'Waiting for a spoken command.'}
        </p>
      </div>
    </section>
  );
}
