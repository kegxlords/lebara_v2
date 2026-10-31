import { supabaseAdmin } from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { generateToken, setAuthCookie } from '../../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and Password required' });
    }

    try {
        // 1. Find User
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.is_banned) {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }

        // 2. Verify Password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. Generate Token & Set Cookie
        const tokenPayload = { 
            id: user.id, 
            phone: user.phone, 
            name: user.full_name,
            isAdmin: false // We'll check admin status separately if needed
        };
        
        const token = generateToken(tokenPayload);
        setAuthCookie(res, token);

        res.status(200).json({ 
            success: true, 
            user: { id: user.id, name: user.full_name, phone: user.phone } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
}
