import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import axios from 'axios';
import { generateAfrStarSign } from '../../lib/crypto';
import bcrypt from 'bcryptjs';
import { getSiteSettings, withdrawalWindowStatus } from '../../lib/site-settings';

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return null;
  return Math.round(amount * 100) / 100;
}

function nigeriaDayStart() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  // Nigeria uses UTC+1 year-round.
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) - 60 * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { amount, bankId, pin } = req.body || {};
  const grossAmount = parseAmount(amount);
  if (!grossAmount) return res.status(400).json({ error: 'Enter a valid amount with up to two decimal places.' });

  let settings;
  try { settings = await getSiteSettings(); }
  catch (error) {
    console.error('Withdrawal settings unavailable:', error.message);
    return res.status(503).json({ error: 'Withdrawal settings are temporarily unavailable.' });
  }
  const minimum = Number(settings.wd_min_amount) || 0;
  const maximum = Number(settings.wd_max_amount) || 0;
  if (minimum > 0 && grossAmount < minimum) return res.status(400).json({ error: `Minimum withdrawal is ₦${minimum.toLocaleString()}.` });
  if (maximum > 0 && grossAmount > maximum) return res.status(400).json({ error: `Maximum withdrawal is ₦${maximum.toLocaleString()}.` });
  const window = withdrawalWindowStatus(settings);
  if (!window.isOpen) return res.status(403).json({ error: window.reason || 'Withdrawals are currently closed.' });

  const feePercent = Number(settings.withdrawal_fee_pct) || 0;
  const feeFixed = Number(settings.withdrawal_fee_fixed) || 0;
  const fee = Math.round((grossAmount * feePercent / 100 + feeFixed + Number.EPSILON) * 100) / 100;
  const payoutAmount = Math.round((grossAmount - fee + Number.EPSILON) * 100) / 100;
  if (payoutAmount <= 0) return res.status(400).json({ error: 'The configured withdrawal charge must be lower than the requested amount.' });

  try {
    const { data: dbUser, error: userError } = await supabaseAdmin.from('users')
      .select('withdrawal_pin_hash').eq('id', user.id).maybeSingle();
    if (userError) throw userError;
    if (!dbUser?.withdrawal_pin_hash) return res.status(400).json({ error: 'Set your withdrawal PIN in settings first.' });
    if (typeof pin !== 'string' || !(await bcrypt.compare(pin, dbUser.withdrawal_pin_hash))) return res.status(401).json({ error: 'Incorrect PIN.' });

    const { data: bankRecord, error: bankError } = await supabaseAdmin.from('user_banks')
      .select('*').eq('id', bankId).eq('user_id', user.id).maybeSingle();
    if (bankError) throw bankError;
    if (!bankRecord) return res.status(404).json({ error: 'Bank account not found.' });

    const { data: wallet, error: walletError } = await supabaseAdmin.from('wallets')
      .select('income_balance').eq('user_id', user.id).maybeSingle();
    if (walletError) throw walletError;
    if (!wallet || Number(wallet.income_balance) < grossAmount) return res.status(400).json({ error: 'Insufficient withdrawable balance.' });

    const dailyLimit = Math.max(1, Math.min(100, Number(settings.wd_daily_limit) || 3));
    const { count: withdrawalsToday, error: countError } = await supabaseAdmin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', nigeriaDayStart())
      .in('status', ['pending', 'processing', 'paid']);
    if (countError) throw countError;
    if ((withdrawalsToday || 0) >= dailyLimit) {
      return res.status(429).json({ error: `Daily withdrawal limit reached. You can make up to ${dailyLimit} withdrawal${dailyLimit === 1 ? '' : 's'} per day.` });
    }

    const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
    const accessKey = process.env.AFRSTAR_ACCESS_KEY;
    const secretKey = process.env.AFRSTAR_SECRET_KEY;
    const baseUrl = String(process.env.AFRSTAR_BASE_URL || 'https://ngn.afrstar.com').replace(/\/+$/, '');
    if (!merchantSn || !accessKey || !secretKey) return res.status(503).json({ error: 'Payout provider is not configured.' });

    const orderRef = `WD-${user.id}-${Date.now()}`;
    const mode = settings.withdrawal_mode === 'manual' ? 'manual' : 'automatic';
    const { data: wdRecord, error: wdError } = await supabaseAdmin.from('withdrawals').insert({
      user_id: user.id,
      amount: grossAmount.toFixed(2),
      payout_amount: payoutAmount.toFixed(2),
      fee_amount: fee.toFixed(2),
      bank_code: bankRecord.bank_code,
      account_number: bankRecord.account_number,
      account_name: bankRecord.account_name,
      provider_ref: orderRef,
      status: mode === 'manual' ? 'pending' : 'processing',
      error_msg: JSON.stringify({ bank_id: bankId, payout_mode: mode })
    }).select('*').single();
    if (wdError) throw wdError;

    const { error: holdError } = await supabaseAdmin.rpc('deduct_for_withdrawal', {
      p_user_id: user.id,
      p_amount: grossAmount.toFixed(2)
    });
    if (holdError) {
      await supabaseAdmin.from('withdrawals').update({ status: 'failed', error_msg: 'Balance hold failed.' }).eq('id', wdRecord.id);
      throw holdError;
    }

    if (mode === 'manual') {
      return res.status(200).json({
        success: true,
        status: 'pending',
        ref: orderRef,
        amount: grossAmount,
        fee,
        payoutAmount,
        message: 'Withdrawal request is held securely until an administrator approves it.'
      });
    }

    const amountText = payoutAmount.toFixed(2);
    const sign = generateAfrStarSign(accessKey, orderRef, bankRecord.account_number, '', amountText, secretKey);
    const payload = {
      merchant_sn: merchantSn,
      order_sn: orderRef,
      amount: amountText,
      type: 'bank',
      name: bankRecord.account_name,
      account: bankRecord.account_number,
      ifsc: bankRecord.bank_code,
      upi_handle: '',
      remark: 'Lebara Payout',
      sign
    };
    try {
      const { data: result } = await axios.post(`${baseUrl}/gateway/payout/`, payload, {
        headers: { 'Content-Type': 'application/json' }, timeout: 10000
      });
      if (result?.code !== 0) {
        const { error: refundError } = await supabaseAdmin.rpc('refund_withdrawal_failure', {
          p_wd_id: wdRecord.id, p_reason: String(result?.message || 'AfrStar rejected payout').slice(0, 240)
        });
        if (refundError) throw refundError;
        return res.status(400).json({ error: result?.message || 'Gateway rejected the withdrawal.' });
      }
      const platformOsn = result.data?.platform_osn || null;
      const { error: updateError } = await supabaseAdmin.from('withdrawals').update({ platform_osn: platformOsn }).eq('id', wdRecord.id);
      if (updateError) throw updateError;
      return res.status(200).json({ success: true, status: 'processing', ref: orderRef, amount: grossAmount, fee, payoutAmount });
    } catch (error) {
      if (error.response) {
        console.error('AfrStar rejected payout:', error.response.data || error.message);
        const { error: refundError } = await supabaseAdmin.rpc('refund_withdrawal_failure', {
          p_wd_id: wdRecord.id, p_reason: 'AfrStar payout request failed.'
        });
        if (refundError) console.error('Withdrawal refund failed:', refundError.message);
        return res.status(502).json({ error: 'Payout provider rejected the request; check your balance and withdrawal history.' });
      }
      // A timeout may occur after AfrStar accepted the order. Keep the wallet hold and
      // reconcile by order_sn/callback rather than risk a duplicate payout.
      console.error('AfrStar payout outcome is uncertain:', error.message || error);
      return res.status(502).json({ error: 'Provider response was not confirmed. Your balance remains held while the payout is reconciled.' });
    }
  } catch (error) {
    console.error('Withdrawal processing error:', error.message || error);
    return res.status(500).json({ error: 'Unable to process withdrawal.' });
  }
}
