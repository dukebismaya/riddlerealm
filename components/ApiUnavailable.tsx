import React, { useEffect, useState } from "react";
import { getDiagnostics, getDiagnosticsAsync, Diagnostic } from "../services/diagnostics";

const mergeDetail = (current?: string, incoming?: string): string | undefined => {
  const parts: string[] = [];
  const seen = new Set<string>();
  const addParts = (text?: string) => {
    if (!text) return;
    text
      .split(/\n|;/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .forEach((segment) => {
        if (!seen.has(segment)) {
          parts.push(segment);
          seen.add(segment);
        }
      });
  };
  addParts(current);
  addParts(incoming);
  if (parts.length === 0) return undefined;
  return parts.join("; ");
};

const CRITICAL_KEYS = ["gemini", "emailjs", "firebase"];

const areCriticalServicesDown = (list: Diagnostic[]): boolean => {
  return CRITICAL_KEYS.every((key) => {
    const entry = list.find((item) => item.key === key);
    return !entry || entry.ok === false;
  });
};

const ApiUnavailable: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(() => getDiagnostics());
  const [checkingReachability, setCheckingReachability] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [allCriticalDown, setAllCriticalDown] = useState(() => areCriticalServicesDown(getDiagnostics()));

  useEffect(() => {
    let mounted = true;

    const mergeDiagnostics = (incoming: Diagnostic[] | null | undefined) => {
      if (!incoming || incoming.length === 0) return;
      setDiagnostics((current) => {
        const map = new Map(current.map((entry) => [entry.key, { ...entry }]));
        for (const item of incoming) {
          const existing = map.get(item.key);
          if (existing) {
            map.set(item.key, {
              ...existing,
              ok: typeof item.ok === "boolean" ? item.ok : existing.ok,
              detail: mergeDetail(existing.detail, item.detail),
            });
          } else {
            map.set(item.key, { ...item });
          }
        }
        return Array.from(map.values());
      });
    };

    const fromServerless = (payload: any): Diagnostic[] => {
      if (!payload || !Array.isArray(payload.results)) return [];
      return payload.results.map((item: any) => {
        const network = item.network || {};
        const configured = Boolean(item.configured);
        const reachable = network.reachable !== false;
        const ok = configured && reachable;
        const message = item.key === "gemini"
          ? (configured ? "Gemini client seems configured." : "Gemini API key missing.")
          : item.key === "emailjs"
            ? (configured ? "EmailJS is configured." : "EmailJS configuration missing.")
            : item.key;
        const detailParts: string[] = [];
        if (!reachable) {
          detailParts.push(`Network: unreachable (${network.error ?? network.status ?? "unknown error"})`);
        } else {
          detailParts.push("Network: reachable");
          if (network.ok === false && typeof network.status !== "undefined") {
            detailParts.push(`Service responded with status ${network.status}.`);
          }
        }
        if (!configured) {
          detailParts.push("Not configured");
        }
        return {
          key: item.key,
          ok,
          message,
          detail: detailParts.join("; "),
        } satisfies Diagnostic;
      });
    };

    (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        let consumedServerResponse = false;
        try {
          const response = await fetch("/api/health", { method: "GET", signal: controller.signal });
          if (response.ok) {
            const payload = await response.json();
            if (mounted) {
              mergeDiagnostics(fromServerless(payload));
              consumedServerResponse = true;
            }
          }
        } catch (err) {
          // serverless endpoint not reachable; fall back to client checks below
        } finally {
          clearTimeout(timeoutId);
        }

        if (!consumedServerResponse) {
          const asyncChecks = await getDiagnosticsAsync();
          if (mounted) mergeDiagnostics(asyncChecks);
        }
      } catch (err) {
        if (mounted) {
          mergeDiagnostics([{ key: "connectivity", ok: false, message: "Connectivity checks failed.", detail: String(err) }]);
        }
      } finally {
        if (mounted) setCheckingReachability(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAllCriticalDown(areCriticalServicesDown(diagnostics));
  }, [diagnostics]);

  const heartbeatPath = allCriticalDown
    ? "M0 120 L800 120"
    : "M0 120 L60 120 L90 120 L110 60 L140 180 L170 120 L260 120 L300 120 L330 80 L350 120 L430 120 L470 120 L500 70 L530 125 L580 125 L620 125 L700 125 L800 125";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      background: allCriticalDown ? "#000" : "#0b0b0b",
      color: "#fff",
      padding: "24px",
      textAlign: "center"
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
        .track-inner { display: flex; width: 200%; animation: scroll-left 1.6s linear infinite; }
        .track-inner .ecg { flex: 0 0 50%; height: 100%; }

        .ecg path {
          fill: none;
          stroke: #ff5c5f;
          stroke-width: 4.6;
          stroke-linejoin: round;
          stroke-linecap: round;
          filter: drop-shadow(0 10px 30px rgba(255,92,95,0.22));
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

        .emoji.laughing-devil {
          color: #ff5c5f;
          text-shadow: 0 0 14px rgba(255,0,0,0.45);
          animation: laugh 1.1s ease-in-out infinite;
        }

        @keyframes laugh {
          0% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.12) rotate(-6deg); }
          60% { transform: scale(1.12) rotate(6deg); }
          100% { transform: scale(1) rotate(0deg); }
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
          <div
            className="track-inner"
            style={{ animation: allCriticalDown ? "none" : "scroll-left 1.6s linear infinite" }}
          >
            <svg className="ecg" viewBox="0 0 800 200" preserveAspectRatio="none" role="img" aria-label="heartbeat line">
              <path d={heartbeatPath} style={allCriticalDown ? { animation: "none", stroke: "#ff3436" } : undefined} />
            </svg>
            <svg className="ecg" viewBox="0 0 800 200" preserveAspectRatio="none" role="img" aria-hidden>
              <path d={heartbeatPath} style={allCriticalDown ? { animation: "none", stroke: "#ff3436" } : undefined} />
            </svg>
          </div>
        </div>
      </div>

      <div className="card">
        <div className={`emoji${allCriticalDown ? " laughing-devil" : ""}`} role="img" aria-label={allCriticalDown ? "devil laughing" : "sad face"}>
          {allCriticalDown ? "😈" : "😢"}
        </div>
        <h2 style={{ marginTop: 12, marginBottom: 8, color: allCriticalDown ? "#ff4d4f" : "#ffdddd" }}>Service unavailable</h2>
        <p style={{ color: "#ddd", marginBottom: 6 }}>
          {allCriticalDown
            ? "All services are disabled. Kindly contact Bismaya."
            : "The app detected missing or misconfigured services. Below are details to help you fix it."}
        </p>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          aria-controls="diagnostic-panel"
          style={{
            marginTop: 12,
            marginBottom: collapsed ? 0 : 12,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: collapsed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.3px",
            boxShadow: collapsed ? "0 6px 18px rgba(0,0,0,0.25)" : "0 10px 28px rgba(0,0,0,0.32)",
            transform: collapsed ? "translateY(0)" : "translateY(-1px)",
            transition: "background 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease",
          }}
        >
          {collapsed ? "Reveal diagnostics" : "Hide diagnostics"}
        </button>

        <div
          id="diagnostic-panel"
          aria-hidden={collapsed}
          style={{
            textAlign: "left",
            marginTop: 12,
            marginBottom: collapsed ? 0 : 12,
            maxHeight: collapsed ? "0px" : "640px",
            opacity: collapsed ? 0 : 1,
            overflow: "hidden",
            transition: "max-height 0.45s ease, opacity 0.35s ease",
            backdropFilter: collapsed ? "blur(0px)" : "blur(2px)",
          }}
        >
          <div style={{ paddingTop: collapsed ? 0 : 2, paddingBottom: collapsed ? 0 : 2 }}>
            {diagnostics.map((d: Diagnostic) => (
              <div key={d.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 6, background: d.ok ? "#34d399" : "#ff6b6b", marginTop: 6 }} />
                <div>
                  <div style={{ fontWeight: 600, color: d.ok ? "#bbf7d0" : "#ffd6d6" }}>{d.message}</div>
                  {d.detail && <div style={{ color: "#ddd", fontSize: 13 }}>{d.detail}</div>}
                </div>
              </div>
            ))}
            {checkingReachability && (
              <div style={{ color: "#ccc", fontSize: 13, marginTop: 8 }}>Checking network reachability…</div>
            )}
          </div>
        </div>

        <p style={{ color: "#ddd", marginBottom: 6 }}>
          If you're the site owner, double-check that the server-side <code>GEMINI_API_KEY</code> secret is set and that
          any custom <code>VITE_GEMINI_PROXY_ENDPOINT</code> value points to a live proxy.
        </p>
        <p style={{ color: "#ffdcdc" }}>
          For help, contact: <a className="contact" href="mailto:bismayajyotidalei@gmail.com">bismayajyotidalei@gmail.com</a>
        </p>
      </div>
    </div>
  );
};

export default ApiUnavailable;
