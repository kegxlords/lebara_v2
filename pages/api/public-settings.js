import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

const DEFAULT_BANNERS = [
  { image_url: '', href: '/packages', alt: 'Explore Lebara plans' },
  { image_url: '', href: '/recharge', alt: 'Add funds securely' },
  { image_url: '', href: '/team', alt: 'Grow your team' }
];

function parseSetting(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return fallback; } }
  return value || fallback;
}

function maskPerson(user) {
  const raw = user?.full_name || user?.phone || 'Member';
  if (raw.length <= 3) return `${raw.slice(0, 1)}**`;
  return `${raw.slice(0, 1)}**${raw.slice(-1)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  try {
    const [{ data: settings }, { data: transactions }] = await Promise.all([
      supabaseAdmin.from('settings').select('key, value').in('key', ['dashboard_banners', 'dashboard_notifications']),
      supabaseAdmin.from('transactions').select('type, amount, created_at, user_id').in('type', ['deposit', 'purchase', 'bonus', 'sign_bonus']).order('created_at', { ascending: false }).limit(20)
    ]);
    const settingMap = Object.fromEntries((settings || []).map((item) => [item.key, item.value]));
    const ids = [...new Set((transactions || []).map((item) => item.user_id).filter(Boolean))];
    const { data: users } = ids.length ? await supabaseAdmin.from('users').select('id, full_name, phone').in('id', ids) : { data: [] };
    const usersById = Object.fromEntries((users || []).map((item) => [item.id, item]));
    const notifications = (transactions || []).map((item) => {
      const person = maskPerson(usersById[item.user_id]);
      const amount = `₦${Number(item.amount || 0).toLocaleString()}`;
      const label = item.type === 'deposit' ? 'deposited' : item.type === 'purchase' ? 'invested' : item.type === 'bonus' ? 'earned a referral bonus' : 'claimed a daily reward';
      return { text: `user ${person} ${label}`, amount: item.type === 'bonus' || item.type === 'sign_bonus' ? amount : amount, created_at: item.created_at };
    });
    const configuredNotifications = parseSetting(settingMap.dashboard_notifications, []);
    return res.status(200).json({
      banners: parseSetting(settingMap.dashboard_banners, DEFAULT_BANNERS),
      notifications: configuredNotifications.length ? configuredNotifications : notifications
    });
  } catch (error) {
    console.error('Dashboard content error:', error);
    return res.status(200).json({ banners: DEFAULT_BANNERS, notifications: [] });
  }
}
