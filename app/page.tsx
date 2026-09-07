import { LockKeyhole, Radio, ShieldCheck } from 'lucide-react';

import { Esp32SerialMonitor } from '@/components/esp32-serial-monitor';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <main className="edge-app">
      <header className="edge-topbar">
        <div className="edge-identity">
          <span className="edge-product-name">EdgeWake</span>
          <span className="edge-team-name">Team Luna</span>
        </div>
        <div className="edge-utility">
          <span>V2</span>
          <i />
          <span className="edge-preview-label">USB monitor</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="edge-canvas">
        <section className="edge-intro" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">Command Centre</h1>
            <p className="edge-page-description">Live microphone telemetry from ESP32.</p>
          </div>
        </section>

        <section className="edge-listener" aria-labelledby="listener-title">
          <div className="edge-card-head">
            <h2 id="listener-title">Local input monitor</h2>
          </div>

          <Esp32SerialMonitor />
        </section>

        <footer className="edge-principles">
          <span><Radio strokeWidth={1.5} /> On-device audio capture</span>
          <span><LockKeyhole strokeWidth={1.5} /> Audio remains local</span>
          <span><ShieldCheck strokeWidth={1.5} /> Live USB telemetry</span>
        </footer>
      </div>
    </main>
  );
}
