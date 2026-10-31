import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';
import bcrypt from 'bcryptjs';
import { NIGERIAN_BANKS } from '../../lib/banks';

export default async function handler(req, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const method = req.method;

    // GET: List Saved Banks
    if (method === 'GET') {
        const { data, error } = await supabaseAdmin
            .from('user_banks')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) return res.status(500).json({ error: 'Fetch failed' });
        return res.status(200).json(data || []);
    }

    // POST: Add Bank OR Set PIN
    if (method === 'POST') {
        const { type, ...body } = req.body;

        // ADD BANK
        if (type === 'bank') {
            const { bankCode, accountNumber, accountName } = body;
            
            // Validate Bank Code
            const bankObj = NIGERIAN_BANKS.find(b => b[0] === bankCode);
            if (!bankObj) return res.status(400).json({ error: 'Invalid Bank Code' });

            // Check Duplicate
            const { data: existing } = await supabaseAdmin
                .from('user_banks')
                .select('id')
                .eq('user_id', user.id)
                .eq('account_number', accountNumber)
                .single();
            if (existing) return res.status(409).json({ error: 'Account already saved' });

            // Insert
            const { data: newBank, error } = await supabaseAdmin
                .from('user_banks')
                .insert({
                    user_id: user.id,
                    bank_code: bankCode,
                    bank_name: bankObj[1],
                    account_number: accountNumber,
                    account_name: accountName || 'Member',
                    is_default: false
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Save failed' });

            // Set as default if first bank
            const countRes = await supabaseAdmin.from('user_banks').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
            if (countRes.count === 1) {
                await supabaseAdmin.from('user_banks').update({ is_default: true }).eq('id', newBank.id);
            }

            return res.status(201).json(newBank);
        }

        // SET PIN
        if (type === 'pin') {
            const { pin, currentPin } = body;
            if (!pin || pin.length < 4 || pin.length > 6) return res.status(400).json({ error: 'PIN must be 4-6 digits' });

            const { data: dbUser } = await supabaseAdmin.from('users').select('withdrawal_pin_hash').eq('id', user.id).single();
            
            if (dbUser.withdrawal_pin_hash) {
                if (!currentPin) return res.status(400).json({ error: 'Current PIN required' });
                const isValidOld = await bcrypt.compare(currentPin, dbUser.withdrawal_pin_hash);
                if (!isValidOld) return res.status(401).json({ error: 'Incorrect current PIN' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedNewPin = await bcrypt.hash(pin, salt);
            await supabaseAdmin.from('users').update({ withdrawal_pin_hash: hashedNewPin }).eq('id', user.id);

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid type' });
    }

    // DELETE: Remove Bank
    if (method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID required' });
        
        await supabaseAdmin.from('user_banks').delete().eq('id', id).eq('user_id', user.id);
        return res.status(200).json({ success: true });
    }

    return res.status(405).end();
}
