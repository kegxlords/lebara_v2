import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSiteSettings, publicSiteSettings } from '../../lib/site-settings';

const DEFAULT_BANNERS = [
  { image_url: '', href: '/packages', alt: 'Explore Lebara plans' },
  { image_url: '', href: '/recharge', alt: 'Add funds securely' },
  { image_url: '', href: '/team', alt: 'Grow your team' }
];

function parseSetting(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value || fallback;
}

function maskPerson(user) {
  const raw = user?.full_name || user?.phone || 'Member';
  if (raw.length <= 3) return `${raw.slice(0, 1)}**`;
  return `${raw.slice(0, 1)}**${raw.slice(-1)}`;
}

async function depositStatus(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;
  const ref = String(req.query.ref || '');
  if (!ref) return res.status(400).json({ error: 'Reference is required' });
  const { data, error } = await supabaseAdmin
    .from('recharge_requests')
    .select('amount, status, provider_ref')
    .eq('provider_ref', ref)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to check deposit status' });
  if (!data) return res.status(404).json({ error: 'Deposit request not found' });
  const status = data.status === 'approved'
    ? 'approved'
    : ['rejected', 'failed'].includes(data.status) ? 'rejected' : 'pending';
  return res.status(200).json({ status, amount: Number(data.amount) || 0, ref: data.provider_ref });
}

async function redeemGiftCode(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAuth(req, res);
  if (!user) return;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Gift code is required' });
  try {
    const { data, error } = await supabaseAdmin.rpc('redeem_gift_code', { p_user_id: user.id, p_code: code });
    if (error) throw error;
    if (!data?.success) {
      const message = data?.error || 'Gift redemption could not be completed.';
      const status = message.toLowerCase().includes('already redeemed') ? 409 : message.toLowerCase().includes('invalid') ? 404 : 400;
      return res.status(status).json({ error: message });
    }
    const amount = Number(data.amount) || 0;
    return res.status(200).json({ success: true, amount, message: `Gift redeemed. ₦${amount.toLocaleString()} has been added to your wallet.` });
  } catch (error) {
    console.error('Gift code error:', error.message || error);
    const code = error?.code || '';
    const message = String(error?.message || '');
    if (code === '42883' || /function .*redeem_gift_code.* does not exist/i.test(message)) {
      return res.status(503).json({ error: 'Gift redemption is not configured. Run the gift-code SQL migration in Supabase.' });
    }
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return res.status(503).json({ error: 'Gift redemption storage is missing. Run the gift-code SQL migration in Supabase.' });
    }
    if (code === '42703' || /column .* does not exist/i.test(message)) {
      return res.status(503).json({ error: 'Gift redemption storage is missing a required column. Re-run the gift-code SQL migration.' });
    }
    return res.status(500).json({ error: 'Gift redemption failed. Check the gift-code database migration and Supabase logs.' });
  }
}

async function listOrders(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const { data, error } = await supabaseAdmin
      .from('user_packages')
      .select('*, packages(name, image_url, daily_income, days)')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });
    if (error) throw error;
    const nowMs = Date.now();
    const duePackages = (data || []).filter((op) => {
      if (op.status !== 'active' || Number(op.days_collected) >= Number(op.days)) return false;
      const nextDropMs = new Date(op.purchased_at).getTime() + ((Number(op.days_collected || 0) + 1) * 86400000);
      return Number.isFinite(nextDropMs) && nowMs >= nextDropMs;
    });
    for (const op of duePackages) {
      const { error: incomeError } = await supabaseAdmin.rpc('process_daily_income', {
        p_user_id: op.user_id,
        p_pkg_id: op.id,
        p_amount: Number(op.packages?.daily_income) || Number(op.daily_income) || 0,
        p_new_day_count: Number(op.days_collected || 0) + 1,
        p_total_days: Number(op.days) || Number(op.packages?.days) || 0
      });
      if (incomeError) console.error('Order-page income reconciliation failed:', incomeError.message || incomeError);
    }
    const refreshed = duePackages.length
      ? await supabaseAdmin.from('user_packages').select('*, packages(name, image_url, daily_income, days)').eq('user_id', user.id).order('purchased_at', { ascending: false })
      : { data, error: null };
    if (refreshed.error) throw refreshed.error;
    const orders = (refreshed.data || []).map((op) => {
      const purchaseDate = new Date(op.purchased_at);
      const nextDropMs = purchaseDate.getTime() + ((op.days_collected + 1) * 24 * 60 * 60 * 1000);
      const diffSecs = Math.floor((nextDropMs - nowMs) / 1000);
      return {
        ...op,
        name: op.packages?.name,
        image_url: op.packages?.image_url,
        daily_income: op.packages?.daily_income,
        days: op.packages?.days,
        next_drop_seconds: diffSecs > 0 ? diffSecs : 0,
        is_complete: op.status === 'completed'
      };
    });
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load orders' });
  }
}

