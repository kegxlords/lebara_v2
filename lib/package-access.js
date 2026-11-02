import { supabaseAdmin } from './supabase';

export async function canPurchasePackage(userId, pkg) {
  const required = Math.max(0, Number(pkg?.vip_required_invites) || 0);
  if (String(pkg?.category || 'general').toLowerCase() !== 'vip' || required === 0) return true;
  const { count, error } = await supabaseAdmin.from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', userId)
    .not('activated_at', 'is', null);
  if (error) throw error;
  return (count || 0) >= required;
}
