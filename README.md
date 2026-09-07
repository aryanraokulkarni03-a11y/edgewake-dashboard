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

## Vercel deployment

Import this repository with the **Other** preset and root directory `./`.
`vercel.json` sets installation to `npm ci`, the build to `npm run build`,
and the public output to `dist/client`. No application environment variables are needed.

Vercel's automatic `VERCEL=1` environment flag enables the static export and
skips the Cloudflare Worker plugin. Only the exported HTML, styles, scripts,
fonts, and audio worklet are published; microphone processing runs in the browser.
Local development and the existing managed-hosting build keep their current configuration.

Local export verification generated the HTML and assets successfully, but the
Windows build process reported a `UV_HANDLE_CLOSING` assertion at shutdown.
Lint and exported-asset checks passed. The first Vercel build must still complete
successfully before the deployment is considered verified.

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