async function passwordReset(req, res) {
  if (req.method === 'POST') {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier required' });
    const { data: user } = await supabaseAdmin
      .from('users').select('id, email, phone').or(`phone.eq.${identifier},email.eq.${identifier}`).single();
    if (!user) return res.status(200).json({ message: 'If account exists, link sent.' });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000);
    await supabaseAdmin.from('password_resets').delete().eq('user_id', user.id);
    await supabaseAdmin.from('password_resets').insert({
      user_id: user.id, token_hash: tokenHash, expires_at: expiresAt.toISOString()
    });
    console.log(`RESET LINK FOR ${user.phone}: /reset-password?token=${rawToken}`);
    return res.status(200).json({ message: 'Reset link generated.' });
  }
  if (req.method === 'PUT') {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: record } = await supabaseAdmin.from('password_resets').select('*')
      .eq('token_hash', tokenHash).gt('expires_at', new Date().toISOString()).single();
    if (!record) return res.status(400).json({ error: 'Invalid or expired token' });
    const salt = await bcrypt.genSalt(10);
    const hashedNewPass = await bcrypt.hash(newPassword, salt);
    await supabaseAdmin.from('users').update({ password_hash: hashedNewPass }).eq('id', record.user_id);
    await supabaseAdmin.from('password_resets').delete().eq('token_hash', tokenHash);
    return res.status(200).json({ success: true });
  }
  return res.status(405).end();
}

async function publicSettings(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const [{ data: settings }, { data: transactions }] = await Promise.all([
      supabaseAdmin.from('settings').select('key, value').in('key', ['dashboard_banners', 'dashboard_notifications']),
      supabaseAdmin.from('transactions').select('type, amount, created_at, user_id')
        .in('type', ['deposit', 'purchase', 'bonus', 'sign_bonus']).order('created_at', { ascending: false }).limit(20)
    ]);
    const settingMap = Object.fromEntries((settings || []).map((item) => [item.key, item.value]));
    const ids = [...new Set((transactions || []).map((item) => item.user_id).filter(Boolean))];
    const { data: users } = ids.length
      ? await supabaseAdmin.from('users').select('id, full_name, phone').in('id', ids)
      : { data: [] };
    const usersById = Object.fromEntries((users || []).map((item) => [item.id, item]));
    const notifications = (transactions || []).map((item) => {
      const person = maskPerson(usersById[item.user_id]);
      const amount = `₦${Number(item.amount || 0).toLocaleString()}`;
      const label = item.type === 'deposit' ? 'deposited'
        : item.type === 'purchase' ? 'invested'
          : item.type === 'bonus' ? 'earned a referral bonus' : 'claimed a daily reward';
      return { text: `user ${person} ${label}`, amount, created_at: item.created_at };
    });
    const configuredNotifications = parseSetting(settingMap.dashboard_notifications, []);
    const siteSettings = publicSiteSettings(await getSiteSettings());
    return res.status(200).json({
      banners: parseSetting(settingMap.dashboard_banners, DEFAULT_BANNERS),
      notifications: configuredNotifications.length ? configuredNotifications : notifications,
      ...siteSettings
    });
  } catch (error) {
    console.error('Dashboard content error:', error);
    return res.status(200).json({ banners: DEFAULT_BANNERS, notifications: [] });
  }
}

async function team(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const { data: profile } = await supabaseAdmin.from('users').select('phone, referral_code').eq('id', user.id).single();
    const { data: members } = await supabaseAdmin.from('users')
      .select('id, full_name, phone, activated_at, created_at').eq('referred_by', user.id).order('created_at', { ascending: false });
    let totalComm = 0;
    const commMap = {};
    if (members && members.length > 0) {
      const { data: comms = [] } = await supabaseAdmin.from('transactions').select('amount, meta')
        .eq('user_id', user.id).eq('type', 'bonus').like('reference', 'comm_l1_%');
      comms.forEach((commission) => {
        let meta = commission.meta || {};
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch { meta = {}; }
        }
        const fromUid = meta.from_user;
        if (fromUid) {
          commMap[fromUid] = (commMap[fromUid] || 0) + parseFloat(commission.amount);
          totalComm += parseFloat(commission.amount);
        }
      });
    }
    const enrichedMembers = (members || []).map((member) => ({
      ...member, commission_earned: commMap[member.id] || 0
    }));
    const activeRefs = members ? members.filter((member) => member.activated_at).length : 0;
    return res.status(200).json({
      userPhone: profile?.phone || '',
      referralCode: profile?.referral_code || '',
      members: enrichedMembers,
      stats: { l1Count: members?.length || 0, l1Active: activeRefs, totalComm }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch team' });
  }
}

export default async function handler(req, res) {
  const route = Array.isArray(req.query.route) ? req.query.route.join('/') : String(req.query.route || '');
  switch (route) {
    case 'deposit-status': return depositStatus(req, res);
    case 'gift-code': return redeemGiftCode(req, res);
    case 'orders': return listOrders(req, res);
    case 'password-reset': return passwordReset(req, res);
    case 'public-settings': return publicSettings(req, res);
    case 'team': return team(req, res);
    default: return res.status(404).json({ error: 'API route not found' });
  }
}
