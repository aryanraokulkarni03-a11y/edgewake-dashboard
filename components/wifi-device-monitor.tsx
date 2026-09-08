'use client';

import { Laptop, Radio, Wifi } from 'lucide-react';
import { useEffect, useReducer } from 'react';

import { dashboardSocketUrl } from '@/lib/edgewake-dashboard';
import {
  initialDeviceHubState,
  reduceDeviceHubState,
} from '@/lib/wifi-device-state';

type DashboardEvent = {
  device?: string;
  devices?: string[];
  type: string;
};

export function WifiDeviceMonitor() {
  const [state, dispatch] = useReducer(reduceDeviceHubState, initialDeviceHubState);

  useEffect(() => {
    let retry: number | undefined;
    let socket: WebSocket | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      dispatch({ type: 'hub_connecting' });
      socket = new WebSocket(dashboardSocketUrl);
      socket.onopen = () => dispatch({ type: 'hub_connected' });
      socket.onmessage = (message) => {
        try {
          dispatch(JSON.parse(message.data) as DashboardEvent);
        } catch {
          // Ignore malformed dashboard events.
        }
      };
      socket.onclose = () => {
        dispatch({ type: 'hub_closed' });
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

  const status =
    state.connection === 'offline'
      ? {
          detail: 'The command hub is reconnecting. Keep EdgeWake on this Wi-Fi.',
          label: 'Command hub offline',
          phase: 'offline',
        }
      : state.connection === 'connecting'
        ? {
            detail: '',
            label: 'Looking for EdgeWake on Wi-Fi',
            phase: 'searching',
          }
        : state.streaming
          ? {
              detail: 'Sending triggered command audio to the command hub.',
              label: 'Wake word detected locally',
              phase: 'streaming',
            }
          : state.device
            ? {
                detail: 'Wi-Fi link established. Wake word ready.',
                label: 'EdgeWake online',
                phase: 'online',
              }
            : {
                detail: '',
                label: 'Looking for EdgeWake on Wi-Fi',
                phase: 'searching',
              };

  return (
    <div className="edge-wifi-layout">
      <div className="edge-wifi-copy">
        <p aria-live="polite" className="edge-wifi-state">
          <span className={`edge-device-dot edge-device-${status.phase}`} aria-hidden="true" />
          <span>{status.label}</span>
        </p>
        {status.detail && <p className="edge-wifi-detail">{status.detail}</p>}
        <span className="edge-wifi-network-hint">
          <Wifi strokeWidth={1.7} /> Same network required
        </span>
      </div>

      <div className={`edge-wifi-topology edge-wifi-${status.phase}`} aria-hidden="true">
        <div className="edge-network-node">
          <Radio strokeWidth={1.6} />
          <span>DEVICE</span>
          <strong>EdgeWake-01</strong>
        </div>
        <div className="edge-wifi-link">
          <Wifi strokeWidth={1.5} />
        </div>
        <div className="edge-network-node edge-network-node-hub">
          <Laptop strokeWidth={1.6} />
          <span>COMMAND HUB</span>
          <strong>This laptop</strong>
        </div>
      </div>
    </div>
  );
}
