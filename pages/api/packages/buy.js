import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import { canPurchasePackage } from '../../../lib/package-access';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await requireAuth(req, res); if (!user) return;
  const packageId = req.body?.packageId;
  if (!packageId) return res.status(400).json({ error: 'Package ID required' });
  let purchaseAttempted = false;
  try {
    const [{ data: pkg, error: packageError }, { data: wallet, error: walletError }] = await Promise.all([
      supabaseAdmin.from('packages').select('*').eq('id', packageId).eq('is_active', true).maybeSingle(),
      supabaseAdmin.from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
    ]);
    if (packageError || walletError) throw packageError || walletError;
    if (!pkg || pkg.is_active === false || pkg.is_locked) return res.status(404).json({ error: 'Package unavailable' });
    if (!(await canPurchasePackage(user.id, pkg))) return res.status(403).json({ error: `This VIP plan requires ${Number(pkg.vip_required_invites)} activated referrals.` });
    const before = Number(wallet?.balance) || 0;
    const price = Number(pkg.price) || 0;
    if (before < price) return res.status(400).json({ error: 'Insufficient balance' });

    purchaseAttempted = true;
    const rpcResult = await supabaseAdmin.rpc('buy_package', {
      p_user_id: user.id, p_pkg_id: pkg.id, p_price: price,
      p_daily: Number(pkg.daily_income) || 0, p_total: Number(pkg.total_income) || 0,
      p_days: Number(pkg.days) || 0
    });
    if (rpcResult.error) throw rpcResult.error;
    return res.status(200).json({ success: true, packageId: pkg.id });
  } catch (error) {
    console.error('Package purchase error:', error);
    const message = purchaseAttempted
      ? 'Purchase result could not be confirmed. Check your orders before retrying, or contact support.'
      : 'Purchase could not be completed.';
    return res.status(purchaseAttempted ? 502 : 500).json({ error: message });
  }
}
