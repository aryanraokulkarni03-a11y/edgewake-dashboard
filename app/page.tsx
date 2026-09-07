import { LockKeyhole, Radio, ShieldCheck } from 'lucide-react';

import { LiveWaveform } from '@/components/live-waveform';
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
          <span>V1</span>
          <i />
          <span className="edge-preview-label">Local preview</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="edge-canvas">
        <section className="edge-intro" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">Command Centre</h1>
            <p className="edge-page-description">Local wake-word detection with post-trigger transcription.</p>
          </div>
        </section>

        <section className="edge-listener" aria-labelledby="listener-title">
          <div className="edge-card-head">
            <h2 id="listener-title">Local input monitor</h2>
          </div>

          <LiveWaveform />
        </section>

        <footer className="edge-principles">
          <span><Radio strokeWidth={1.5} /> On-device wake detection</span>
          <span><LockKeyhole strokeWidth={1.5} /> Audio stays local until triggered</span>
          <span><ShieldCheck strokeWidth={1.5} /> Designed for edge devices</span>
        </footer>
      </div>
    </main>
  );
}
