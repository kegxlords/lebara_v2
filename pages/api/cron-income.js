import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).end();
    
    // Security Check
    const authorization = String(req.headers.authorization || '');
    const bearerSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const secret = req.headers['x-cron-secret'] || bearerSecret;
    const configuredSecret = process.env.CRON_SECRET_KEY || process.env.CRON_SECRET;
    if (!configuredSecret || secret !== configuredSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const nowTs = Math.floor(Date.now() / 1000);
    
    try {
        // Fetch Active Packages due for payment
        const { data: packages, error } = await supabaseAdmin
            .from('user_packages')
            .select(`*, packages(name, daily_income)`)
            .eq('status', 'active')
            .order('purchased_at', { ascending: true });

        if (error) throw error;
        const eligiblePackages = (packages || []).filter((pkg) => Number(pkg.days_collected) < Number(pkg.days));
        if (!eligiblePackages.length) {
            return res.status(200).json({ message: 'No eligible packages' });
        }

        let paidCount = 0;
        let totalCredited = 0;

        for (const pkg of eligiblePackages) {
            const purchaseEpoch = new Date(pkg.purchased_at).getTime() / 1000;
            const nextDueEpoch = purchaseEpoch + ((pkg.days_collected + 1) * 86400);

            if (nowTs < nextDueEpoch) continue; // Not due yet

            // ATOMIC UPDATE via RPC
            const { error: updateErr } = await supabaseAdmin.rpc('process_daily_income', {
                p_user_id: pkg.user_id,
                p_pkg_id: pkg.id,
                p_amount: parseFloat(pkg.packages.daily_income),
                p_new_day_count: pkg.days_collected + 1,
                p_total_days: pkg.days
            });

            if (!updateErr) {
                paidCount++;
                totalCredited += parseFloat(pkg.packages.daily_income);
            }
        }

        res.status(200).json({ success: true, processed: paidCount, credited: totalCredited });

    } catch (err) {
        console.error('Cron Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
