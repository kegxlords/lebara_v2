import axios from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { generateAfrStarSign } from './crypto';
import { DEFAULT_SITE_SETTINGS, publicSiteSettings } from './site-settings';
import { hasSameOrigin, readAdminSettings, requireAdmin, safePageParams, safeUser, writeAdminAudit } from './admin-service';
import { NIGERIAN_BANKS } from './banks';

const PENDING_DEPOSIT_STATES = ['initiated', 'pending', 'processing'];
const SAFE_PAGE_LIMIT = 100;

function getParams(req) {
  return req.method === 'GET' ? req.query || {} : req.body || {};
}

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount - cents / 100) > 0.000001) return null;
  return cents / 100;
}

function publicSettingsShape(settings) {
  const publicSettings = publicSiteSettings(settings);
  return {
    ...publicSettings,
    withdrawal_fee_fixed: Number(settings.withdrawal_fee_fixed) || 0,
    referral_deposit_bonus_l1_pct: Number(settings.referral_deposit_bonus_l1_pct) || 0,
    referral_deposit_bonus_l2_pct: Number(settings.referral_deposit_bonus_l2_pct) || 0,
    wd_min_amount: publicSettings.wd_min_amount,
    wd_max_amount: publicSettings.wd_max_amount,
    dep_min_amount: publicSettings.dep_min_amount,
    dep_max_amount: publicSettings.dep_max_amount
  };
}

function safeFinancialRows(rows) {
  return (rows || []).map((row) => {
    const safe = { ...row };
    if (safe.account_number) {
      safe.account_number_masked = `••••${String(safe.account_number).slice(-4)}`;
      delete safe.account_number;
    }
    return safe;
  });
}

function safeLedgerRows(rows) {
  return (rows || []).map((row) => {
    const safe = { ...row };
    if (safe.details && typeof safe.details === 'object') {
      safe.details = { ...safe.details };
      if (safe.details.account_number) {
        safe.details.account_number_masked = `••••${String(safe.details.account_number).slice(-4)}`;
        delete safe.details.account_number;
      }
    }
    return safe;
  });
}

function afrstarConfig() {
  const baseUrl = String(process.env.AFRSTAR_BASE_URL || 'https://ngn.afrstar.com').replace(/\/+$/, '');
  const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
  const accessKey = process.env.AFRSTAR_ACCESS_KEY;
  const secretKey = process.env.AFRSTAR_SECRET_KEY;
  if (!merchantSn || !accessKey || !secretKey) throw new Error('AfrStar credentials are not configured on the server.');
  return { baseUrl, merchantSn, accessKey, secretKey };
}

async function queryGatewayBalance() {
  const { baseUrl, merchantSn, accessKey, secretKey } = afrstarConfig();
  const sign = generateAfrStarSign(accessKey, secretKey);
  const { data } = await axios.post(`${baseUrl}/gateway/balance/`, { merchant_sn: merchantSn, sign }, {
    headers: { 'Content-Type': 'application/json' }, timeout: 10000
  });
  if (data?.code !== 0) throw new Error(data?.message || 'AfrStar balance query failed.');
  return { balance: Number(data?.data?.balance) || 0, currency: 'NGN', fetchedAt: new Date().toISOString() };
}

