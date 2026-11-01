import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = requireAuth(req, res); if (!user) return;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Gift code is required' });
  try {
    const { data: gift, error: giftError } = await supabaseAdmin.from('gift_codes').select('*').eq('code', code).maybeSingle();
    if (giftError) throw giftError;
    if (!gift || gift.is_active === false) return res.status(404).json({ error: 'This gift code is invalid or inactive.' });
    if (gift.expires_at && new Date(gift.expires_at) < new Date()) return res.status(400).json({ error: 'This gift code has expired.' });
    if (gift.max_uses && Number(gift.used_count || 0) >= Number(gift.max_uses)) return res.status(400).json({ error: 'This gift code has already reached its usage limit.' });
    const { data: used } = await supabaseAdmin.from('gift_code_redemptions').select('id').eq('gift_code_id', gift.id).eq('user_id', user.id).maybeSingle();
    if (used) return res.status(409).json({ error: 'You have already redeemed this gift code.' });
    const amount = Number(gift.amount || gift.value || 0);
    if (amount <= 0) return res.status(400).json({ error: 'This gift code has no reward attached.' });
    const credit = await supabaseAdmin.rpc('credit_wallet', { p_user_id: user.id, p_amount: amount, p_type: 'gift_code' });
    if (credit.error) throw credit.error;
    const { error: redemptionError } = await supabaseAdmin.from('gift_code_redemptions').insert({ gift_code_id: gift.id, user_id: user.id, amount });
    if (redemptionError) throw redemptionError;
    await supabaseAdmin.from('gift_codes').update({ used_count: Number(gift.used_count || 0) + 1 }).eq('id', gift.id);
    return res.status(200).json({ success: true, amount, message: `Gift redeemed. ${`₦${amount.toLocaleString()}`} has been added to your wallet.` });
  } catch (error) {
    console.error('Gift code error:', error);
    return res.status(500).json({ error: 'Gift redemption is temporarily unavailable.' });
  }
}
