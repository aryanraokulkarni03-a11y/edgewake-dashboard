import assert from 'node:assert/strict';

import {
  initialDeviceHubState,
  reduceDeviceHubState,
} from '../lib/wifi-device-state.ts';

let state = reduceDeviceHubState(initialDeviceHubState, { type: 'hub_connected' });
assert.equal(state.connection, 'connected');

state = reduceDeviceHubState(state, { device: '10.2.40.41:49152', type: 'device_connected' });
assert.equal(state.device, '10.2.40.41:49152');

state = reduceDeviceHubState(state, { device: '10.2.40.41:49152', type: 'stream_started' });
assert.equal(state.streaming, true);

state = reduceDeviceHubState(state, { type: 'final' });
assert.equal(state.streaming, false);

state = reduceDeviceHubState(state, { device: '10.2.40.41:49152', type: 'device_disconnected' });
assert.equal(state.device, null);
