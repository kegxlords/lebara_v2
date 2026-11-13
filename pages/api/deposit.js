import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import axios from 'axios';
import { generateAfrStarSign } from '../../lib/crypto';
import { getSiteSettings } from '../../lib/site-settings';

function gatewayCustomerName(value) {
    const cleaned = String(value || '')
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N} .'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
    return cleaned.length >= 2 ? cleaned : 'Lebara Member';
}

function gatewayPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return `+234${digits}`;
    if (digits.length === 13 && digits.startsWith('234')) return `+${digits}`;
    return value || '';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const user = await requireAuth(req, res);
    if (!user) return;

    const { amount } = req.body;
    const amtNum = Number(amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0 || Math.abs(amtNum * 100 - Math.round(amtNum * 100)) > 0.000001) return res.status(400).json({ error: 'Enter a valid amount with up to two decimal places.' });
    let settings;
    try { settings = await getSiteSettings(); }
    catch (error) { console.error('Deposit settings unavailable:', error.message); return res.status(503).json({ error: 'Deposit settings are temporarily unavailable.' }); }
    const minimum = Number(settings.dep_min_amount) || 0;
    const maximum = Number(settings.dep_max_amount) || 0;
    if (minimum > 0 && amtNum < minimum) return res.status(400).json({ error: `Minimum deposit is ₦${minimum.toLocaleString()}.` });
    if (maximum > 0 && amtNum > maximum) return res.status(400).json({ error: `Maximum deposit is ₦${maximum.toLocaleString()}.` });
    
    const amtStr = amtNum.toFixed(2);
    const orderRef = `DEP-${user.id}-${Date.now()}`;

    try {
        // 1. Save Pending Request
        const { data: dbReq, error: dbErr } = await supabaseAdmin
            .from('recharge_requests')
            .insert({
                user_id: user.id,
                amount: amtStr,
                provider_ref: orderRef,
                status: 'initiated'
            })
            .select()
            .single();
        if (dbErr) throw dbErr;

        // 2. Prepare Payload
        const baseUrl = String(process.env.AFRSTAR_BASE_URL || 'https://ngn.afrstar.com').replace(/\/+$/, '');
        const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
        const ak = process.env.AFRSTAR_ACCESS_KEY;
        const sk = process.env.AFRSTAR_SECRET_KEY;
        if (!merchantSn || !ak || !sk) throw new Error('AfrStar credentials are not configured.');
        const { data: profile } = await supabaseAdmin.from('users').select('full_name, email, phone').eq('id', user.id).maybeSingle();

        const sign = generateAfrStarSign(ak, orderRef, amtStr, sk);

        const payload = {
            merchant_sn: merchantSn,
            order_sn: orderRef,
            amount: amtStr,
            name: gatewayCustomerName(profile?.full_name),
            email: profile?.email ? String(profile.email).trim().toLowerCase() : `${user.id}@lebara.local`,
            phone: gatewayPhone(profile?.phone || user.phone),
            remark: "Lebara Deposit",
            redirect_url: `https://${req.headers.host}/deposit-result?ref=${orderRef}`,
            sign: sign
        };

        // 3. Call AfrStar
        const response = await axios.post(`${baseUrl}/gateway/payin/`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const result = response.data;

        if (result.code !== 0) {
            await supabaseAdmin.from('recharge_requests').update({ status: 'rejected', handled_at: new Date().toISOString() }).eq('id', dbReq.id);
            return res.status(400).json({ error: result.message || 'Gateway Rejected' });
        }

        const platformOsn = result.data?.platform_osn || null;
        const { error: referenceError } = await supabaseAdmin.from('recharge_requests').update({ platform_osn: platformOsn }).eq('id', dbReq.id);
        if (referenceError) throw referenceError;

        res.status(200).json({ url: result.data.pay_url, ref: orderRef });

    } catch (err) {
        console.error("Deposit Init Error:", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to initiate deposit' });
    }
}
