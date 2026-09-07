import assert from 'node:assert/strict';

import {
  parseEsp32Telemetry,
  telemetryToWaveLevel,
} from '../lib/esp32-telemetry.ts';

const valid = '{"v":1,"t":"level","seq":42,"uptimeMs":2100,"rms":184,"peak":361}';

assert.deepEqual(parseEsp32Telemetry(valid), {
  rms: 184,
  peak: 361,
  seq: 42,
  uptimeMs: 2100,
});
assert.equal(parseEsp32Telemetry('boot complete'), null);
assert.equal(parseEsp32Telemetry('{"v":1,"t":"ready"}'), null);
assert.equal(
  parseEsp32Telemetry('{"v":1,"t":"level","seq":1,"uptimeMs":1,"rms":1001,"peak":0}'),
  null,
);
assert.equal(telemetryToWaveLevel({ rms: 0, peak: 0, seq: 0, uptimeMs: 0 }), 0);
assert.equal(telemetryToWaveLevel({ rms: 1000, peak: 1000, seq: 1, uptimeMs: 1 }), 1);
