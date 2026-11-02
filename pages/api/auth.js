import { supabaseAdmin } from '../../lib/supabase';
import bcrypt from 'bcryptjs';
import { generateToken, setAuthCookie, clearAuthCookie, verifyToken } from '../../lib/auth';

const DEFAULT_BANNERS = [
    { image_url: '', href: '/packages', alt: 'Explore Lebara plans' },
    { image_url: '', href: '/recharge', alt: 'Add funds securely' },
    { image_url: '', href: '/team', alt: 'Grow your team' }
];

function parseSetting(value, fallback) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') { try { return JSON.parse(value); } catch { return fallback; } }
    return value || fallback;
}

function maskPerson(user) {
    const raw = user?.full_name || user?.phone || 'Member';
    return raw.length <= 3 ? `${raw.slice(0, 1)}**` : `${raw.slice(0, 1)}**${raw.slice(-1)}`;
}

export default async function handler(req, res) {
    const method = req.method;

    // GET: Return current user profile + wallet stats
    if (method === 'GET') {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

        if (req.query.section === 'dashboard-content') {
            try {
                const [{ data: settings }, { data: transactions }] = await Promise.all([
                    supabaseAdmin.from('settings').select('key, value').in('key', ['dashboard_banners', 'dashboard_notifications']),
                    supabaseAdmin.from('transactions').select('type, amount, created_at, user_id').in('type', ['deposit', 'purchase', 'bonus', 'sign_bonus']).order('created_at', { ascending: false }).limit(20)
                ]);
                const settingMap = Object.fromEntries((settings || []).map((item) => [item.key, item.value]));
                const ids = [...new Set((transactions || []).map((item) => item.user_id).filter(Boolean))];
                const { data: users } = ids.length ? await supabaseAdmin.from('users').select('id, full_name, phone').in('id', ids) : { data: [] };
                const usersById = Object.fromEntries((users || []).map((item) => [item.id, item]));
                const notifications = (transactions || []).map((item) => {
                    const label = item.type === 'deposit' ? 'deposited' : item.type === 'purchase' ? 'invested' : item.type === 'bonus' ? 'earned a referral bonus' : 'claimed a daily reward';
                    return { text: `user ${maskPerson(usersById[item.user_id])} ${label}`, amount: `₦${Number(item.amount || 0).toLocaleString()}`, created_at: item.created_at };
                });
                const configured = parseSetting(settingMap.dashboard_notifications, []);
                return res.status(200).json({ banners: parseSetting(settingMap.dashboard_banners, DEFAULT_BANNERS), notifications: configured.length ? configured : notifications });
            } catch (error) {
                console.error('Dashboard content error:', error);
                return res.status(200).json({ banners: DEFAULT_BANNERS, notifications: [] });
            }
        }

        if (req.query.section === 'withdrawal-settings') {
            const { data: rows, error: settingsError } = await supabaseAdmin.from('settings').select('key, value').in('key', [
                'wd_min_amount', 'wd_max_amount', 'withdrawal_fee_pct', 'wd_hours_start', 'wd_hours_end', 'wd_daily_limit'
            ]);
            if (settingsError) return res.status(500).json({ error: 'Unable to load withdrawal settings' });
            const values = Object.fromEntries((rows || []).map((row) => [row.key, row.value]));
            return res.status(200).json({
                wd_min_amount: Number(values.wd_min_amount) || 1000,
                wd_max_amount: Number(values.wd_max_amount) || 1000000,
                withdrawal_fee_pct: Number(values.withdrawal_fee_pct) || 0,
                wd_hours_start: values.wd_hours_start || '08:00',
                wd_hours_end: values.wd_hours_end || '22:00',
                wd_daily_limit: Math.max(1, Number(values.wd_daily_limit) || 3)
            });
        }

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
