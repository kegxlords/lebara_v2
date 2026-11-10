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

export async function getPackagePurchaseCount(userId, packageId) {
  const { count, error } = await supabaseAdmin
    .from('user_packages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('package_id', packageId)
    .gt('price_paid', 0);
  if (error) throw error;
  return count || 0;
}

export function packagePurchaseLimit(pkg) {
  const limit = Number.parseInt(pkg?.max_purchase, 10);
  return Number.isInteger(limit) && limit > 0 ? limit : 0;
}

export function packageLimitMessage(pkg, purchasedCount) {
  const limit = packagePurchaseLimit(pkg);
  if (!limit || purchasedCount < limit) return null;
  return `You have reached the maximum of ${limit} purchase${limit === 1 ? '' : 's'} for this package.`;
}
