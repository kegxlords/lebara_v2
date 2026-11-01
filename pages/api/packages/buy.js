import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const packageId = req.body?.packageId;
  if (!packageId) return res.status(400).json({ error: 'Package ID required' });
  try {
    const [{ data: pkg, error: packageError }, { data: wallet, error: walletError }] = await Promise.all([
      supabaseAdmin.from('packages').select('*').eq('id', packageId).maybeSingle(),
      supabaseAdmin.from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
    ]);
    if (packageError || walletError) throw packageError || walletError;
    if (!pkg || pkg.is_locked) return res.status(404).json({ error: 'Package unavailable' });
    const before = Number(wallet?.balance) || 0;
    const price = Number(pkg.price) || 0;
    if (before < price) return res.status(400).json({ error: 'Insufficient balance' });

    const rpcResult = await supabaseAdmin.rpc('buy_package', {
      p_user_id: user.id, p_pkg_id: pkg.id, p_price: price,
      p_daily: Number(pkg.daily_income) || 0, p_total: Number(pkg.total_income) || 0,
      p_days: Number(pkg.days) || 0
    });
    if (rpcResult.error) {
      const { data: updatedWallet, error: updateError } = await supabaseAdmin
        .from('wallets').update({ balance: before - price }).eq('user_id', user.id)
        .gte('balance', price).select('balance').single();
      if (updateError || !updatedWallet) throw updateError || new Error('Wallet changed before purchase could be completed');
      const { error: orderError } = await supabaseAdmin.from('user_packages').insert({
        user_id: user.id, package_id: pkg.id, price_paid: price,
        days: Number(pkg.days) || 0, days_collected: 0, total_collected: 0, status: 'active'
      });
      if (orderError) throw orderError;
      const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
        user_id: user.id, type: 'purchase', direction: 'debit', amount: price,
        balance_after: before - price, reference: `buy_${user.id}_${Date.now()}`,
        meta: { package_id: pkg.id, package_name: pkg.name }
      });
      if (transactionError) throw transactionError;
    }
    return res.status(200).json({ success: true, packageId: pkg.id });
  } catch (error) {
    console.error('Package purchase error:', error);
    return res.status(500).json({ error: 'Purchase could not be completed. No balance was confirmed as deducted.' });
  }
}
