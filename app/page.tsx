import { LockKeyhole, Radio, ShieldCheck } from 'lucide-react';

import { Esp32SerialMonitor } from '@/components/esp32-serial-monitor';
import { LiveCommandStatus } from '@/components/live-command-status';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <main className="edge-app">
      <header className="edge-topbar">
        <div className="edge-identity">
          <span className="edge-product-name">EdgeWake</span>
          <span className="edge-by">by</span>
          <span className="edge-team-name">Team Luna</span>
        </div>
        <div className="edge-utility">
          <span>V2</span>
          <i />
          <span className="edge-preview-label">Live WebSocket</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="edge-canvas">
        <section className="edge-intro" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">Command Centre</h1>
            <p className="edge-page-description">Live device status and speech transcription.</p>
          </div>
        </section>

        <section className="edge-listener" aria-labelledby="listener-title">
          <div className="edge-card-head">
            <h2 id="listener-title">Local input monitor</h2>
          </div>

          <Esp32SerialMonitor />
        </section>

        <LiveCommandStatus />

        <footer className="edge-principles">
          <span><Radio strokeWidth={1.5} /> Wake word runs on device</span>
          <span><LockKeyhole strokeWidth={1.5} /> Only triggered audio is sent</span>
          <span><ShieldCheck strokeWidth={1.5} /> Live WebSocket telemetry</span>
        </footer>
      </div>
    </main>
  );
}
