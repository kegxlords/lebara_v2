import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
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
  const status = data.status === 'approved' ? 'approved' : ['rejected', 'failed'].includes(data.status) ? 'rejected' : 'pending';
  return res.status(200).json({ status, amount: Number(data.amount) || 0, ref: data.provider_ref });
}
