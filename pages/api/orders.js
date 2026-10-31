import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const { data, error } = await supabaseAdmin
            .from('user_packages')
            .select(`
                *, 
                packages(name, image_url, daily_income, days)
            `)
            .eq('user_id', user.id)
            .order('purchased_at', { ascending: false });

        if (error) throw error;

        const nowMs = Date.now();
        const orders = (data || []).map(op => {
            const purchaseDate = new Date(op.purchased_at);
            const nextDropMs = purchaseDate.getTime() + ((op.days_collected + 1) * 24 * 60 * 60 * 1000);
            const diffSecs = Math.floor((nextDropMs - nowMs) / 1000);
            
            return {
                ...op,
                name: op.packages?.name,
                image_url: op.packages?.image_url,
                daily_income: op.packages?.daily_income,
                days: op.packages?.days,
                next_drop_seconds: diffSecs > 0 ? diffSecs : 0,
                is_complete: op.status === 'completed'
            };
        });

        res.status(200).json(orders);

    } catch (err) {
        res.status(500).json({ error: 'Failed to load orders' });
    }
}
