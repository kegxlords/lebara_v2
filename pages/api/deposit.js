import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import axios from 'axios';
import { generateAfrStarSign } from '../../lib/crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const user = requireAuth(req, res);
    if (!user) return;

    const { amount } = req.body;
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) return res.status(400).json({ error: 'Invalid amount' });
    
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
        const baseUrl = process.env.AFRSTAR_BASE_URL;
        const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
        const ak = process.env.AFRSTAR_ACCESS_KEY;
        const sk = process.env.AFRSTAR_SECRET_KEY;

        const sign = generateAfrStarSign(ak, orderRef, amtStr, sk);

        const payload = {
            merchant_sn: merchantSn,
            order_sn: orderRef,
            amount: amtStr,
            name: user.name || 'Member',
            email: `${user.id}@lebara.local`,
            phone: user.phone,
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
            await supabaseAdmin.from('recharge_requests').update({ status: 'rejected' }).eq('id', dbReq.id);
            return res.status(400).json({ error: result.message || 'Gateway Rejected' });
        }

        res.status(200).json({ url: result.data.pay_url, ref: orderRef });

    } catch (err) {
        console.error("Deposit Init Error:", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to initiate deposit' });
    }
}
