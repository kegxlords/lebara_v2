import { clearAuthCookie } from '../../../lib/auth';

export default function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    clearAuthCookie(res);
    res.status(200).json({ success: true });
}
