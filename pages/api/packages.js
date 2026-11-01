import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
    const method = req.method;

    // GET: List All Packages
    if (method === 'GET') {
        const { data, error } = await supabaseAdmin
            .from('packages')
            .select('*')
            .eq('is_active', true)
            .order('category', { ascending: true })
            .order('price', { ascending: true });
        
        if (error) return res.status(500).json({ error: 'Load failed' });
        return res.status(200).json(data || []);
    }

    // POST: Buy Package
    if (method === 'POST') {
        const user = requireAuth(req, res);
        if (!user) return;

        const { packageId } = req.body;
        if (!packageId) return res.status(400).json({ error: 'Package ID required' });

        try {
            // 1. Get Package
            const { data: pkg } = await supabaseAdmin.from('packages').select('*').eq('id', packageId).single();
            if (!pkg || pkg.is_locked) return res.status(404).json({ error: 'Package unavailable' });

            // 2. Check Balance
            const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', user.id).single();
            if (!wallet || parseFloat(wallet.balance) < parseFloat(pkg.price)) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }

            // 3. Atomic Purchase via RPC
            const purchaseResult = await supabaseAdmin.rpc('buy_package', {
                p_user_id: user.id,
                p_pkg_id: pkg.id,
                p_price: pkg.price,
                p_daily: pkg.daily_income,
                p_total: pkg.total_income,
                p_days: pkg.days
            });
            if (purchaseResult.error) throw purchaseResult.error;

            res.status(200).json({ success: true });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Purchase failed' });
        }
        return;
    }

    return res.status(405).end();
}
