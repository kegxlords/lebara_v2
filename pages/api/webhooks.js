import { supabaseAdmin } from '../../lib/supabase';
import crypto from 'crypto';

export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    // Read Raw Body for Signature Verification
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
        try {
            const payload = JSON.parse(rawBody);
            const ak = process.env.AFRSTAR_ACCESS_KEY;
            const sk = process.env.AFRSTAR_SECRET_KEY;
            
            // Determine Type based on presence of specific fields or order_sn pattern
            // Deposits usually have 'amount_need', Payouts have 'time_transfered'
            const isPayout = payload.time_transfered !== undefined || payload.order_sn?.startsWith('WD-');
            const isDeposit = payload.amount_need !== undefined || payload.order_sn?.startsWith('DEP-');

            let computedSig = '';
            let dbRecord = null;

            if (isDeposit) {
                // Sig: md5(merchant_ak + platform_osn + status + original_order_amount + merchant_sk)
                const orderRef = payload.order_sn;
                const { data } = await supabaseAdmin.from('recharge_requests').select('id, amount, user_id, status').eq('provider_ref', orderRef).single();
                dbRecord = data;
                
                if (!dbRecord) { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('SUCCESS'); return; }
                if (dbRecord.status === 'approved') { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('SUCCESS'); return; }

                const strToSign = `${ak}${payload.platform_osn}${payload.status}${dbRecord.amount}${sk}`;
                computedSig = crypto.createHash('md5').update(strToSign).digest('hex');

            } else if (isPayout) {
                // Sig: md5(merchant_ak + platform_osn + status + amount + merchant_sk)
                const orderRef = payload.order_sn;
                const { data } = await supabaseAdmin.from('withdrawals').select('amount, user_id, status').eq('provider_ref', orderRef).single();
                dbRecord = data;

                if (!dbRecord) { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('SUCCESS'); return; }
                if (['paid','failed'].includes(dbRecord.status)) { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('SUCCESS'); return; }

                const strToSign = `${ak}${payload.platform_osn}${payload.status}${dbRecord.amount}${sk}`;
                computedSig = crypto.createHash('md5').update(strToSign).digest('hex');
            } else {
                res.writeHead(400, {'Content-Type': 'text/plain'}); res.end('UNKNOWN-TYPE'); return;
            }

            // Verify Signature
            if (computedSig !== payload.sign?.toLowerCase()) {
                console.warn("Bad Signature", payload);
                res.writeHead(401, {'Content-Type': 'text/plain'}); res.end('BAD-SIG'); return;
            }

            // Process Result
            if (isDeposit) {
                if (payload.status === 1) {
                    const depositResult = await supabaseAdmin.rpc('apply_deposit_success', {
                        p_user_id: dbRecord.user_id,
                        p_request_id: dbRecord.id, // Assuming recharge_requests has ID
                        p_amount: parseFloat(dbRecord.amount)
                    });
                    if (depositResult.error) {
                        const { data: wallet, error: walletError } = await supabaseAdmin
                            .from('wallets')
                            .select('balance')
                            .eq('user_id', dbRecord.user_id)
                            .single();
                        if (walletError || !wallet) throw walletError || new Error('Wallet not found');
                        const before = Number(wallet.balance) || 0;
                        const after = before + parseFloat(dbRecord.amount);
                        const { error: updateError } = await supabaseAdmin
                            .from('wallets')
                            .update({ balance: after })
                            .eq('user_id', dbRecord.user_id);
                        if (updateError) throw updateError;
                        const { error: transactionError } = await supabaseAdmin
                            .from('transactions')
                            .insert({
                                user_id: dbRecord.user_id,
                                type: 'deposit',
                                direction: 'credit',
                                amount: parseFloat(dbRecord.amount),
                                balance_after: after,
                                reference: orderRef,
                                meta: { source: 'afrstar_webhook' }
                            });
                        if (transactionError) throw transactionError;
                    }
                    await supabaseAdmin.from('recharge_requests').update({ status: 'approved', handled_at: new Date() }).eq('id', dbRecord.id);
                } else {
                    await supabaseAdmin.from('recharge_requests').update({ status: 'rejected', handled_at: new Date() }).eq('id', dbRecord.id);
                }
            } else if (isPayout) {
                if (payload.status === 1) {
                    await supabaseAdmin.rpc('apply_withdrawal_result', { p_wd_id: dbRecord.id, p_status: 'paid', p_detail: 'Webhook Success' });
                } else if (payload.status === 9) {
                    await supabaseAdmin.rpc('apply_withdrawal_result', { p_wd_id: dbRecord.id, p_status: 'failed', p_detail: 'Webhook Failed' });
                }
            }

            // CRITICAL: Respond exactly as requested by docs
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('SUCCESS');

        } catch (err) {
            console.error("Webhook Error:", err);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('ERROR');
        }
    });
}
