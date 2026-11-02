import { supabaseAdmin } from '../../lib/supabase';
import crypto from 'crypto';

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 1024 * 1024;

function respond(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'text/plain');
  return res.end(body);
}

function amountToTwoDecimals(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (Math.abs(amount - rounded) > 0.000001) return null;
  return rounded.toFixed(2);
}

function signatureMatches(expected, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]{32}$/i.test(received)) return false;
  const expectedBytes = Buffer.from(expected, 'hex');
  const receivedBytes = Buffer.from(received, 'hex');
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

async function readPayload(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  let payload;
  try { payload = await readPayload(req); }
  catch (error) { return respond(res, error.statusCode || 400, error.statusCode === 413 ? 'PAYLOAD-TOO-LARGE' : 'INVALID-JSON'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return respond(res, 400, 'INVALID-PAYLOAD');

  const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
  const ak = process.env.AFRSTAR_ACCESS_KEY;
  const sk = process.env.AFRSTAR_SECRET_KEY;
  if (!merchantSn || !ak || !sk) {
    console.error('AfrStar webhook credentials are not configured');
    return respond(res, 500, 'CONFIGURATION-ERROR');
  }
  if (payload.merchant_sn !== merchantSn) return respond(res, 401, 'INVALID-MERCHANT');

  const orderRef = typeof payload.order_sn === 'string' ? payload.order_sn : '';
  const platformOsn = typeof payload.platform_osn === 'string' ? payload.platform_osn : '';
  const status = String(payload.status ?? '');
  if (!orderRef || !platformOsn || !status) return respond(res, 400, 'MISSING-FIELDS');

  const isAdminPayout = orderRef.startsWith('ADM-WD-');
  const isPayout = isAdminPayout || payload.time_transfered !== undefined || orderRef.startsWith('WD-');
  const isDeposit = !isPayout && (payload.amount_need !== undefined || orderRef.startsWith('DEP-'));
  if (!isDeposit && !isPayout) return respond(res, 400, 'UNKNOWN-TYPE');
  if (isPayout && !['1', '9'].includes(status)) return respond(res, 400, 'INVALID-PAYOUT-STATUS');

  try {
    let record;
    let signatureInput;
    let alreadyProcessed = false;

    if (isDeposit) {
      const { data, error } = await supabaseAdmin.from('recharge_requests')
        .select('id, amount, user_id, status, provider_ref')
        .eq('provider_ref', orderRef).maybeSingle();
      if (error) throw error;
      record = data;
      if (!record || record.provider_ref !== orderRef) return respond(res, 404, 'ORDER-NOT-FOUND');
      const originalAmount = amountToTwoDecimals(record.amount);
      if (!originalAmount) return respond(res, 400, 'INVALID-ORDER-AMOUNT');
      signatureInput = `${ak}${platformOsn}${status}${originalAmount}${sk}`;
      alreadyProcessed = ['approved', 'rejected', 'failed'].includes(record.status);
    } else if (isAdminPayout) {
      const { data, error } = await supabaseAdmin.from('admin_gateway_ledger')
        .select('id, amount, status, order_sn')
        .eq('order_sn', orderRef).eq('direction', 'withdrawal').maybeSingle();
      if (error) throw error;
      record = data;
      if (!record || record.order_sn !== orderRef) return respond(res, 404, 'ORDER-NOT-FOUND');
      const originalAmount = amountToTwoDecimals(record.amount);
      const callbackAmount = amountToTwoDecimals(payload.amount);
      if (!originalAmount || !callbackAmount || callbackAmount !== originalAmount) return respond(res, 400, 'AMOUNT-MISMATCH');
      signatureInput = `${ak}${platformOsn}${status}${callbackAmount}${sk}`;
      alreadyProcessed = ['paid', 'failed', 'completed'].includes(record.status);
    } else {
      const { data, error } = await supabaseAdmin.from('withdrawals')
        .select('id, amount, payout_amount, user_id, status, provider_ref')
        .eq('provider_ref', orderRef).maybeSingle();
      if (error) throw error;
      record = data;
      if (!record || record.provider_ref !== orderRef) return respond(res, 404, 'ORDER-NOT-FOUND');
      const originalAmount = amountToTwoDecimals(record.payout_amount ?? record.amount);
      const callbackAmount = amountToTwoDecimals(payload.amount);
      if (!originalAmount || !callbackAmount || callbackAmount !== originalAmount) return respond(res, 400, 'AMOUNT-MISMATCH');
      signatureInput = `${ak}${platformOsn}${status}${callbackAmount}${sk}`;
      alreadyProcessed = ['paid', 'failed'].includes(record.status);
    }

    const expected = crypto.createHash('md5').update(signatureInput).digest('hex');
    if (!signatureMatches(expected, payload.sign)) return respond(res, 401, 'BAD-SIGNATURE');
    if (alreadyProcessed) return respond(res, 200, 'SUCCESS');

    if (isDeposit) {
      if (status === '1') {
        const { error } = await supabaseAdmin.rpc('apply_deposit_success_with_referral_bonus', {
          p_user_id: record.user_id,
          p_request_id: record.id,
          p_amount: Number(record.amount)
        });
        if (error) throw error;
        const { error: updateError } = await supabaseAdmin.from('recharge_requests')
          .update({ status: 'approved', handled_at: new Date().toISOString(), platform_osn: platformOsn }).eq('id', record.id);
        if (updateError) throw updateError;
      } else {
        const { error } = await supabaseAdmin.from('recharge_requests')
          .update({ status: 'rejected', handled_at: new Date().toISOString(), platform_osn: platformOsn })
          .eq('id', record.id).not('status', 'in', '(approved,rejected,failed)');
        if (error) throw error;
      }
    } else if (isAdminPayout) {
      const { error } = await supabaseAdmin.from('admin_gateway_ledger')
        .update({ status: status === '1' ? 'paid' : 'failed', platform_osn: platformOsn, updated_at: new Date().toISOString() })
        .eq('id', record.id).eq('status', 'processing');
      if (error) throw error;
    } else {
      const payoutStatus = status === '1' ? 'paid' : 'failed';
      const detail = typeof payload.message === 'string' ? payload.message : `AfrStar payout ${payoutStatus}`;
      const { error } = await supabaseAdmin.rpc('apply_withdrawal_result', {
        p_wd_id: record.id,
        p_status: payoutStatus,
        p_detail: detail.slice(0, 240)
      });
      if (error) throw error;
    }
    return respond(res, 200, 'SUCCESS');
  } catch (error) {
    console.error('AfrStar webhook processing failed:', error.message || error);
    return respond(res, 500, 'PROCESSING-ERROR');
  }
}
