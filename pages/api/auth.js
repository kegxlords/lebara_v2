import { supabaseAdmin, createSupabaseAuthClient } from '../../lib/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken, setAuthCookie, clearAuthCookie, verifyToken } from '../../lib/auth';

async function awardWelcomeBonus(userId) {
    const { error } = await supabaseAdmin.rpc('grant_welcome_bonus', { p_user_id: userId });
    if (error) console.error('Welcome bonus could not be applied:', error.message);
}

function normalizeLocalPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('234')) return digits.slice(3);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
}

function authUserMatchesAccount(authUser, account, phone) {
    if (authUser.id === account.id) return true;
    const authEmail = String(authUser.email || '').trim().toLowerCase();
    const accountEmail = String(account.email || '').trim().toLowerCase();
    if (authEmail && accountEmail && authEmail === accountEmail) return true;
    return normalizeLocalPhone(authUser.phone) === phone;
}

export default async function handler(req, res) {
    const method = req.method;

    // GET: Return current user profile + wallet stats
    if (method === 'GET') {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const { data: user, error: uErr } = await supabaseAdmin
                .from('users')
                .select('id, full_name, phone, email, referral_code, referred_by, role, is_admin, is_banned, created_at, withdrawal_pin_hash')
                .eq('id', decoded.id)
                .maybeSingle();
            
            if (uErr) throw uErr;
            if (!user) { clearAuthCookie(res); return res.status(401).json({ error: 'User not found' }); }
            if (user.is_banned) { clearAuthCookie(res); return res.status(403).json({ error: 'Account suspended' }); }

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
            const localPhone = normalizeLocalPhone(phone);
            if (!/^\d{10}$/.test(localPhone)) return res.status(401).json({ error: 'Invalid credentials' });

            const { data: user, error } = await supabaseAdmin
                .from('users').select('*').eq('phone', localPhone).maybeSingle();
            if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
            if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });

            try {
                const authClient = createSupabaseAuthClient();
                const credentials = [{ phone: `+234${localPhone}` }];
                if (user.email) credentials.push({ email: String(user.email).trim().toLowerCase() });
                let authUser = null;
                for (const identity of credentials) {
                    const { data, error: authError } = await authClient.auth.signInWithPassword({ ...identity, password });
                    if (!authError && data?.user) { authUser = data.user; break; }
                }
                if (!authUser || !authUserMatchesAccount(authUser, user, localPhone)) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
            } catch (authError) {
                console.error('Supabase sign-in failed:', authError?.code || authError?.message || 'unknown error');
                return res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' });
            }

            await awardWelcomeBonus(user.id);
            const token = generateToken({ id: user.id, phone: user.phone });
            setAuthCookie(res, token);
            const safeUser = { id: user.id, full_name: user.full_name, phone: user.phone, is_admin: user.is_admin === true };
            return res.status(200).json({ success: true, user: safeUser });
        }

        // REGISTER
        if (action === 'register') {
            const { fullName, phone, password, email, refCode } = req.body;
            if (!fullName || !phone || !password) return res.status(400).json({ error: 'Missing fields' });
            if (typeof phone !== 'string' || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
            if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
            const emailValue = email ? String(email).trim().toLowerCase() : null;
            if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return res.status(400).json({ error: 'Enter a valid email address.' });

            // Check Duplicate
            const { data: existing, error: lookupError } = await supabaseAdmin.from('users').select('id').eq('phone', phone).maybeSingle();
            if (lookupError) return res.status(503).json({ error: 'Could not verify this phone number. Please try again.' });
            if (existing) return res.status(409).json({ error: 'Phone already registered' });

            // Hash Password
            const salt = await bcrypt.genSalt(12);
            const hashedPass = await bcrypt.hash(password, salt);

            // Resolve Referrer
            let referredByUuid = null;
            if (refCode) {
                const { data: referrer } = await supabaseAdmin.from('users').select('id').eq('referral_code', refCode.toUpperCase()).single();
                if (referrer) referredByUuid = referrer.id;
            }

            // Generate Unique Code
            const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();

            // Create the Supabase Auth identity first; public.users keeps the
            // app profile and uses the Auth UUID so both records stay linkable.
            let authUser;
            try {
                const authAttributes = {
                    phone: `+234${phone}`,
                    password,
                    phone_confirm: true,
                    user_metadata: { full_name: fullName }
                };
                if (emailValue) authAttributes.email = emailValue;
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(authAttributes);
                if (authError) {
                    const duplicate = authError.status === 409 || authError.status === 422
                        || ['email_exists', 'phone_exists', 'user_already_exists'].includes(authError.code);
                    if (duplicate) return res.status(409).json({ error: 'Phone or email already registered.' });
                    console.error('Supabase account creation failed:', authError.code || authError.message);
                    return res.status(503).json({ error: 'Could not create your account. Please try again.' });
                }
                authUser = authData?.user;
                if (!authUser?.id) throw new Error('Supabase Auth did not return a user id.');
            } catch (authError) {
                console.error('Supabase account creation failed:', authError?.code || authError?.message || 'unknown error');
                return res.status(503).json({ error: 'Could not create your account. Please try again.' });
            }

            // Insert User
            const { data: newUser, error: insertErr } = await supabaseAdmin
                .from('users')
                .insert({
                    id: authUser.id,
                    full_name: fullName,
                    phone: phone,
                    email: emailValue,
                    password_hash: hashedPass,
                    referral_code: newCode,
                    referred_by: referredByUuid,
                    is_admin: false,
                    is_banned: false
                })
                .select('id, full_name, phone, email, referral_code, referred_by, role, is_admin, created_at')
                .single();

            if (insertErr?.code === '23505') {
                await supabaseAdmin.auth.admin.deleteUser(authUser.id);
                return res.status(409).json({ error: 'Phone already registered' });
            }
            if (insertErr) {
                await supabaseAdmin.auth.admin.deleteUser(authUser.id);
                throw insertErr;
            }

            // Create Wallet
            const { error: walletError } = await supabaseAdmin.from('wallets').insert({ user_id: newUser.id });
            if (walletError) {
                await supabaseAdmin.from('users').delete().eq('id', newUser.id);
                await supabaseAdmin.auth.admin.deleteUser(authUser.id);
                return res.status(500).json({ error: 'Account setup failed. Please try registering again.' });
            }
            await awardWelcomeBonus(newUser.id);

            // Auto Login
            const token = generateToken({ id: newUser.id, phone: newUser.phone });
            setAuthCookie(res, token);

            return res.status(201).json({ success: true, user: newUser });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).end();
}