async function createGatewayDeposit(admin, req, body, res) {
  const amount = parseAmount(body.amount);
  if (!amount) return res.status(400).json({ error: 'Enter a valid amount with up to two decimal places.' });
  let config;
  try { config = afrstarConfig(); }
  catch (error) { return res.status(503).json({ error: error.message }); }

  const amountText = amount.toFixed(2);
  const orderRef = `ADM-DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const note = String(body.note || '').trim().slice(0, 240);
  const { data: profile, error: profileError } = await supabaseAdmin.from('users')
    .select('full_name,email,phone').eq('id', admin.id).maybeSingle();
  if (profileError) throw profileError;
  const phone = String(profile?.phone || admin.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Add a phone number to the administrator account before creating an AfrStar checkout.' });

  const host = String(req.headers.host || '');
  const localDevelopment = process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const protocol = localDevelopment ? 'http' : 'https';
  let redirectUrl;
  try {
    const returnTo = new URL('/admin?tab=gateway', `${protocol}://${host}`);
    returnTo.searchParams.set('topup', 'complete');
    returnTo.searchParams.set('ref', orderRef);
    redirectUrl = returnTo.toString();
  } catch {
    return res.status(400).json({ error: 'The site return URL could not be created.' });
  }

  const { data: ledger, error: ledgerError } = await supabaseAdmin.from('admin_gateway_ledger').insert({
    direction: 'top_up', amount, order_sn: orderRef, status: 'processing', created_by: admin.id,
    details: { note, provider: 'AfrStar', method: 'payin' }
  }).select('id').single();
  if (ledgerError) throw ledgerError;

  const payload = {
    merchant_sn: config.merchantSn,
    order_sn: orderRef,
    amount: amountText,
    name: profile?.full_name || 'Lebara Admin',
    email: profile?.email || `admin-${admin.id}@lebara.local`,
    phone,
    remark: 'Lebara Gateway Top-up',
    redirect_url: redirectUrl,
    sign: generateAfrStarSign(config.accessKey, orderRef, amountText, config.secretKey)
  };

  let response;
  try {
    response = await axios.post(`${config.baseUrl}/gateway/payin/`, payload, {
      headers: { 'Content-Type': 'application/json' }, timeout: 10000
    });
  } catch (error) {
    const providerData = error.response?.data;
    if (providerData && Number(providerData.code) !== 0) {
      const message = String(providerData.message || 'AfrStar rejected the gateway deposit.').slice(0, 240);
      const { error: statusError } = await supabaseAdmin.from('admin_gateway_ledger').update({
        status: 'failed', updated_at: new Date().toISOString(), details: { note, provider: 'AfrStar', provider_message: message }
      }).eq('id', ledger.id);
      if (statusError) throw statusError;
      await writeAdminAudit(admin.id, 'gateway_topup_rejected', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef, message });
      return res.status(502).json({ error: message });
    }
    await writeAdminAudit(admin.id, 'gateway_topup_outcome_unknown', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef });
    return res.status(502).json({ error: 'AfrStar did not confirm the checkout request. The order remains under callback reconciliation; check gateway activity before retrying.' });
  }

  const result = response.data;
  if (Number(result?.code) !== 0) {
    const message = String(result?.message || 'AfrStar rejected the gateway deposit.').slice(0, 240);
    const { error: statusError } = await supabaseAdmin.from('admin_gateway_ledger').update({
      status: 'failed', updated_at: new Date().toISOString(), details: { note, provider: 'AfrStar', provider_message: message }
    }).eq('id', ledger.id);
    if (statusError) throw statusError;
    await writeAdminAudit(admin.id, 'gateway_topup_rejected', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef, message });
    return res.status(502).json({ error: message });
  }

  const platformOsn = result.data?.platform_osn || null;
  let payUrl = null;
  try {
    const parsed = new URL(String(result.data?.pay_url || ''));
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) payUrl = parsed.toString();
  } catch { /* A successful but unusable checkout is left processing for safe reconciliation. */ }
  const { error: updateError } = await supabaseAdmin.from('admin_gateway_ledger').update({
    platform_osn: platformOsn, updated_at: new Date().toISOString(),
    details: { note, provider: 'AfrStar', method: 'payin', checkout_ready: Boolean(payUrl) }
  }).eq('id', ledger.id);
  if (updateError) throw updateError;
  await writeAdminAudit(admin.id, 'gateway_topup_checkout_created', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef, platform_osn: platformOsn });
  if (!payUrl) return res.status(502).json({ error: 'AfrStar accepted the order but did not return a secure payment page. Check gateway activity before retrying.' });
  return res.status(200).json({ success: true, status: 'processing', url: payUrl, ref: orderRef });
}

