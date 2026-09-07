# EdgeWake Dashboard

V1 command centre for EdgeWake — Team Luna's low-latency voice activator for edge devices.

## V1 scope

- Judge-facing command centre UI
- Browser microphone waveform preview
- Light and dark themes

V1 does **not** connect to an ESP32, run keyword spotting, send audio to a backend, or display remote transcripts.

## Local development

```bash
npm install
npm run dev
```

Open the local address printed by the dev server. Browser microphone access is available on `localhost` or HTTPS only.

## Checks

```bash
npm run build
npm run lint
node tests/pcm-envelope-test.mjs
```

## Project layout

```text
app/                     Route, layout, and shared styles
components/              Dashboard-specific React components
public/fonts/            Inter Tight typeface used by the UI
public/worklets/         AudioWorklet for PCM envelope capture
tests/                   Lightweight waveform unit check
```

## Next stage

V2 will add the device event stream and transcript updates over a secure WebSocket connection. The ESP32 audio relay and ASR service remain separate from this frontend host.
