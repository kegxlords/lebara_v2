import { supabaseAdmin } from './supabase';
import { requireAuth } from './auth';
import { DEFAULT_SITE_SETTINGS, getSiteSettings } from './site-settings';

export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  const { data: account, error } = await supabaseAdmin.from('users')
    .select('id, is_admin').eq('id', user.id).maybeSingle();
  if (error) {
    res.status(503).json({ error: 'Administrator status could not be verified.' });
    return null;
  }
  if (!account?.is_admin) {
    res.status(403).json({ error: 'Administrator access required.' });
    return null;
  }
  return { ...user, is_admin: true };
}

export function hasSameOrigin(req) {
  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

export function safeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  for (const key of [
    'password_hash', 'withdrawal_pin_hash', 'token_hash', 'reset_token',
    'access_token', 'refresh_token', 'admin_password_hash'
  ]) delete safe[key];
  return safe;
}

function parseStored(value) {
  let parsed = value;
  for (let i = 0; i < 2 && typeof parsed === 'string'; i += 1) {
    try { parsed = JSON.parse(parsed); } catch { break; }
  }
  return parsed;
}

export async function readAdminSettings() {
  const { data, error } = await supabaseAdmin.from('settings').select('key, value');
  if (error) throw error;
  const values = Object.fromEntries((data || []).map((row) => [row.key, parseStored(row.value)]));
  return { ...DEFAULT_SITE_SETTINGS, ...values };
}

export { getSiteSettings };

export async function saveSetting(key, value) {
  const { error } = await supabaseAdmin.from('settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  if (error) throw error;
}

export async function writeAdminAudit(adminId, action, entityType, entityId, details = {}) {
  const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    details
  });
  if (error) throw error;
}

export function safePageParams(query, defaultLimit = 50, maxLimit = 100) {
  const page = Math.max(0, Number.parseInt(query.page, 10) || 0);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, from: page * limit, to: page * limit + limit - 1 };
}