async function sendAfrStarPayout({ orderRef, amount, name, account, bankCode, remark }) {
  const { baseUrl, merchantSn, accessKey, secretKey } = afrstarConfig();
  const amountText = Number(amount).toFixed(2);
  const sign = generateAfrStarSign(accessKey, orderRef, account, '', amountText, secretKey);
  const payload = {
    merchant_sn: merchantSn,
    order_sn: orderRef,
    amount: amountText,
    type: 'bank',
    name,
    account,
    ifsc: bankCode,
    upi_handle: '',
    remark: String(remark || 'Lebara payout').slice(0, 120),
    sign
  };
  const { data } = await axios.post(`${baseUrl}/gateway/payout/`, payload, {
    headers: { 'Content-Type': 'application/json' }, timeout: 10000
  });
  if (data?.code !== 0) {
    const error = new Error(data?.message || 'AfrStar rejected the payout.');
    error.providerRejected = true;
    throw error;
  }
  return data;
}

async function verifyGatewayWithdrawalPassword(admin, password) {
  const hash = process.env.ADMIN_GATEWAY_WITHDRAWAL_PASSWORD_HASH;
  if (!hash || !/^\$2[aby]\$/.test(hash)) throw new Error('The separate gateway withdrawal password hash is not configured.');
  const { data: allowed, error: attemptError } = await supabaseAdmin.rpc('consume_admin_gateway_password_attempt', { p_admin_id: admin.id });
  if (attemptError) throw new Error('Password protection could not be checked.');
  if (!allowed) throw Object.assign(new Error('Too many payout-password attempts. Try again in 15 minutes.'), { statusCode: 429 });
  const valid = typeof password === 'string' && password.length <= 256 && await bcrypt.compare(password, hash);
  if (!valid) throw Object.assign(new Error('Separate gateway withdrawal password is incorrect.'), { statusCode: 401 });
  const { error: clearError } = await supabaseAdmin.from('admin_gateway_password_attempts').delete().eq('admin_id', admin.id);
  if (clearError) throw new Error('Password verification state could not be cleared.');
}

function cleanSearch(term) {
  return String(term || '').replace(/[^a-zA-Z0-9@+_\-\s]/g, ' ').trim().slice(0, 80);
}

async function getOverview(res) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [users, deposits, pendingDeposits, withdrawals, pendingWithdrawals, activePackages, volume] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('recharge_requests').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('recharge_requests').select('id', { count: 'exact', head: true }).in('status', PENDING_DEPOSIT_STATES),
    supabaseAdmin.from('withdrawals').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('user_packages').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('recharge_requests').select('amount').eq('status', 'approved').gte('created_at', today.toISOString())
  ]);
  const errors = [users, deposits, pendingDeposits, withdrawals, pendingWithdrawals, activePackages, volume].find((result) => result.error);
  if (errors) throw errors.error;
  return res.status(200).json({
    totalUsers: users.count || 0,
    totalDeposits: deposits.count || 0,
    pendingDeposits: pendingDeposits.count || 0,
    totalWithdrawals: withdrawals.count || 0,
    pendingWithdrawals: pendingWithdrawals.count || 0,
    activePackages: activePackages.count || 0,
    todayDeposits: (volume.data || []).reduce((total, row) => total + (Number(row.amount) || 0), 0)
  });
}

async function getUsers(req, res) {
  const { page, limit, from, to } = safePageParams(req.query, 25, SAFE_PAGE_LIMIT);
  let query = supabaseAdmin.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  const search = cleanSearch(req.query.search);
  if (search) query = query.or(`phone.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%,referral_code.ilike.%${search}%`);
  if (req.query.status === 'banned') query = query.eq('is_banned', true);
  if (req.query.status === 'active') query = query.eq('is_banned', false);
  const { data, error, count } = await query;
  if (error) throw error;
  return res.status(200).json({ users: (data || []).map(safeUser), page, limit, total: count || 0 });
}

