import { supabaseAdmin } from '../../../lib/supabase';
import { verifyWebhookSignature } from '../../../lib/crypto';

export default async function handler(req, res) {
    // Disable Next.js body parser to get raw string for signature verification if needed
    // But since we parse JSON here, standard parsing works IF we reconstruct the string carefully.
    // SAFER APPROACH FOR SIGNATURES: Read raw body manually.
    
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
        try {
            const payload = JSON.parse(rawBody);
            
            // Extract fields for signature check (§2.2)
            // Sig = md5(merchant_ak + platform_osn + status + original_order_amount + merchant_sk)
            // IMPORTANT: Use ORIGINAL AMOUNT from our DB, not callback amount
            
            const orderRef = payload.order_sn;
            const platformOsn = payload.platform_osn;
            const status = payload.status; // 1 = Success
            
            // Fetch our stored record to get original amount
            const { data: dbRecord } = await supabaseAdmin
                .from('recharge_requests')
                .select('amount, user_id, status')
                .eq('provider_ref', orderRef)
                .single();

            if (!dbRecord) {
                // Unknown order, ACK anyway to stop retries
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end('SUCCESS');
                return;
            }

            // Idempotency Check: Already processed?
            if (dbRecord.status === 'approved') {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end('SUCCESS');
                return;
            }

            // Verify Signature
            const ak = process.env.AFRSTAR_ACCESS_KEY;
            const sk = process.env.AFRSTAR_SECRET_KEY;
            
            // Construct expected string using STORED original amount
            const strToSign = `${ak}${platformOsn}${status}${dbRecord.amount}${sk}`;
            const crypto = require('crypto');
            const computedSig = crypto.createHash('md5').update(strToSign).digest('hex');
            
            if (computedSig !== payload.sign?.toLowerCase()) {
                console.warn("Bad Signature on Deposit Webhook", payload);
                res.writeHead(401, {'Content-Type': 'text/plain'});
                res.end('BAD-SIG');
                return;
            }

            // Process Result
            if (status === 1) {
                // SUCCESS: Credit Wallet
                const amt = parseFloat(dbRecord.amount);
                
                // Atomic Update via RPC or Transaction logic
                // Here we do simple update for demo, but ideally use RPC 'apply_deposit_success'
                await supabaseAdmin.rpc('apply_deposit_success', {
                    p_user_id: dbRecord.user_id,
                    p_request_id: dbRecord.id, // Assuming recharge_requests has ID column accessible
                    p_amount: amt
                });
                
                // Fallback if RPC isn't set up yet: Manual Update
                /*
                await supabaseAdmin.from('wallets').update({ balance: dbRecord.balance + amt }).eq('user_id', dbRecord.user_id);
                await supabaseAdmin.from('recharge_requests').update({ status: 'approved', handled_at: new Date() }).eq('id', dbRecord.id);
                */
            } else {
                // FAILURE/PENDING: Mark accordingly
                await supabaseAdmin.from('recharge_requests').update({ 
                    status: status === 9 ? 'rejected' : 'pending',
                    handled_at: new Date()
                }).eq('id', dbRecord.id);
            }

            // CRITICAL: Respond exactly as requested by docs §2.2
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('SUCCESS');

        } catch (err) {
            console.error("Webhook Error:", err);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('ERROR');
        }
    });
}
