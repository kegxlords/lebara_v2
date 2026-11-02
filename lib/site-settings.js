import { supabaseAdmin } from './supabase';

export const DEFAULT_SITE_SETTINGS = {
  dep_min_amount: 1000,
  dep_max_amount: 0,
  wd_min_amount: 1000,
  wd_max_amount: 1000000,
  wd_daily_limit: 3,
  wd_hours_start: '00:00',
  wd_hours_end: '23:59',
  wd_days: [0, 1, 2, 3, 4, 5, 6],
  wd_schedule_enabled: false,
  withdrawal_mode: 'automatic',
  withdrawal_fee_pct: 0,
  withdrawal_fee_fixed: 0,
  whatsapp_group_url: process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || '',
  welcome_bonus: 0,
  referral_deposit_bonus_l1_pct: 0,
  referral_deposit_bonus_l2_pct: 0
};

function parseStoredValue(value) {
  let parsed = value;
  for (let i = 0; i < 2 && typeof parsed === 'string'; i += 1) {
    try { parsed = JSON.parse(parsed); } catch { break; }
  }
  return parsed;
}

export async function getSiteSettings() {
  const keys = Object.keys(DEFAULT_SITE_SETTINGS);
  const { data, error } = await supabaseAdmin.from('settings').select('key, value').in('key', keys);
  if (error) throw error;
  const stored = Object.fromEntries((data || []).map((row) => [row.key, parseStoredValue(row.value)]));
  return { ...DEFAULT_SITE_SETTINGS, ...stored };
}

export function publicSiteSettings(settings) {
  return {
    dep_min_amount: Number(settings.dep_min_amount) || 0,
    dep_max_amount: Number(settings.dep_max_amount) || 0,
    wd_min_amount: Number(settings.wd_min_amount) || 0,
    wd_max_amount: Number(settings.wd_max_amount) || 0,
    wd_daily_limit: Math.max(1, Math.min(100, Number(settings.wd_daily_limit) || 3)),
    wd_hours_start: settings.wd_hours_start || '00:00',
    wd_hours_end: settings.wd_hours_end || '23:59',
    wd_days: Array.isArray(settings.wd_days) ? settings.wd_days : DEFAULT_SITE_SETTINGS.wd_days,
    wd_schedule_enabled: Boolean(settings.wd_schedule_enabled),
    withdrawal_mode: settings.withdrawal_mode === 'manual' ? 'manual' : 'automatic',
    withdrawal_fee_pct: Number(settings.withdrawal_fee_pct) || 0,
    withdrawal_fee_fixed: Number(settings.withdrawal_fee_fixed) || 0,
    whatsapp_group_url: settings.whatsapp_group_url || '',
    welcome_bonus: Number(settings.welcome_bonus) || 0
  };
}

export function withdrawalWindowStatus(settings, now = new Date()) {
  if (!settings.wd_schedule_enabled) return { isOpen: true, reason: '' };
  const dayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos', weekday: 'short'
  }).formatToParts(now);
  const hourParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = weekdayIndex[dayParts.find((part) => part.type === 'weekday')?.value];
  const hour = Number(hourParts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(hourParts.find((part) => part.type === 'minute')?.value || 0);
  const currentMinutes = hour * 60 + minute;
  const parseTime = (value, fallback) => {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
  };
  const start = parseTime(settings.wd_hours_start, 0);
  const end = parseTime(settings.wd_hours_end, 1439);
  const days = Array.isArray(settings.wd_days) ? settings.wd_days.map(Number) : DEFAULT_SITE_SETTINGS.wd_days;
  const dayOpen = days.includes(day);
  const timeOpen = start <= end ? currentMinutes >= start && currentMinutes <= end : currentMinutes >= start || currentMinutes <= end;
  return {
    isOpen: dayOpen && timeOpen,
    reason: dayOpen ? `Withdrawals are available ${settings.wd_hours_start}–${settings.wd_hours_end} WAT.` : 'Withdrawals are closed today.'
  };
}
