import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0, income_balance: 0 });
  const [vipData, setVipData] = useState({ level: 0, nextLevelReqs: [], currentProgress: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Fetch Auth Data (User + Wallet)
        const res = await fetch('/api/auth');
        if (!res.ok) throw new Error('Auth failed');
        const data = await res.json();
        
        setUser(data.user);
        setWallet(data.wallet || { balance: 0, income_balance: 0 });
        
        // Mock VIP Logic (Replace with real API call if you have /api/vip/status)
        // Assuming activeRefs determines VIP level based on ladder settings
        const activeRefs = data.stats?.activeReferrals || 0;
        const ladder = [3, 5, 10]; // Example thresholds
        let currentLevel = 0;
        let nextReq = ladder[0];
        
        for (let i = 0; i < ladder.length; i++) {
          if (activeRefs >= ladder[i]) {
            currentLevel = i + 1;
            nextReq = ladder[i+1] || null;
          } else {
            break;
          }
        }

        setVipData({
          level: currentLevel,
          nextLevelReqs: nextReq ? `needs ${nextReq - activeRefs} more activated invite(s)` : 'Highest VIP level reached',
          currentProgress: nextReq ? Math.min(100, (activeRefs / nextReq) * 100) : 100
        });

      } catch (err) {
        console.error(err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  if (loading) return <AppLayout>Loading...</AppLayout>;
  if (!user) return null;

  return (
    <AppLayout title="My Profile">
      
      {/* USER HEADER CARD */}
      <div className="profile-header-card">
        <div className="avatar-large yellow-border">
          {user.full_name?.charAt(0).toUpperCase() || 'M'}
        </div>
        <div className="user-info-main">
          <h2>{user.full_name || `Member ${user.phone.slice(-4)}`}</h2>
          <p>ID {user.id} · {user.phone}</p>
        </div>
      </div>

      {/* WALLET GRID (3 Columns) */}
      <div className="wallet-grid-3">
        <div className="wallet-item">
          <span className="amount gold">₦{(parseFloat(wallet.income_balance) || 0).toLocaleString()}</span>
          <span className="label">Product Income</span>
        </div>
        <div className="wallet-divider"></div>
        <div className="wallet-item">
          <span className="amount navy">₦{(parseFloat(wallet.balance) || 0).toLocaleString()}</span>
          <span className="label">Recharge Balance</span>
        </div>
        <div className="wallet-divider"></div>
        <div className="wallet-item">
          <span className="amount green">₦{(parseFloat(wallet.pending_out) || 0).toLocaleString()}</span>
          <span className="label">Withdraw Balance</span>
        </div>
      </div>

      {/* VIP STATUS CARD */}
      <div className="vip-status-card">
        <div className="vip-top-row">
          <div className="vip-badge-group">
            <svg viewBox="0 0 24 24" className="diamond-icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>VIP Level {vipData.level}</span>
          </div>
          <Link href="/team" className="btn-upgrade-pill">Upgrade ›</Link>
        </div>
        <p className="vip-desc">{vipData.nextLevelReqs}</p>
        <div className="progress-bar-thin">
          <div className="progress-fill-yellow" style={{ width: `${vipData.currentProgress}%` }}></div>
        </div>
      </div>

      {/* QUICK ACTIONS GRID */}
      <div className="actions-grid-4">
        <Link href="/recharge" className="action-tile">
          <div className="tile-icon purple-bg"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg></div>
          <span>Recharge</span>
        </Link>
        <Link href="/withdraw" className="action-tile">
          <div className="tile-icon blue-bg"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></div>
          <span>Withdraw</span>
        </Link>
        <Link href="/orders" className="action-tile">
          <div className="tile-icon orange-bg"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div>
          <span>Orders</span>
        </Link>
        <Link href="/team" className="action-tile">
          <div className="tile-icon navy-bg"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>
          <span>Team</span>
        </Link>
      </div>

      {/* APPLICATION SERVICE LIST */}
      <div className="service-list-section">
        <h3 className="section-heading">Application Service</h3>
        
        <Link href="/gift-code" className="list-item-arrow">
          <div className="item-left">
            <div className="icon-square orange"><svg viewBox="0 0 24 24"><path d="M20 6h-2.18c-.11-.31-.27-.59-.48-.84l1.42-1.42-1.42-1.42-1.42 1.42c-.25-.21-.53-.37-.84-.48V2h-2v1.82c-.31.11-.59.27-.84.48L8.84 2.9 7.42 4.32l1.42 1.42c-.21.25-.37.53-.48.84H4v2h2.18c.11.31.27.59.48.84L5.24 11.4l1.42 1.42 1.42-1.42c.25.21.53.37.84.48V16h2v-2.18c.31-.11.59-.27.84-.48l1.42 1.42 1.42-1.42-1.42-1.42c.21-.25.37-.53.48-.84H20V6zm-8 4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg></div>
            <span>Gift Code</span>
          </div>
          <svg viewBox="0 0 24 24" className="arrow-right"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </Link>

        <Link href="/history" className="list-item-arrow">
          <div className="item-left">
            <div className="icon-square blue"><svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg></div>
            <span>Transaction History</span>
          </div>
          <svg viewBox="0 0 24 24" className="arrow-right"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </Link>

        <Link href="/download" className="list-item-arrow">
          <div className="item-left">
            <div className="icon-square green"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></div>
            <span>Download App</span>
          </div>
          <svg viewBox="0 0 24 24" className="arrow-right"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </Link>
        
        <button onClick={async () => { await fetch('/api/auth', {method:'POST', body: JSON.stringify({action:'logout'})}); router.push('/'); }} className="list-item-arrow danger-text">
           <div className="item-left">
             <div className="icon-square red"><svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg></div>
             <span>Log Out</span>
           </div>
        </button>
      </div>

    </AppLayout>
  );
}