async function getUserDetail(id, res) {
  if (!id) return res.status(400).json({ error: 'User ID is required.' });
  const { data: user, error: userError } = await supabaseAdmin.from('users').select('*').eq('id', id).maybeSingle();
  if (userError) throw userError;
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const [wallet, transactions, deposits, withdrawals, banks, packages, directMembers] = await Promise.all([
    supabaseAdmin.from('wallets').select('*').eq('user_id', id).maybeSingle(),
    supabaseAdmin.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('recharge_requests').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('withdrawals').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('user_banks').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('user_packages').select('*, packages(name, price, daily_income, total_income, days)').eq('user_id', id).order('purchased_at', { ascending: false }).limit(100),
    supabaseAdmin.from('users').select('*').eq('referred_by', id).order('created_at', { ascending: false }).limit(200)
  ]);
  for (const result of [wallet, transactions, deposits, withdrawals, banks, packages, directMembers]) if (result.error) throw result.error;
  const direct = directMembers.data || [];
  const directIds = direct.map((member) => member.id);
  const secondLevel = directIds.length
    ? await supabaseAdmin.from('users').select('*').in('referred_by', directIds).order('created_at', { ascending: false }).limit(500)
    : { data: [], error: null };
  if (secondLevel.error) throw secondLevel.error;
  return res.status(200).json({
    user: safeUser(user),
    wallet: wallet.data || null,
    transactions: transactions.data || [],
    deposits: deposits.data || [],
    withdrawals: safeFinancialRows(withdrawals.data),
    banks: safeFinancialRows(banks.data),
    packages: packages.data || [],
    team: { level1: direct.map(safeUser), level2: (secondLevel.data || []).map(safeUser) }
  });
}

