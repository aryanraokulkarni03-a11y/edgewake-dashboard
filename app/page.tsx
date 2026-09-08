import { LockKeyhole, Radio, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

import { LiveCommandStatus } from '@/components/live-command-status';
import { ThemeToggle } from '@/components/theme-toggle';
import { WifiDeviceMonitor } from '@/components/wifi-device-monitor';

export default function Home() {
  return (
    <main className="edge-app">
      <header className="edge-topbar">
        <div className="edge-identity">
          <span className="edge-product-name">EdgeWake</span>
          <span className="edge-attribution">
            by <em>Team Luna</em>
          </span>
        </div>
        <div className="edge-utility">
          <span className="edge-isro-lockup">
            <span className="edge-isro-label">ISRO challenge</span>
            <Image className="edge-isro-logo" src="/isro-logo.png" alt="ISRO logo" width={34} height={34} />
          </span>
          <i />
          <span className="edge-version">V2</span>
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
            <h2 id="listener-title">EdgeWake device</h2>
          </div>

          <WifiDeviceMonitor />
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
