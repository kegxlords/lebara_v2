import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import { NIGERIAN_BANKS } from '../../../lib/banks'; // Import static list for validation/name lookup

export default async function handler(req, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const method = req.method;

    try {
        if (method === 'GET') {
            // List all saved banks for user
            const { data, error } = await supabaseAdmin
                .from('user_banks')
                .select('*')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data || []);
        }

        if (method === 'POST') {
            // Add new bank
            const { bankCode, accountNumber, accountName } = req.body;

            // Validate Bank Code exists in our static list
            const bankObj = NIGERIAN_BANKS.find(b => b[0] === bankCode);
            if (!bankObj) return res.status(400).json({ error: 'Invalid Bank Code' });

            // Basic Account Number Validation (Nigeria usually 10-11 digits)
            if (!accountNumber || accountNumber.length < 10) {
                return res.status(400).json({ error: 'Invalid Account Number' });
            }

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
                    bank_name: bankObj[1], // Get name from static list
                    account_number: accountNumber,
                    account_name: accountName || 'Member',
                    is_default: false // Will set to true if it's the first one
                })
                .select()
                .single();

            if (error) throw error;

            // If this is the first bank, make it default
            const countRes = await supabaseAdmin.from('user_banks').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
            if (countRes.count === 1) {
                await supabaseAdmin.from('user_banks').update({ is_default: true }).eq('id', newBank.id);
            }

            res.status(201).json(newBank);
        }

        if (method === 'PUT') {
            // Set Default Bank
            const { bankId } = req.body;
            
            // Clear all defaults for this user
            await supabaseAdmin.from('user_banks').update({ is_default: false }).eq('user_id', user.id);
            
            // Set new default
            const { error } = await supabaseAdmin.from('user_banks').update({ is_default: true }).eq('id', bankId).eq('user_id', user.id);
            if (error) throw error;

            res.status(200).json({ success: true });
        }

        if (method === 'DELETE') {
            // Delete Bank
            const { bankId } = req.query; // Or body depending on client impl
            const { error } = await supabaseAdmin.from('user_banks').delete().eq('id', bankId).eq('user_id', user.id);
            if (error) throw error;
            res.status(200).json({ success: true });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Operation Failed' });
    }
}
