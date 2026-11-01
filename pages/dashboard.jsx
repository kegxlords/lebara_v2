import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/auth', { method: 'GET' });
        if (!res.ok) throw new Error('Failed to load data');
        
        const data = await res.json();
        setStats({
            recharge: parseFloat(data.wallet.balance || 0),
            income: parseFloat(data.wallet.income_balance || 0),
            name: data.user.full_name || 'Member',
            refCode: data.user.referral_code || ''
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <AppLayout>Loading...</AppLayout>;

  return (
    <AppLayout>
      {/* HERO SECTION */}
      <div className="hero-banner">
        <div className="banner-content">
          <h2 className="brand-logo-lg">LEBARA</h2>
          <p className="tagline">Voice & Data Solutions</p>
        </div>
        {/* Carousel Dots Placeholder */}
        <div className="carousel-dots">
           <span className="dot active"></span>
           <span className="dot"></span>
           <span className="dot"></span>
        </div>
      </div>

      {/* LIVE TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-move">
          <span>🔥 user M***5 deposited ₦1,000</span>
          <span>✨ user J***8 earned ₦500 commission</span>
          <span>💎 New VIP package launched!</span>
        </div>
      </div>

      {/* ACTION GRID */}
      <div className="action-grid-card">
        <div className="grid-row">
          <Link href="/sign" className="grid-item">
            <div className="icon-circle red"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z"/></svg></div>
            <span>Sign</span>
          </Link>
          <Link href="/team" className="grid-item">
            <div className="icon-circle blue"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>
            <span>My team</span>
          </Link>
          <Link href="/recharge" className="grid-item">
            <div className="icon-circle orange"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg></div>
            <span>Recharge</span>
          </Link>
          <Link href="/withdraw" className="grid-item">
            <div className="icon-circle purple"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></div>
            <span>Withdraw</span>
          </Link>
        </div>
        <div className="grid-row">
          <Link href="/packages?vip=true" className="grid-item">
            <div className="icon-circle gold"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
            <span>VIP</span>
          </Link>
          <Link href="/invite" className="grid-item">
            <div className="icon-circle magenta"><svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
            <span>Invite</span>
          </Link>
          <Link href="/download" className="grid-item">
            <div className="icon-circle cyan"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></div>
            <span>Download</span>
          </Link>
          <Link href="/support" className="grid-item">
            <div className="icon-circle navy"><svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/></svg></div>
            <span>Service</span>
          </Link>
        </div>
      </div>
      
      {/* RECENT ACTIVITY LIST COULD GO HERE */}
    </AppLayout>
  );
}
