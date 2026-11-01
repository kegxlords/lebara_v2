import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import bcrypt from 'bcryptjs';
import { NIGERIAN_BANKS } from '../../lib/banks';

export default async function handler(req, res) {
    const user = requireAuth(req, res);
    if (!user) return; // Stops execution if not logged in

    const method = req.method;

    // ==========================================
    // GET: List Saved Banks
    // ==========================================
    if (method === 'GET') {
        try {
            const { data, error } = await supabaseAdmin
                .from('user_banks')
                .select('*')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data || []);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch banks' });
        }
    }

    // ==========================================
    // POST: Actions (Add Bank, Set PIN, Daily Sign-In)
    // ==========================================
    if (method === 'POST') {
        const { type, ...body } = req.body;

        // --- ACTION: ADD BANK ---
        if (type === 'bank') {
            const { bankCode, accountNumber, accountName } = body;
            
            // Validate Bank Code exists in our static list
            const bankObj = NIGERIAN_BANKS.find(b => b[0] === bankCode);
            if (!bankObj) return res.status(400).json({ error: 'Invalid Bank Code' });

            // Basic Account Number Validation (Nigeria usually 10-11 digits)
            if (!accountNumber || accountNumber.length < 10) {
                return res.status(400).json({ error: 'Invalid Account Number' });
            }

            try {
                // Check Duplicate
                const { data: existing } = await supabaseAdmin
                    .from('user_banks')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('account_number', accountNumber)
                    .single();
                
                if (existing) return res.status(409).json({ error: 'Account already saved' });

                // Insert New Bank
                const { data: newBank, error } = await supabaseAdmin
                    .from('user_banks')
                    .insert({
                        user_id: user.id,
                        bank_code: bankCode,
                        bank_name: bankObj[1], // Get name from static list
                        account_number: accountNumber,
                        account_name: accountName || 'Member',
                        is_default: false 
                    })
                    .select()
                    .single();

                if (error) throw error;

                // If this is the first bank, make it default automatically
                const countRes = await supabaseAdmin.from('user_banks').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
                if (countRes.count === 1) {
                    await supabaseAdmin.from('user_banks').update({ is_default: true }).eq('id', newBank.id);
                }

                return res.status(201).json(newBank);

            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: 'Save failed' });
            }
        }

        // --- ACTION: SET/CHANGE PIN ---
        if (type === 'pin') {
            const { pin, currentPin } = body;
            
            if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
                return res.status(400).json({ error: 'PIN must be 4-6 digits' });
            }

            try {
                // Fetch user's existing PIN hash
                const { data: dbUser, error } = await supabaseAdmin
                    .from('users')
                    .select('withdrawal_pin_hash')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                // If PIN already exists, verify current PIN first
                if (dbUser.withdrawal_pin_hash) {
                    if (!currentPin) {
                        return res.status(400).json({ error: 'Current PIN required to change' });
                    }
                    const isValidOld = await bcrypt.compare(currentPin, dbUser.withdrawal_pin_hash);
                    if (!isValidOld) {
                        return res.status(401).json({ error: 'Incorrect current PIN' });
                    }
                }

                // Hash new PIN
                const salt = await bcrypt.genSalt(10);
                const hashedNewPin = await bcrypt.hash(pin, salt);

                // Update DB
                await supabaseAdmin.from('users').update({ withdrawal_pin_hash: hashedNewPin }).eq('id', user.id);

                return res.status(200).json({ success: true, message: 'Withdrawal PIN updated successfully' });

            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: 'Server Error' });
            }
        }

        // --- ACTION: DAILY SIGN-IN (NEW FEATURE) ---
        if (type === 'daily-sign') {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const requestedDay = Number(body.day);

            try {
                const { data: recentSigns, error: signError } = await supabaseAdmin
                    .from('transactions')
                    .select('created_at, amount')
                    .eq('user_id', user.id)
                    .eq('type', 'sign_bonus')
                    .order('created_at', { ascending: false })
                    .limit(31);

                if (signError) throw signError;
                const signs = recentSigns || [];
                if (signs.some((sign) => sign.created_at?.slice(0, 10) === todayStr)) {
                    return res.status(400).json({ error: 'You have already claimed your daily bonus.' });
                }

                let streak = 0;
                if (signs.length) {
                    const latestDate = signs[0].created_at.slice(0, 10);
                    const gap = Math.round((today - new Date(`${latestDate}T00:00:00Z`)) / 86400000);
                    if (gap === 1) {
                        streak = 1;
                        for (let i = 1; i < signs.length; i += 1) {
                            const previous = new Date(`${signs[i - 1].created_at.slice(0, 10)}T00:00:00Z`);
                            const current = new Date(`${signs[i].created_at.slice(0, 10)}T00:00:00Z`);
                            if (Math.round((previous - current) / 86400000) !== 1) break;
                            streak += 1;
                        }
                    }
                }

                const day = Math.min(30, streak + 1);
                if (Number.isFinite(requestedDay) && requestedDay !== day) {
                    return res.status(409).json({ error: `Your next reward is day ${day}. Refresh the page and try again.`, day });
                }
                const BONUS_AMOUNT = day <= 7 ? 50 : day <= 21 ? 100 : 200;

                // 3. Credit Wallet Atomically using RPC
                // Ensure you have this RPC function in Supabase SQL Editor:
                /*
                CREATE OR REPLACE FUNCTION credit_wallet(p_user_id UUID, p_amount NUMERIC, p_type TEXT)
                RETURNS VOID AS $$
                DECLARE v_bal NUMERIC;
                BEGIN
                    SELECT income_balance INTO v_bal FROM wallets WHERE user_id = p_user_id FOR UPDATE;
                    UPDATE wallets SET income_balance = v_bal + p_amount WHERE user_id = p_user_id;
                    
                    INSERT INTO transactions (user_id, type, direction, amount, balance_after, reference, meta)
                    VALUES (p_user_id, p_type, 'credit', p_amount, v_bal + p_amount, 
                            'sign_' || EXTRACT(EPOCH FROM NOW())::TEXT, jsonb_build_object('source','daily_checkin'));
                END;
                $$ LANGUAGE plpgsql SECURITY DEFINER;
                */

                await supabaseAdmin.rpc('credit_wallet', {
                    p_user_id: user.id,
                    p_amount: BONUS_AMOUNT,
                    p_type: 'sign_bonus'
                });

                return res.status(200).json({ success: true, message: `Success! You earned ₦${BONUS_AMOUNT}`, amount: BONUS_AMOUNT, day });

            } catch (err) {
                console.error("Sign-in Error:", err);
                return res.status(500).json({ error: 'Could not process sign-in' });
            }
        }

        return res.status(400).json({ error: 'Invalid action type' });
    }

    // ==========================================
    // DELETE: Remove Bank
    // ==========================================
    if (method === 'DELETE') {
        const { id } = req.query; // Expecting ?id=123
        if (!id) return res.status(400).json({ error: 'Bank ID required' });
        
        try {
            await supabaseAdmin.from('user_banks').delete().eq('id', id).eq('user_id', user.id);
            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: 'Delete failed' });
        }
    }

    return res.status(405).end();
}
