export type DeviceHubState = {
  connection: 'connecting' | 'connected' | 'offline';
  device: string | null;
  streaming: boolean;
};

type DeviceHubEvent = {
  device?: string;
  type: string;
};

export const initialDeviceHubState: DeviceHubState = {
  connection: 'connecting',
  device: null,
  streaming: false,
};

export function reduceDeviceHubState(
  state: DeviceHubState,
  event: DeviceHubEvent,
): DeviceHubState {
  switch (event.type) {
    case 'hub_connecting':
      return initialDeviceHubState;
    case 'hub_connected':
      return { ...state, connection: 'connected' };
    case 'hub_closed':
      return { connection: 'offline', device: null, streaming: false };
    case 'device_connected':
      return { ...state, device: event.device ?? 'EdgeWake-01', streaming: false };
    case 'device_disconnected':
      return event.device === state.device
        ? { ...state, device: null, streaming: false }
        : state;
    case 'stream_started':
      return state.device && event.device === state.device
        ? { ...state, streaming: true }
        : state;
    case 'final':
      return { ...state, streaming: false };
    default:
      return state;
  }
}
