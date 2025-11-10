import React, { useMemo, useEffect, useState } from 'react';
import { getDiagnostics, getDiagnosticsAsync, Diagnostic } from '../services/diagnostics';

const ApiUnavailable: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: '#0b0b0b',
      color: '#fff',
      padding: '24px',
      textAlign: 'center'
    }}>
      <style>{`
        .monitor-wrap {
          width: 540px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.6), 0 0 40px rgba(200,0,0,0.06) inset;
          margin-bottom: 18px;
          padding: 8px 12px;
        }

        .track { width: 100%; overflow: hidden; }
        /* faster, moderate-paced continuous scroll */
        .track-inner { display: flex; width: 200%; animation: scroll-left 1.6s linear infinite; }
        .track-inner .ecg { flex: 0 0 50%; height: 100%; }

        .ecg path {
          fill: none;
          stroke: #ff5c5f; /* brighter red */
          stroke-width: 4.6;
          stroke-linejoin: round;
          stroke-linecap: round;
          filter: drop-shadow(0 10px 30px rgba(255,92,95,0.22));
          /* subtle glow pulse */
          animation: ecg-glow 1.6s ease-in-out infinite;
        }

        @keyframes scroll-left {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        @keyframes ecg-glow {
          0% {
            opacity: 0.88;
            filter: drop-shadow(0 8px 20px rgba(255,92,95,0.18));
          }
          45% {
            opacity: 1;
            filter: drop-shadow(0 18px 42px rgba(255,92,95,0.34));
          }
          100% {
            opacity: 0.88;
            filter: drop-shadow(0 8px 20px rgba(255,92,95,0.18));
          }
        }

        .emoji {
          font-size: 64px;
          margin-top: 6px;
          animation: floaty 3s ease-in-out infinite;
        }

        @keyframes floaty {
          0% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0); }
        }

        .card {
          max-width: 720px;
        }

        a.contact {
          color: #ffb3b3;
          text-decoration: underline;
        }
      `}</style>

      <div className="monitor-wrap" aria-hidden>
        <div className="track">
          <div className="track-inner">
            <svg className="ecg" viewBox="0 0 800 200" preserveAspectRatio="none" role="img" aria-label="heartbeat line">
              <path d="M0 120 L60 120 L90 120 L110 60 L140 180 L170 120 L260 120 L300 120 L330 80 L350 120 L430 120 L470 120 L500 70 L530 125 L580 125 L620 125 L700 125 L800 125" />
            </svg>
            <svg className="ecg" viewBox="0 0 800 200" preserveAspectRatio="none" role="img" aria-hidden>
              <path d="M0 120 L60 120 L90 120 L110 60 L140 180 L170 120 L260 120 L300 120 L330 80 L350 120 L430 120 L470 120 L500 70 L530 125 L580 125 L620 125 L700 125 L800 125" />
            </svg>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="emoji" role="img" aria-label="sad face">😢</div>
        <h2 style={{ marginTop: 12, marginBottom: 8, color: '#ffdddd' }}>Service unavailable</h2>
        <p style={{ color: '#ddd', marginBottom: 6 }}>
          The app detected missing or misconfigured services. Below are details to help you fix it.
        </p>

        <div style={{ textAlign: 'left', marginTop: 8, marginBottom: 12 }}>
          {useMemo(() => getDiagnostics(), []).map((d: Diagnostic) => (
            <div key={d.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 6, background: d.ok ? '#34d399' : '#ff6b6b', marginTop: 6 }} />
              <div>
                <div style={{ fontWeight: 600, color: d.ok ? '#bbf7d0' : '#ffd6d6' }}>{d.message}</div>
                {d.detail && <div style={{ color: '#ddd', fontSize: 13 }}>{d.detail}</div>}
              </div>
            </div>
          ))}

          {/* async connectivity results (will replace/add to the static list when ready) */}
          <AsyncDiagnostics />
        </div>

        <p style={{ color: '#ddd', marginBottom: 6 }}>
          If you're the site owner, ensure environment variables are set (for example <code>VITE_GEMINI_API_KEY</code>).
        </p>
        <p style={{ color: '#ffdcdc' }}>
          For help, contact: <a className="contact" href="mailto:bismayajyotidalei@gmail.com">bismayajyotidalei@gmail.com</a>
        </p>
      </div>
    </div>
  );
};

export default ApiUnavailable;

const AsyncDiagnostics: React.FC = () => {
  const [results, setResults] = useState<Diagnostic[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer serverless health endpoint if available
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2500);
        let usedServer = false;
        try {
          const r = await fetch('/api/health', { method: 'GET', signal: controller.signal });
          clearTimeout(id);
          if (r.ok) {
            const payload = await r.json();
            // Map server payload to Diagnostic[]
            const mapped: Diagnostic[] = [];
            if (payload && Array.isArray(payload.results)) {
              for (const item of payload.results) {
                const network = item.network || {};
                const configured = Boolean(item.configured);
                const reachable = network.reachable !== false;
                const ok = configured && reachable;
                const message = item.key === 'gemini'
                  ? (configured ? 'Gemini client seems configured.' : 'Gemini API key missing.')
                  : item.key === 'emailjs'
                    ? (configured ? 'EmailJS is configured.' : 'EmailJS configuration missing.')
                    : item.key;
                const detailParts = [];
                if (!reachable) {
                  detailParts.push(`Network: unreachable (${network.error ?? network.status})`);
                } else {
                  detailParts.push('Network: reachable');
                  if (network.ok === false && typeof network.status !== 'undefined') {
                    detailParts.push(`Service responded with status ${network.status}.`);
                  }
                }
                if (!configured) {
                  detailParts.push('Not configured');
                }
                mapped.push({ key: item.key, ok, message, detail: detailParts.join('; ') });
              }
            }
            if (mounted) {
              setResults(mapped);
              usedServer = true;
            }
          }
        } catch (e) {
          // serverless endpoint not available or fetch failed; fall back to client checks
        } finally {
          clearTimeout(id);
        }

        if (!usedServer) {
          const res = await getDiagnosticsAsync();
          if (mounted) setResults(res);
        }
      } catch (e) {
        if (mounted) setResults([{ key: 'connectivity', ok: false, message: 'Connectivity checks failed.', detail: String(e) }]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const syncList = useMemo(() => getDiagnostics(), []);

  if (loading) {
    return <div style={{ color: '#ccc', fontSize: 13, marginTop: 8 }}>Checking network reachability…</div>;
  }

  if (!results || results.length === 0) return null;

  // Filter async results to only show items that differ from the static sync list
  const filtered = results.filter((ar) => {
    const base = syncList.find((s) => s.key === ar.key);
    if (!base) return true;
    if (base.ok !== ar.ok) return true;
    const baseDetail = (base.detail || '').trim();
    const arDetail = (ar.detail || '').trim();
    return baseDetail !== arDetail;
  });

  if (filtered.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {filtered.map((d) => (
        <div key={`async-${d.key}`} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 6, background: d.ok ? '#34d399' : '#ff6b6b', marginTop: 6 }} />
          <div>
            <div style={{ fontWeight: 600, color: d.ok ? '#bbf7d0' : '#ffd6d6' }}>{d.message}</div>
            {d.detail && <div style={{ color: '#ddd', fontSize: 13 }}>{d.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
