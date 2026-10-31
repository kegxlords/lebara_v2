import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const user = requireAuth(req, res);
    if (!user) return;

    const { pin, currentPin } = req.body; // pin = new PIN, currentPin = old PIN (if changing)

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

        res.status(200).json({ success: true, message: 'Withdrawal PIN updated successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
}
