import { supabaseAdmin } from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken, setAuthCookie } from '../../../lib/auth';

// Helper to generate unique 8-char referral code
function generateRefCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { fullName, phone, password, email, refCode } = req.body;

    // Validation
    if (!fullName || !phone || !password) {
        return res.status(400).json({ error: 'Name, Phone, and Password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // 1. Check Duplicate Phone
        const { data: existing } = await supabaseAdmin.from('users').select('id').eq('phone', phone).single();
        if (existing) return res.status(409).json({ error: 'Phone number already registered' });

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password, salt);

        // 3. Resolve Referrer ID (if provided)
        let referredByUuid = null;
        if (refCode) {
            const { data: referrer } = await supabaseAdmin.from('users').select('id').eq('referral_code', refCode.toUpperCase()).single();
            if (referrer) referredByUuid = referrer.id;
        }

        // 4. Create User
        const newCode = generateRefCode();
        const { data: newUser, error: insertErr } = await supabaseAdmin
            .from('users')
            .insert({
                full_name: fullName,
                phone: phone,
                email: email || null,
                password_hash: hashedPass,
                referral_code: newCode,
                referred_by: referredByUuid
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        // 5. Create Wallet Automatically
        await supabaseAdmin.from('wallets').insert({ user_id: newUser.id });

        // 6. Auto-Login
        const token = generateToken({ id: newUser.id, phone: newUser.phone, name: newUser.full_name });
        setAuthCookie(res, token);

        res.status(201).json({ success: true, user: { id: newUser.id, name: newUser.full_name } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
}
