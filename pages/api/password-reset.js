import { supabaseAdmin } from '../../lib/supabase';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const method = req.method;

    // POST: Request Reset Link
    if (method === 'POST') {
        const { identifier } = req.body; // Phone or Email
        if (!identifier) return res.status(400).json({ error: 'Identifier required' });

        // Find User
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, email, phone')
            .or(`phone.eq.${identifier},email.eq.${identifier}`)
            .single();

        // Security: Always return success to prevent enumeration
        if (!user) return res.status(200).json({ message: 'If account exists, link sent.' });

        // Generate Token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // Save Token
        await supabaseAdmin.from('password_resets').delete().eq('user_id', user.id);
        await supabaseAdmin.from('password_resets').insert({
            user_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString()
        });

        // Send Email (Placeholder - integrate with Resend/SendGrid here)
        // sendEmail(user.email, 'Reset Password', `Link: https://.../reset-password?token=${rawToken}`);
        
        console.log(`RESET LINK FOR ${user.phone}: /reset-password?token=${rawToken}`);
        
        return res.status(200).json({ message: 'Reset link generated.' });
    }

    // PUT: Execute Reset
    if (method === 'PUT') {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Validate Token
        const { data: record } = await supabaseAdmin
            .from('password_resets')
            .select('*')
            .eq('token_hash', tokenHash)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!record) return res.status(400).json({ error: 'Invalid or expired token' });

        // Update Password
        const salt = await bcrypt.genSalt(10);
        const hashedNewPass = await bcrypt.hash(newPassword, salt);
        
        await supabaseAdmin.from('users').update({ password_hash: hashedNewPass }).eq('id', record.user_id);
        
        // Delete Used Token
        await supabaseAdmin.from('password_resets').delete().eq('token_hash', tokenHash);

        return res.status(200).json({ success: true });
    }

    return res.status(405).end();
}
