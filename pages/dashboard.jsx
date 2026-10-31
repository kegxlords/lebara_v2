import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/user/stats'); // You'll need to create this simple API route later
      if (res.ok) {
        setStats(await res.json());
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <AppLayout>Loading...</AppLayout>;

  return (
    <AppLayout title="Dashboard">
      <div className="grid-cards">
        <div className="stat-card">
          <span className="label">Recharge Balance</span>
          <span className="value">₦{(stats?.recharge || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card gold">
          <span className="label">Income Balance</span>
          <span className="value">₦{(stats?.income || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="label">Active Packages</span>
          <span className="value">{stats?.activeCount || 0}</span>
        </div>
      </div>

      <div className="quick-actions">
        <a href="/recharge" className="action-btn primary">Deposit Funds</a>
        <a href="/withdraw" className="action-btn secondary">Withdraw</a>
      </div>

      <h3 className="section-title">Recent Activity</h3>
      <div className="list-container">
        {stats?.recentTxns?.length ? (
          stats.recentTxns.map(txn => (
            <div key={txn.id} className="list-item">
              <div>
                <strong>{txn.type.toUpperCase()}</strong>
                <small>{new Date(txn.created_at).toLocaleDateString()}</small>
              </div>
              <span className={txn.direction === 'credit' ? 'amt-pos' : 'amt-neg'}>
                {txn.direction === 'credit' ? '+' : '-'}₦{parseFloat(txn.amount).toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">No recent activity.</div>
        )}
      </div>
    </AppLayout>
  );
}
