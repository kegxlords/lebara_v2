import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = process.env.COOKIE_NAME || 'lebara_session';

/**
 * Generate a signed JWT token
 */
export function generateToken(payload) {
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
    if (!cookies || !cookies[COOKIE_NAME]) return null;
    
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
export function requireAuth(req, res) {
    const decoded = verifyToken(req);
    if (!decoded) {
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
        return null;
    }
    return decoded; // Contains { id, phone, role? }
}
