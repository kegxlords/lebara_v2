import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Call unified auth endpoint which now includes wallet stats
        const res = await fetch('/api/auth', { method: 'GET' });
        
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/'); // Redirect to login if unauthorized
            return;
          }
          throw new Error(`API Error: ${res.status}`);
        }
        
        const json = await res.json();
        
        // Safety check: Ensure expected structure exists
        if (!json.user || !json.wallet) {
             throw new Error('Invalid response format from server');
        }

        setData(json);
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <div className="empty-state" style={{ padding: '50px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Error">
        <div className="msg error" style={{ margin: '20px' }}>
          <strong>Error:</strong> {error}
          <br/><br/>
          <button onClick={() => window.location.reload()} className="btn-primary" style={{marginTop:'10px'}}>Retry</button>
        </div>
      </AppLayout>
    );
  }

  // Safe destructuring with defaults
  const user = data?.user || {};
  const wallet = data?.wallet || { balance: 0, income_balance: 0 };
  const stats = data?.stats || { activePackages: 0 };

  return (
    <AppLayout title={`Hi, ${user.full_name?.split(' ')[0] || 'Member'}`}>
      
      {/* BALANCE CARDS */}
      <div className="grid-cards">
        <div className="stat-card">
          <span className="label">Recharge Balance</span>
          <span className="value">₦{parseFloat(wallet.balance || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card gold">
          <span className="label">Income Balance</span>
          <span className="value">₦{parseFloat(wallet.income_balance || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="label">Active Packages</span>
          <span className="value">{stats.activePackages}</span>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="quick-actions">
        <Link href="/recharge" className="action-btn primary">Deposit Funds</Link>
        <Link href="/packages" className="action-btn secondary">Buy Package</Link>
      </div>

      {/* REFERRAL CODE BOX */}
      <div className="card-form" style={{ marginTop: '20px', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <h4 style={{ color: '#166534', marginBottom: '8px' }}>Your Referral Code</h4>
        <p className="muted text-sm mb-2">Share this code to earn commissions.</p>
        <div className="input-group" style={{ background: '#fff', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <code style={{ fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px' }}>
             {user.referral_code || 'LOADING...'}
           </code>
           <button 
             className="q-btn" 
             onClick={() => navigator.clipboard.writeText(user.referral_code)}
           >
             Copy
           </button>
        </div>
      </div>

    </AppLayout>
  );
}
