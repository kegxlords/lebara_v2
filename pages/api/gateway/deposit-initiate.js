import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import axios from 'axios';
import { generateAfrStarSign } from '../../../lib/crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const user = requireAuth(req, res);
    if (!user) return;

    const { amount } = req.body;
    const amtNum = parseFloat(amount);

    if (isNaN(amtNum) || amtNum <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    // Format amount strictly to 2 decimals as per docs §1.1
    const amtStr = amtNum.toFixed(2); 
    
    // Generate Unique Order Reference
    const orderRef = `DEP-${user.id}-${Date.now()}`;

    try {
        // 1. Save Pending Request to DB first (Atomicity safety)
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

        // 2. Prepare AfrStar Payload
        const baseUrl = process.env.AFRSTAR_BASE_URL;
        const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
        const ak = process.env.AFRSTAR_ACCESS_KEY;
        const sk = process.env.AFRSTAR_SECRET_KEY;

        // Signature Rule (§2.1): md5(merchant_ak + order_sn + amount + merchant_sk)
        const sign = generateAfrStarSign(ak, orderRef, amtStr, sk);

        const payload = {
            merchant_sn: merchantSn,
            order_sn: orderRef,
            amount: amtStr,
            name: user.name || 'Member', // Sanitize name client-side ideally
            email: `${user.id}@lebara.local`, // Virtual email fallback
            phone: user.phone,
            remark: "Lebara Deposit",
            redirect_url: `https://${req.headers.host}/deposit-result?ref=${orderRef}`,
            sign: sign
        };

        // 3. Call AfrStar API
        const response = await axios.post(`${baseUrl}/gateway/payin/`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const result = response.data;

        if (result.code !== 0) {
            // Mark as rejected in DB if gateway fails immediately
            await supabaseAdmin.from('recharge_requests').update({ status: 'rejected' }).eq('id', dbReq.id);
            return res.status(400).json({ error: result.message || 'Gateway Rejected' });
        }

        // Success: Return Pay URL to frontend
        res.status(200).json({ 
            url: result.data.pay_url, 
            ref: orderRef,
            platform_osn: result.data.platform_osn 
        });

    } catch (err) {
        console.error("Deposit Init Error:", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to initiate deposit' });
    }
}
