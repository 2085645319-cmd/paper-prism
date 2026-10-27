import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST_DIR = path.join(ROOT, 'dist');

function readEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

readEnvFile();

function deepSeekKeyFromDshHome() {
  const file = path.join(os.homedir(), '.dsh', '.credentials.yaml');
  if (!fs.existsSync(file)) return '';
  try {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/^\s*DEEPSEEK_API_KEY:\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

export const CONFIG = {
  port: Number(process.env.PORT || 8790),
  deepseekBaseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  deepseekKey: process.env.DEEPSEEK_API_KEY || deepSeekKeyFromDshHome(),
  contactEmail: process.env.CONTACT_EMAIL || 'prism.research@example.com',
  cacheTtlMs: Number(process.env.CACHE_TTL_MS || 1000 * 60 * 20),
  maxPapers: Number(process.env.MAX_PAPERS || 18),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 18000)
};

export function hasLLM() {
  return Boolean(CONFIG.deepseekKey);
}
