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

  // Gemini / AI key
  const apiKeyFromVite = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  const apiKeyFromProcess = typeof process !== 'undefined'
    ? process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY || process.env?.API_KEY
    : undefined;
  const computedKey = (apiKeyFromVite || apiKeyFromProcess || '').trim();

  if (isApiAvailable()) {
    diagnostics.push({ key: 'gemini', ok: true, message: 'Gemini AI client initialized.' });
  } else if (computedKey) {
    diagnostics.push({ key: 'gemini', ok: false, message: 'Gemini client failed to initialize with provided key.', detail: 'Check the key value and network access.' });
  } else {
    diagnostics.push({ key: 'gemini', ok: false, message: 'Gemini API key missing.', detail: 'Set VITE_GEMINI_API_KEY or GEMINI_API_KEY or API_KEY.' });
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

const fetchWithTimeout = async (url: string, timeoutMs = 3000): Promise<{ ok: boolean; error?: string }> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    // Use HEAD when possible, fallback to GET if not allowed
    const res = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    // Could be network or CORS error; return the message when available
    return { ok: false, error: err?.message || String(err) };
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
      if (ping.ok) {
        emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + 'Network: reachable.';
        emailDiag.ok = emailDiag.ok !== false ? true : false;
      } else {
        emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + `Network: unreachable (${ping.error}).`;
        emailDiag.ok = false;
      }
    } catch (e) {
      emailDiag.detail = (emailDiag.detail ? emailDiag.detail + ' ' : '') + `Network check failed.`;
      emailDiag.ok = false;
    }
  }

  // Ping Gemini/Generative API domain if key present
  const gemDiag = results.find((r) => r.key === 'gemini');
  if (gemDiag) {
    const apiKeyFromVite = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    const apiKeyFromProcess = typeof process !== 'undefined'
      ? process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY || process.env?.API_KEY
      : undefined;
    const computedKey = (apiKeyFromVite || apiKeyFromProcess || '').trim();
    if (computedKey) {
      try {
        const ping = await fetchWithTimeout('https://generativelanguage.googleapis.com', 2500);
        if (ping.ok) {
          gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + 'Network: reachable.';
          gemDiag.ok = gemDiag.ok !== false ? true : false;
        } else {
          gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + `Network: unreachable (${ping.error}).`;
          gemDiag.ok = false;
        }
      } catch (e) {
        gemDiag.detail = (gemDiag.detail ? gemDiag.detail + ' ' : '') + `Network check failed.`;
        gemDiag.ok = false;
      }
    }
  }

  return results;
};

export type { Diagnostic };
