// Vercel Serverless Function: /api/health
import { URL } from 'url';

const fetchWithTimeout = async (url, timeoutMs = 3000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok, status: res.status, reachable: true };
  } catch (err) {
    clearTimeout(id);
    return { ok: false, reachable: false, error: err?.message || String(err) };
  }
};

const checkEnv = () => {
  const items = {};
  items.VITE_GEMINI_API_KEY = !!(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY);
  items.VITE_EMAILJS_SERVICE_ID = !!process.env.VITE_EMAILJS_SERVICE_ID;
  items.VITE_EMAILJS_TEMPLATE_ID = !!process.env.VITE_EMAILJS_TEMPLATE_ID;
  items.VITE_EMAILJS_PUBLIC_KEY = !!process.env.VITE_EMAILJS_PUBLIC_KEY;
  items.FIREBASE = !!(
    process.env.VITE_FIREBASE_API_KEY &&
    process.env.VITE_FIREBASE_AUTH_DOMAIN &&
    process.env.VITE_FIREBASE_PROJECT_ID &&
    process.env.VITE_FIREBASE_STORAGE_BUCKET &&
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.VITE_FIREBASE_APP_ID
  );
  return items;
};

export default async function handler(req, res) {
  const env = checkEnv();

  const checks = [];

  checks.push((async () => {
    const ping = await fetchWithTimeout('https://api.emailjs.com', 3000);
    return { key: 'emailjs', network: ping, configured: env.VITE_EMAILJS_SERVICE_ID && env.VITE_EMAILJS_TEMPLATE_ID && env.VITE_EMAILJS_PUBLIC_KEY };
  })());

  checks.push((async () => {
    const ping = await fetchWithTimeout('https://generativelanguage.googleapis.com', 3000);
    return { key: 'gemini', network: ping, configured: env.VITE_GEMINI_API_KEY };
  })());

  const results = await Promise.all(checks);

  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({ ok: true, env, results, timestamp: new Date().toISOString() }));
}
