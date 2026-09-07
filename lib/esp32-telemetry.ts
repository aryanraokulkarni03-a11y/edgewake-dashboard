export type Esp32Telemetry = {
  peak: number;
  rms: number;
  seq: number;
  uptimeMs: number;
};

type TelemetryRecord = Record<string, unknown>;

const isLevel = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000;

const isCounter = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function parseEsp32Telemetry(line: string): Esp32Telemetry | null {
  let payload: unknown;

  try {
    payload = JSON.parse(line);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const record = payload as TelemetryRecord;
  if (
    record.v !== 1 ||
    record.t !== 'level' ||
    !isLevel(record.rms) ||
    !isLevel(record.peak) ||
    !isCounter(record.seq) ||
    !isCounter(record.uptimeMs)
  ) {
    return null;
  }

  return {
    rms: record.rms,
    peak: record.peak,
    seq: record.seq,
    uptimeMs: record.uptimeMs,
  };
}

export function telemetryToWaveLevel({ rms, peak }: Esp32Telemetry) {
  const envelope = Math.max(rms, peak * 0.7) / 1000;
  return Math.min(1, Math.pow(envelope, 0.46));
}