async function getList(section, req, res) {
  const { from, to, page, limit } = safePageParams(req.query, 50, SAFE_PAGE_LIMIT);
  let query;
  if (section === 'deposits') query = supabaseAdmin.from('recharge_requests').select('*, users(full_name, phone, email)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  else if (section === 'withdrawals') query = supabaseAdmin.from('withdrawals').select('*, users(full_name, phone, email)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  else if (section === 'packages') query = supabaseAdmin.from('packages').select('*', { count: 'exact' }).order('category').order('price');
  else if (section === 'gift-codes') query = supabaseAdmin.from('gift_codes').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  else if (section === 'gateway-ledger') query = supabaseAdmin.from('admin_gateway_ledger').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  else return res.status(400).json({ error: 'Invalid section.' });
  if (req.query.status && ['deposits', 'withdrawals'].includes(section)) query = query.eq('status', String(req.query.status));
  if (section === 'gift-codes' && ['active', 'inactive'].includes(String(req.query.status || ''))) query = query.eq('is_active', req.query.status === 'active');
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = section === 'withdrawals' ? safeFinancialRows(data) : section === 'gateway-ledger' ? safeLedgerRows(data) : data || [];
  return res.status(200).json({ rows, page, limit, total: count || 0 });
}

async function applyWithdrawalAction(admin, body, res) {
  const id = String(body.id || body.wdId || '');
  if (!id || !['approve', 'reject'].includes(body.decision)) return res.status(400).json({ error: 'Valid withdrawal ID and decision are required.' });
  const { data: row, error } = await supabaseAdmin.from('withdrawals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!row) return res.status(404).json({ error: 'Withdrawal not found.' });
  if (row.status !== 'pending') return res.status(409).json({ error: 'Only a pending withdrawal can be reviewed.' });
  if (body.decision === 'reject') {
    const { error: refundError } = await supabaseAdmin.rpc('refund_withdrawal_failure', { p_wd_id: id, p_reason: String(body.reason || 'Rejected by administrator').slice(0, 240) });
    if (refundError) throw refundError;
    await writeAdminAudit(admin.id, 'withdrawal_rejected', 'withdrawal', id, { amount: Number(row.amount), reason: String(body.reason || '').slice(0, 240) });
    return res.status(200).json({ success: true, status: 'failed' });
  }

  try {
    await verifyGatewayWithdrawalPassword(admin, body.withdrawalPassword);
  } catch (error) {
    return res.status(error.statusCode || 503).json({ error: error.message });
  }
  await writeAdminAudit(admin.id, 'withdrawal_approval_attempt', 'withdrawal', id, { amount: Number(row.amount), provider_ref: row.provider_ref });
  const { data: claimed, error: claimError } = await supabaseAdmin.from('withdrawals')
    .update({ status: 'processing', handled_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending').select('*').maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return res.status(409).json({ error: 'Withdrawal is already being processed.' });
  const payoutAmount = Number(claimed.payout_amount ?? claimed.amount);
  try {
    const providerResult = await sendAfrStarPayout({
      orderRef: claimed.provider_ref,
      amount: payoutAmount,
      name: claimed.account_name,
      account: claimed.account_number,
      bankCode: claimed.bank_code,
      remark: 'Lebara approved withdrawal'
    });
    const platformOsn = providerResult?.data?.platform_osn || null;
    const { error: updateError } = await supabaseAdmin.from('withdrawals').update({ platform_osn: platformOsn }).eq('id', id);
    if (updateError) throw updateError;
    await writeAdminAudit(admin.id, 'withdrawal_sent_to_gateway', 'withdrawal', id, { amount: payoutAmount, provider_ref: claimed.provider_ref, platform_osn: platformOsn });
    return res.status(200).json({ success: true, status: 'processing', ref: claimed.provider_ref });
  } catch (error) {
    if (error.providerRejected) {
      const { error: refundError } = await supabaseAdmin.rpc('refund_withdrawal_failure', { p_wd_id: id, p_reason: error.message });
      if (refundError) throw refundError;
      await writeAdminAudit(admin.id, 'withdrawal_gateway_rejected', 'withdrawal', id, { provider_ref: claimed.provider_ref, message: error.message });
      return res.status(502).json({ error: error.message });
    }
    console.error('AfrStar approval dispatch outcome is uncertain:', error.message || error);
    await writeAdminAudit(admin.id, 'withdrawal_gateway_outcome_unknown', 'withdrawal', id, { provider_ref: claimed.provider_ref });
    return res.status(502).json({ error: 'Gateway response was not confirmed. Funds remain held; do not resubmit. Reconcile this reference in AfrStar.' });
  }
}

function validateSettings(input) {
  const allowed = Object.keys(DEFAULT_SITE_SETTINGS);
  const next = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(input, key)) next[key] = input[key];
  const numberKeys = ['dep_min_amount', 'dep_max_amount', 'wd_min_amount', 'wd_max_amount', 'wd_daily_limit', 'withdrawal_fee_pct', 'withdrawal_fee_fixed', 'welcome_bonus', 'referral_deposit_bonus_l1_pct', 'referral_deposit_bonus_l2_pct'];
  for (const key of numberKeys) {
    if (next[key] === undefined) continue;
    const value = Number(next[key]);
    if (!Number.isFinite(value) || value < 0 || (key.includes('_pct') && value > 100)) throw new Error(`Invalid value for ${key}.`);
    next[key] = Math.round(value * 100) / 100;
  }
  if (next.wd_daily_limit !== undefined && (!Number.isInteger(next.wd_daily_limit) || next.wd_daily_limit < 1 || next.wd_daily_limit > 100)) {
    throw new Error('Daily withdrawal limit must be a whole number from 1 to 100.');
  }
  for (const [minimum, maximum] of [['dep_min_amount', 'dep_max_amount'], ['wd_min_amount', 'wd_max_amount']]) {
    const low = next[minimum]; const high = next[maximum];
    if (low !== undefined && high !== undefined && high > 0 && low > high) throw new Error(`${minimum} cannot exceed ${maximum}.`);
  }
  for (const key of ['wd_hours_start', 'wd_hours_end']) {
    if (next[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(next[key]))) throw new Error(`Invalid time for ${key}.`);
  }
  if (next.wd_days !== undefined && (!Array.isArray(next.wd_days) || next.wd_days.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6))) throw new Error('Withdrawal days must use weekday numbers 0–6.');
  if (next.wd_days !== undefined) next.wd_days = [...new Set(next.wd_days.map(Number))].sort();
  if (next.withdrawal_mode !== undefined && !['manual', 'automatic'].includes(next.withdrawal_mode)) throw new Error('Withdrawal mode must be manual or automatic.');
  if (next.wd_schedule_enabled !== undefined && typeof next.wd_schedule_enabled !== 'boolean') throw new Error('Withdrawal schedule flag must be true or false.');
  if (next.whatsapp_group_url !== undefined) {
    const url = String(next.whatsapp_group_url || '').trim();
    if (url) {
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error('WhatsApp group URL must be a valid HTTPS URL.'); }
      if (parsed.protocol !== 'https:' || !['chat.whatsapp.com', 'www.whatsapp.com', 'wa.me'].includes(parsed.hostname.toLowerCase())) throw new Error('Use an HTTPS WhatsApp invite URL.');
    }
    next.whatsapp_group_url = url;
  }
  return next;
}

async function handleGatewayWithdrawal(admin, body, res) {
  const amount = parseAmount(body.amount);
  const name = String(body.name || '').trim().slice(0, 100);
  const account = String(body.account || '').replace(/\D/g, '').slice(0, 20);
  const bankCode = String(body.bankCode || '').trim();
  const selectedBank = NIGERIAN_BANKS.find(([code]) => code === bankCode);
  if (!amount || !name || account.length < 8 || !selectedBank) return res.status(400).json({ error: 'Enter a valid amount, beneficiary, account number, and select a supported Nigerian bank.' });
  try { await verifyGatewayWithdrawalPassword(admin, body.withdrawalPassword); }
  catch (error) { return res.status(error.statusCode || 503).json({ error: error.message }); }

  const orderRef = `ADM-WD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  await writeAdminAudit(admin.id, 'gateway_withdrawal_attempt', 'gateway_ledger', orderRef, { amount, bankCode, accountLast4: account.slice(-4) });
  const { data: ledger, error: ledgerError } = await supabaseAdmin.from('admin_gateway_ledger').insert({
    direction: 'withdrawal', amount, order_sn: orderRef, status: 'processing', created_by: admin.id,
    details: { beneficiary_name: name, account_number: account, bank_code: bankCode, bank_name: selectedBank[1], remark: String(body.reason || 'Admin gateway withdrawal').slice(0, 120) }
  }).select('id').single();
  if (ledgerError) throw ledgerError;

  try {
    const result = await sendAfrStarPayout({ orderRef, amount, name, account, bankCode, remark: body.reason || 'Lebara gateway withdrawal' });
    const platformOsn = result?.data?.platform_osn || null;
    const { error } = await supabaseAdmin.from('admin_gateway_ledger').update({ status: 'processing', platform_osn, updated_at: new Date().toISOString() }).eq('id', ledger.id);
    if (error) throw error;
    await writeAdminAudit(admin.id, 'gateway_withdrawal_sent', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef, platform_osn: platformOsn });
    return res.status(200).json({ success: true, status: 'processing', ref: orderRef, platform_osn: platformOsn });
  } catch (error) {
    if (error.providerRejected) {
      await supabaseAdmin.from('admin_gateway_ledger').update({ status: 'failed', updated_at: new Date().toISOString(), details: { beneficiary_name: name, account_number: account, bank_code: bankCode, bank_name: selectedBank[1], message: error.message } }).eq('id', ledger.id);
      await writeAdminAudit(admin.id, 'gateway_withdrawal_rejected', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef, message: error.message });
      return res.status(502).json({ error: error.message });
    }
    await supabaseAdmin.from('admin_gateway_ledger').update({ status: 'unknown', updated_at: new Date().toISOString() }).eq('id', ledger.id);
    await writeAdminAudit(admin.id, 'gateway_withdrawal_outcome_unknown', 'gateway_ledger', ledger.id, { amount, order_sn: orderRef });
    return res.status(502).json({ error: 'The provider response was not confirmed. Do not retry until the reference is reconciled in AfrStar.' });
  }
}

async function handlePost(admin, req, body, res) {
  const action = String(body.action || '');
  if (action === 'save-settings') {
    const next = validateSettings(body.settings || {});
    const entries = Object.entries(next);
    if (!entries.length) return res.status(400).json({ error: 'No valid settings were provided.' });
    const rows = entries.map(([key, value]) => ({ key, value: JSON.stringify(value) }));
    const { error } = await supabaseAdmin.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    await writeAdminAudit(admin.id, 'settings_updated', 'settings', 'site', { keys: entries.map(([key]) => key) });
    return res.status(200).json({ success: true, settings: { ...(await readAdminSettings()) } });
  }
  if (action === 'set-user-ban') {
    const userId = String(body.userId || '');
    const ban = body.banned === true;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });
    if (ban && userId === admin.id) return res.status(400).json({ error: 'You cannot ban your own administrator account.' });
    const { data: target, error: targetError } = await supabaseAdmin.from('users').select('id,is_admin,is_banned').eq('id', userId).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (ban && target.is_admin) return res.status(400).json({ error: 'Administrator accounts cannot be banned from this screen.' });
    const { error } = await supabaseAdmin.from('users').update({
      is_banned: ban,
      banned_at: ban ? new Date().toISOString() : null,
      ban_reason: ban ? String(body.reason || 'Banned by administrator').slice(0, 240) : null
    }).eq('id', userId);
    if (error) throw error;
    await writeAdminAudit(admin.id, ban ? 'user_banned' : 'user_unbanned', 'user', userId, { reason: ban ? String(body.reason || '').slice(0, 240) : null });
    return res.status(200).json({ success: true, is_banned: ban });
  }
  if (action === 'adjust-user-wallet') {
    const userId = String(body.userId || '');
    const bucket = String(body.bucket || '');
    const amount = Number(body.amount);
    const reason = String(body.reason || '').trim().slice(0, 240);
    if (!userId || !['balance', 'income_balance'].includes(bucket) || !Number.isFinite(amount) || amount === 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 || !reason) {
      return res.status(400).json({ error: 'Choose a wallet, enter a non-zero amount to two decimal places, and provide a reason.' });
    }
    const { data, error } = await supabaseAdmin.rpc('admin_adjust_wallet', {
      p_user_id: userId, p_bucket: bucket, p_amount: amount, p_reason: reason, p_admin_id: admin.id
    });
    if (error) throw error;
    if (!data?.success) return res.status(400).json({ error: data?.error || 'Wallet adjustment was rejected.' });
    return res.status(200).json({ success: true, balance_after: data.balance_after });
  }
  if (action === 'withdrawal-review') return applyWithdrawalAction(admin, body, res);
  if (action === 'save-package') {
    const id = body.id ? String(body.id) : null;
    const input = body.package || {};
    const name = String(input.name || '').trim().slice(0, 120);
    const category = String(input.category || 'general').trim().toLowerCase();
    const price = Number(input.price); const daily = Number(input.daily_income); const total = Number(input.total_income); const days = Number.parseInt(input.days, 10);
    if (!name || !['general', 'vip'].includes(category) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(daily) || daily < 0 || !Number.isFinite(total) || total < 0 || !Number.isInteger(days) || days <= 0) return res.status(400).json({ error: 'Complete the required package fields with valid values.' });
    const row = {
      name, category, price, daily_income: daily, total_income: total, days,
      is_active: input.is_active !== false,
      is_locked: input.is_locked === true,
      vip_required_invites: Math.max(0, Number.parseInt(input.vip_required_invites, 10) || 0)
    };
    // Keep an existing image when an older/partial edit payload does not include image_url.
    // An explicit blank still clears the image intentionally.
    if (Object.prototype.hasOwnProperty.call(input, 'image_url')) row.image_url = String(input.image_url || '').trim() || null;
    const result = id
      ? await supabaseAdmin.from('packages').update(row).eq('id', id).select('*').single()
      : await supabaseAdmin.from('packages').insert(row).select('*').single();
    if (result.error) throw result.error;
    await writeAdminAudit(admin.id, id ? 'package_updated' : 'package_created', 'package', result.data.id, { name });
    return res.status(200).json({ success: true, package: result.data });
  }
  if (action === 'delete-package') {
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ error: 'Package ID is required.' });
    const { error } = await supabaseAdmin.from('packages').update({ is_active: false, is_locked: true }).eq('id', id);
    if (error) throw error;
    await writeAdminAudit(admin.id, 'package_archived', 'package', id, {});
    return res.status(200).json({ success: true, archived: true });
  }
  if (action === 'save-gift-code') {
    const id = body.id ? String(body.id) : null;
    const input = body.giftCode || {};
    const code = String(input.code || crypto.randomBytes(5).toString('hex')).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    const amount = Number(input.amount);
    const maxUses = input.max_uses === '' || input.max_uses === null || input.max_uses === undefined ? null : Number.parseInt(input.max_uses, 10);
    if (!code || !Number.isFinite(amount) || amount <= 0 || (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))) return res.status(400).json({ error: 'Enter a valid code amount and optional use limit.' });
    const expiresAt = input.expires_at ? new Date(input.expires_at) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ error: 'Expiration date is invalid.' });
    const row = { code, amount, is_active: input.is_active !== false, max_uses: maxUses, expires_at: expiresAt?.toISOString() || null };
    const result = id
      ? await supabaseAdmin.from('gift_codes').update(row).eq('id', id).select('*').single()
      : await supabaseAdmin.from('gift_codes').insert(row).select('*').single();
    if (result.error) throw result.error;
    await writeAdminAudit(admin.id, id ? 'gift_code_updated' : 'gift_code_created', 'gift_code', result.data.id, { code, amount });
    return res.status(200).json({ success: true, giftCode: result.data });
  }
  if (action === 'delete-gift-code') {
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ error: 'Gift code ID is required.' });
    const { error } = await supabaseAdmin.from('gift_codes').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    await writeAdminAudit(admin.id, 'gift_code_deactivated', 'gift_code', id, {});
    return res.status(200).json({ success: true });
  }
  if (action === 'gateway-deposit') return createGatewayDeposit(admin, req, body, res);
  if (action === 'gateway-withdrawal') return handleGatewayWithdrawal(admin, body, res);
  return res.status(400).json({ error: 'Invalid admin action.' });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    if (req.method === 'GET') {
      const { section } = getParams(req);
      if (section === 'check') return res.status(200).json({ isAdmin: true });
      if (section === 'settings_public') return res.status(200).json(publicSettingsShape(await readAdminSettings()));
      if (section === 'stats' || section === 'overview') return getOverview(res);
      if (section === 'users') return getUsers(req, res);
      if (section === 'user') return getUserDetail(String(req.query.id || ''), res);
      if (section === 'settings') return res.status(200).json(publicSettingsShape(await readAdminSettings()));
      if (section === 'gateway') {
        const [balance, ledger] = await Promise.all([
          queryGatewayBalance().catch((error) => ({ error: error.message || 'Balance query failed.' })),
          supabaseAdmin.from('admin_gateway_ledger').select('*').order('created_at', { ascending: false }).limit(20)
        ]);
        if (ledger.error) throw ledger.error;
        return res.status(200).json({ balance, ledger: safeLedgerRows(ledger.data) });
      }
      return getList(section, req, res);
    }
    if (req.method === 'POST') {
      if (!hasSameOrigin(req)) return res.status(403).json({ error: 'Cross-origin request blocked.' });
      return await handlePost(admin, req, req.body || {}, res);
    }
    return res.status(405).end();
  } catch (error) {
    console.error('Admin API error:', error.message || error);
    return res.status(500).json({ error: 'The requested administrator operation could not be completed.' });
  }
}
