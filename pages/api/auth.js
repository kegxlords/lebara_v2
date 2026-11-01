import { supabaseAdmin } from '../../lib/supabase';
import bcrypt from 'bcryptjs';
import { generateToken, setAuthCookie, clearAuthCookie, verifyToken } from '../../lib/auth';

export default async function handler(req, res) {
    const method = req.method;

    // GET: Return current user profile + wallet stats
    if (method === 'GET') {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const { data: user, error: uErr } = await supabaseAdmin
                .from('users')
                .select('id, full_name, phone, email, referral_code, created_at, withdrawal_pin_hash')
                .eq('id', decoded.id)
                .single();
            
            if (uErr || !user) return res.status(404).json({ error: 'User not found' });

            const hasPin = !!user.withdrawal_pin_hash;
            delete user.withdrawal_pin_hash;

            // Fetch Wallet
            const { data: wallet } = await supabaseAdmin
                .from('wallets')
                .select('balance, income_balance, pending_out')
                .eq('user_id', user.id)
                .single();

            // Count Active Packages
            const { count: activeCount } = await supabaseAdmin
                .from('user_packages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('status', 'active');

            const { data: recentTxns } = await supabaseAdmin
                .from('transactions')
                .select('id, type, direction, amount, balance_after, reference, meta, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            const { count: activeReferrals } = await supabaseAdmin
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('referred_by', user.id)
                .not('activated_at', 'is', null);

            res.status(200).json({
                user: { ...user, has_pin: hasPin },
                wallet: wallet || { balance: 0, income_balance: 0, pending_out: 0 },
                stats: { activePackages: activeCount || 0, activeReferrals: activeReferrals || 0 },
                recentTxns: recentTxns || []
            });
        } catch (err) {
            res.status(500).json({ error: 'Server Error' });
        }
        return;
    }

    // POST: Handle Actions (Login/Register/Logout)
    if (method === 'POST') {
        const { action } = req.body;

        // LOGOUT
        if (action === 'logout') {
            clearAuthCookie(res);
            return res.status(200).json({ success: true });
        }

        // LOGIN
        if (action === 'login') {
            const { phone, password } = req.body;
            if (!phone || !password) return res.status(400).json({ error: 'Missing credentials' });

            const { data: user, error } = await supabaseAdmin
                .from('users').select('*').eq('phone', phone).single();
            
            if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
            if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

            const token = generateToken({ id: user.id, phone: user.phone, role: user.role, is_admin: user.is_admin });
            setAuthCookie(res, token);
            return res.status(200).json({ success: true });
        }

        // REGISTER
        if (action === 'register') {
            const { fullName, phone, password, email, refCode } = req.body;
            if (!fullName || !phone || !password) return res.status(400).json({ error: 'Missing fields' });
            if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

            // Check Duplicate
            const { data: existing } = await supabaseAdmin.from('users').select('id').eq('phone', phone).single();
            if (existing) return res.status(409).json({ error: 'Phone already registered' });

            // Hash Password
            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(password, salt);

            // Resolve Referrer
            let referredByUuid = null;
            if (refCode) {
                const { data: referrer } = await supabaseAdmin.from('users').select('id').eq('referral_code', refCode.toUpperCase()).single();
                if (referrer) referredByUuid = referrer.id;
            }

            // Generate Unique Code
            const crypto = require('crypto');
            const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();

            // Insert User
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

            // Create Wallet
            await supabaseAdmin.from('wallets').insert({ user_id: newUser.id });

            // Auto Login
            const token = generateToken({ id: newUser.id, phone: newUser.phone, role: newUser.role, is_admin: newUser.is_admin });
            setAuthCookie(res, token);

            return res.status(201).json({ success: true, user: newUser });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).end();
}
