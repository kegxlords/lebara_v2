import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
    const user = requireAuth(req, res);
    if (!user) return;
    const { data: adminUser, error: adminError } = await supabaseAdmin
        .from('users').select('is_admin, role').eq('id', user.id).maybeSingle();
    if (adminError || !adminUser || (!adminUser.is_admin && adminUser.role !== 'admin')) {
        return res.status(403).json({ error: 'Administrator access required' });
    }

    const method = req.method;
    const { section, action, ...body } = req.body || req.query;

    // GET: Fetch Data
    if (method === 'GET') {
        if (section === 'stats') {
            const [totalUsers, pendingWds, todayDeposits, activePkgs] = await Promise.all([
                supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
                supabaseAdmin.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabaseAdmin.from('recharge_requests').select('amount').gte('created_at', new Date().setHours(0,0,0,0)).eq('status', 'approved'),
                supabaseAdmin.from('user_packages').select('*', { count: 'exact', head: true }).eq('status', 'active')
            ]);
            const depSum = todayDeposits.data.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
            return res.status(200).json({
                totalUsers: totalUsers.count || 0,
                pendingWds: pendingWds.count || 0,
                todayDeposits: depSum,
                activePkgs: activePkgs.count || 0
            });
        }
        if (section === 'withdrawals') {
            const { data } = await supabaseAdmin.from('withdrawals').select('*, users(phone)').order('created_at', { ascending: false }).limit(50);
            return res.status(200).json(data || []);
        }
        return res.status(400).json({ error: 'Invalid section' });
    }

    // POST: Perform Action
    if (method === 'POST') {
        if (action === 'approve-wd') {
            const { wdId } = body;
            await supabaseAdmin.from('withdrawals').update({ status: 'processing', handled_at: new Date() }).eq('id', wdId);
            return res.status(200).json({ success: true });
        }
        if (action === 'reject-wd') {
            const { wdId } = body;
            const { data: wd } = await supabaseAdmin.from('withdrawals').select('user_id, amount').eq('id', wdId).single();
            if (!wd) return res.status(404).json({ error: 'Not found' });
            await supabaseAdmin.rpc('refund_withdrawal_failure', { p_wd_id: wdId, p_reason: 'Rejected by Admin' });
            return res.status(200).json({ success: true });
        }
        if (action === 'update-setting') {
            const { key, value } = body;
            await supabaseAdmin.from('settings').upsert({ key, value });
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).end();
}
