import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Package ID is required' });
  const [{ data: pkg, error: packageError }, { data: wallet, error: walletError }] = await Promise.all([
    supabaseAdmin.from('packages').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
  ]);
  if (packageError || walletError) return res.status(500).json({ error: 'Unable to load plan details' });
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  return res.status(200).json({ pkg, balance: Number(wallet?.balance) || 0 });
}
