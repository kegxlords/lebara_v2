import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('phone, referral_code')
            .eq('id', user.id)
            .single();

        // 1. Get Direct Referrals (L1)
        const { data: members } = await supabaseAdmin
            .from('users')
            .select('id, full_name, phone, activated_at, created_at')
            .eq('referred_by', user.id)
            .order('created_at', { ascending: false });

        // 2. Calculate Commissions
        let totalComm = 0;
        const commMap = {};

        if (members && members.length > 0) {
            const { data: comms = [] } = await supabaseAdmin
                .from('transactions')
                .select('amount, meta')
                .eq('user_id', user.id)
                .eq('type', 'bonus')
                .like('reference', 'comm_l1_%');

            comms.forEach(c => {
                let meta = c.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch { meta = {}; }
                }
                const fromUid = meta.from_user;
                if (fromUid) {
                    commMap[fromUid] = (commMap[fromUid] || 0) + parseFloat(c.amount);
                    totalComm += parseFloat(c.amount);
                }
            });
        }

        const enrichedMembers = (members || []).map(m => ({
            ...m,
            commission_earned: commMap[m.id] || 0
        }));

        const activeRefs = members ? members.filter(m => m.activated_at).length : 0;

        res.status(200).json({
            userPhone: profile?.phone || '',
            referralCode: profile?.referral_code || '',
            members: enrichedMembers,
            stats: { l1Count: members?.length || 0, l1Active: activeRefs, totalComm }
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch team' });
    }
}
