import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { supabaseAdmin } from './supabase';

const SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = process.env.COOKIE_NAME || 'lebara_session';

/**
 * Generate a signed JWT token
 */
export function generateToken(payload) {
    if (!SECRET) throw new Error('JWT_SECRET is not configured');
    return jwt.sign(payload, SECRET, { expiresIn: '7d' }); // Session lasts 7 days
}

/**
 * Set the auth cookie on the response object
 */
export function setAuthCookie(res, token) {
    res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    }));
}

/**
 * Clear the auth cookie (Logout)
 */
export function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: -1,
    }));
}

/**
 * Verify token from request headers/cookies
 * Returns decoded payload or null if invalid/expired
 */
export function verifyToken(req) {
    const cookies = req.cookies;
    if (!cookies || !cookies[COOKIE_NAME] || !SECRET) return null;
    
    try {
        return jwt.verify(cookies[COOKIE_NAME], SECRET);
    } catch (e) {
        return null;
    }
}

/**
 * Middleware guard: Ensures user is logged in
 * Usage: const user = requireAuth(req, res); if(!user) return;
 */
export async function requireAuth(req, res) {
    const decoded = verifyToken(req);
    if (!decoded) {
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
        return null;
    }
    const { data: account, error } = await supabaseAdmin.from('users')
        .select('id, is_banned').eq('id', decoded.id).maybeSingle();
    if (error) {
        res.status(503).json({ error: 'Account status could not be verified.' });
        return null;
    }
    if (!account) {
        clearAuthCookie(res);
        res.status(401).json({ error: 'Account not found.' });
        return null;
    }
    if (account.is_banned) {
        clearAuthCookie(res);
        res.status(403).json({ error: 'Account suspended.' });
        return null;
    }
    return decoded; // Contains { id, phone, role? }
}
