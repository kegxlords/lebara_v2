import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import axios from 'axios';
import { generateAfrStarSign } from '../../../lib/crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const user = requireAuth(req, res);
    if (!user) return;

    const { amount, bankId, pin } = req.body;
    
    // 1. Validate Amount
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    const amtStr = amtNum.toFixed(2);

    try {
        // 2. Verify PIN
        const { data: dbUser } = await supabaseAdmin.from('users').select('withdrawal_pin_hash').eq('id', user.id).single();
        
        if (!dbUser?.withdrawal_pin_hash) {
             // Optional: Allow withdrawal without PIN if not set? 
             // For security, let's REQUIRE it now that we have the feature.
             return res.status(400).json({ error: 'Please set a Withdrawal PIN in Settings first.' });
        }

        const isPinValid = await bcrypt.compare(pin, dbUser.withdrawal_pin_hash);
        if (!isPinValid) {
            return res.status(401).json({ error: 'Incorrect Withdrawal PIN' });
        }

        // 3. Get Bank Details from Saved Banks
        const { data: bankRecord } = await supabaseAdmin
            .from('user_banks')
            .select('*')
            .eq('id', bankId)
            .eq('user_id', user.id)
            .single();

        if (!bankRecord) {
            return res.status(404).json({ error: 'Saved bank account not found' });
        }

        // 4. Business Rules (Min/Max/Fee/Window/Daily Limit)
        // ... (Insert your existing logic here for checking limits, fees, etc.) ...
        // Example: Check Daily Limit
        const today = new Date().toISOString().split('T')[0];
        const { data: wallet } = await supabaseAdmin.from('wallets').select('last_withdrawal_date, income_balance').eq('user_id', user.id).single();
        
        // Note: You might want to allow multiple withdrawals if you disabled the daily limit toggle.
        // For now, assuming standard flow:
        
        if (parseFloat(wallet.income_balance) < amtNum) {
             return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Calculate Fee (Example: 0% fee)
        const feePct = 0; 
        const netSend = amtNum; // Simplified for example
        const netStr = netSend.toFixed(2);

        // 5. Generate Order Ref
        const orderRef = `WD-${user.id}-${Date.now()}`;

        // 6. Save Pending Withdrawal Record
        const { data: wdRecord, error: wdErr } = await supabaseAdmin
            .from('withdrawals')
            .insert({
                user_id: user.id,
                amount: netStr,
                bank_code: bankRecord.bank_code,
                account_number: bankRecord.account_number,
                account_name: bankRecord.account_name,
                provider_ref: orderRef,
                status: 'processing', // Going straight to processing since PIN verified
                error_msg: JSON.stringify({ bank_id: bankId, pin_verified: true })
            })
            .select()
            .single();

        if (wdErr) throw wdErr;

        // 7. Deduct Balance Immediately (Atomic Hold)
        await supabaseAdmin.rpc('deduct_for_withdrawal', { p_user_id: user.id, p_amount: netStr });
        // NOTE: You may need to create this RPC function in Supabase if it doesn't exist.
        // Or just do: UPDATE wallets SET income_balance = income_balance - X, pending_out = pending_out + X WHERE user_id = Y

        // 8. Call AfrStar Payout API
        const baseUrl = process.env.AFRSTAR_BASE_URL;
        const merchantSn = process.env.AFRSTAR_MERCHANT_SN;
        const ak = process.env.AFRSTAR_ACCESS_KEY;
        const sk = process.env.AFRSTAR_SECRET_KEY;

        // Signature Rule (§3.1): md5(merchant_ak + order_sn + account + upi_handle + amount + merchant_sk)
        // upi_handle is empty string for bank payouts
        const sign = generateAfrStarSign(ak, orderRef, bankRecord.account_number, '', netStr, sk);

        const payload = {
            merchant_sn: merchantSn,
            order_sn: orderRef,
            amount: netStr,
            type: "bank",
            name: bankRecord.account_name,
            account: bankRecord.account_number,
            ifsc: bankRecord.bank_code, // Map to ifsc field
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
            // Gateway Rejected: Refund User
            await supabaseAdmin.rpc('refund_withdrawal_failure', { p_wd_id: wdRecord.id, p_reason: result.message });
            return res.status(400).json({ error: result.message || 'Gateway Rejected' });
        }

        // Success: Return Platform OSN
        res.status(200).json({ 
            success: true, 
            ref: orderRef,
            platform_osn: result.data.platform_osn
        });

    } catch (err) {
        console.error("Payout Dispatch Error:", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
}
