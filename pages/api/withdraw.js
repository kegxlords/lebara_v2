import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import axios from 'axios';
import { generateAfrStarSign } from '../../lib/crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const user = requireAuth(req, res);
    if (!user) return;

    const { amount, bankId, pin } = req.body;
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const amtStr = amtNum.toFixed(2);

    try {
        // 1. Verify PIN
        const { data: dbUser } = await supabaseAdmin.from('users').select('withdrawal_pin_hash').eq('id', user.id).single();
        if (!dbUser?.withdrawal_pin_hash) return res.status(400).json({ error: 'Set PIN in settings first' });
        
        const isPinValid = await bcrypt.compare(pin, dbUser.withdrawal_pin_hash);
        if (!isPinValid) return res.status(401).json({ error: 'Incorrect PIN' });

        // 2. Get Bank Details
        const { data: bankRecord } = await supabaseAdmin
            .from('user_banks')
            .select('*')
            .eq('id', bankId)
            .eq('user_id', user.id)
            .single();
        if (!bankRecord) return res.status(404).json({ error: 'Bank not found' });

        // 3. Business Rules (Balance Check)
        const { data: wallet } = await supabaseAdmin.from('wallets').select('income_balance').eq('user_id', user.id).single();
        if (parseFloat(wallet.income_balance) < amtNum) return res.status(400).json({ error: 'Insufficient balance' });

        // 4. Generate Order Ref & Save Record
        const orderRef = `WD-${user.id}-${Date.now()}`;
        const { data: wdRecord, error: wdErr } = await supabaseAdmin
            .from('withdrawals')
            .insert({
                user_id: user.id,
                amount: amtStr,
                bank_code: bankRecord.bank_code,
                account_number: bankRecord.account_number,
                account_name: bankRecord.account_name,
                provider_ref: orderRef,
                status: 'processing',
                error_msg: JSON.stringify({ bank_id: bankId, pin_verified: true })
            })
            .select()
            .single();
        if (wdErr) throw wdErr;

        // 5. Deduct Balance (Atomic Hold)
        await supabaseAdmin.rpc('deduct_for_withdrawal', { p_user_id: user.id, p_amount: amtStr });

        // 6. Call AfrStar Payout API
        const baseUrl = process.env.AFRSTAR_BASE_URL;
        const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
        const ak = process.env.AFRSTAR_ACCESS_KEY;
        const sk = process.env.AFRSTAR_SECRET_KEY;

        // Sig: md5(merchant_ak + order_sn + account + upi_handle + amount + merchant_sk)
        const sign = generateAfrStarSign(ak, orderRef, bankRecord.account_number, '', amtStr, sk);

        const payload = {
            merchant_sn: merchantSn,
            order_sn: orderRef,
            amount: amtStr,
            type: "bank",
            name: bankRecord.account_name,
            account: bankRecord.account_number,
            ifsc: bankRecord.bank_code,
            upi_handle: "",
            remark: "Lebara Payout",
            sign: sign
        };

        const response = await axios.post(`${baseUrl}/gateway/payout/`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const result = response.data;

        if (result.code !== 0) {
            // Refund on Failure
            await supabaseAdmin.rpc('refund_withdrawal_failure', { p_wd_id: wdRecord.id, p_reason: result.message });
            return res.status(400).json({ error: result.message || 'Gateway Rejected' });
        }

        res.status(200).json({ success: true, ref: orderRef });

    } catch (err) {
        console.error("Payout Dispatch Error:", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
}
