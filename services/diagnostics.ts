import { isApiAvailable } from './geminiService';
import { isEmailServiceConfigured } from './emailService';

type Diagnostic = {
  key: string;
  ok: boolean;
  message: string;
  detail?: string;
};

export const getDiagnostics = (): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  // Gemini proxy / AI backend
  const proxyEndpoint = (import.meta.env.VITE_GEMINI_PROXY_ENDPOINT || '/api/gemini').trim();
  if (isApiAvailable()) {
    diagnostics.push({ key: 'gemini', ok: true, message: 'Gemini proxy reachable.', detail: `Endpoint: ${proxyEndpoint}` });
  } else {
    diagnostics.push({
      key: 'gemini',
      ok: false,
      message: 'Gemini proxy unavailable.',
      detail: 'Ensure /api/gemini is deployed and the server-side GEMINI_API_KEY secret is set. Configure VITE_GEMINI_PROXY_ENDPOINT if you host the proxy elsewhere.',
    });
  }

  // Email service (EmailJS)
  const emailConfigured = isEmailServiceConfigured();
  if (emailConfigured) {
    diagnostics.push({ key: 'emailjs', ok: true, message: 'EmailJS is configured.' });
  } else {
    diagnostics.push({ key: 'emailjs', ok: false, message: 'EmailJS configuration missing.', detail: 'Provide VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY.' });
  }

  // Firebase config
  const firebaseKeys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const missingFirebase = firebaseKeys.filter((k) => !(import.meta.env as Record<string, string>)[k]);
  if (missingFirebase.length === 0) {
    diagnostics.push({ key: 'firebase', ok: true, message: 'Firebase config present.' });
  } else {
    diagnostics.push({ key: 'firebase', ok: false, message: 'Firebase config incomplete.', detail: `Missing: ${missingFirebase.join(', ')}` });
  }

  // Public riddle endpoint (optional)
  const publicEndpoint = import.meta.env.VITE_PUBLIC_RIDDLE_ENDPOINT;
  if (publicEndpoint && publicEndpoint.trim().length > 0) {
    diagnostics.push({ key: 'public_riddle', ok: true, message: 'Public riddle endpoint configured.' });
  } else {
    diagnostics.push({ key: 'public_riddle', ok: true, message: 'Using default public riddle endpoint.' });
  }

  return diagnostics;
};

const fetchWithTimeout = async (
  url: string,
  timeoutMs = 3000,
  init?: RequestInit,
): Promise<{ ok: boolean; status?: number; reachable: boolean; error?: string }> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: 'HEAD', mode: 'cors', ...(init || {}), signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok, status: res.status, reachable: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, reachable: false, error: 'timeout' };
    }
    // Could be network or CORS error; return the message when available
    return { ok: false, reachable: false, error: err?.message || String(err) };
  }
};

export const getDiagnosticsAsync = async (): Promise<Diagnostic[]> => {
  const base = getDiagnostics();

  // Clone so we can modify details
  const results = base.map((d) => ({ ...d }));

  // Ping EmailJS public API
  const emailDiag = results.find((r) => r.key === 'emailjs');
  if (emailDiag) {
    try {
      const ping = await fetchWithTimeout('https://api.emailjs.com', 2500);
      if (ping.reachable !== false) {
        emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + 'Network: reachable.';
        emailDiag.ok = emailDiag.ok !== false ? true : false;
      } else {
        emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + `Network: unreachable (${ping.error}).`;
        emailDiag.ok = false;
      }
      if (ping.reachable && !ping.ok) {
        emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + `Service responded with status ${ping.status}.`;
      }
    } catch (e) {
      emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + `Network check failed.`;
      emailDiag.ok = false;
    }
  }

  // Ping Gemini proxy endpoint (relative or absolute)
  const gemDiag = results.find((r) => r.key === 'gemini');
  if (gemDiag) {
    const endpoint = (import.meta.env.VITE_GEMINI_PROXY_ENDPOINT || '/api/gemini').trim();
    try {
      const ping = await fetchWithTimeout(endpoint, 2500, { method: 'GET', mode: 'cors' });
      if (ping.reachable !== false) {
        gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + 'Proxy reachable.';
        gemDiag.ok = ping.ok && gemDiag.ok !== false;
      } else {
        gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + `Proxy unreachable (${ping.error}).`;
        gemDiag.ok = false;
      }
      if (ping.reachable && !ping.ok) {
        gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + `Proxy responded with status ${ping.status}.`;
      }
    } catch (e) {
      gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + 'Proxy check failed.';
      gemDiag.ok = false;
    }
  }

  return results;
};

export type { Diagnostic };
