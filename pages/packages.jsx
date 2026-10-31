import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

export default function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general'); // 'general' or 'vip'
  const [userStats, setUserStats] = useState({ activeRefs: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch all packages
        const pkgRes = await fetch('/api/packages/list'); 
        if (!pkgRes.ok) throw new Error('Failed to load packages');
        const pkgs = await pkgRes.json();
        setPackages(pkgs);

        // Fetch user referral stats for VIP gating
        const statRes = await fetch('/api/user/stats');
        if (statRes.ok) {
          const stats = await statRes.json();
          setUserStats(stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredPkgs = packages.filter(p => p.category === tab);

  return (
    <AppLayout title="Investment Plans">
      {loading ? <div className="empty-state">Loading plans...</div> : (
        <>
          {/* Tabs */}
          <div className="tabs">
            <button className={`tab-btn ${tab==='general'?'on':''}`} onClick={() => setTab('general')}>General</button>
            <button className={`tab-btn ${tab==='vip'?'on':''}`} onClick={() => setTab('vip')}>VIP</button>
          </div>
          
          <p className="subhead">
            {tab === 'general' ? 'Standard investment tiers available to all members.' : 'Exclusive high-yield packages requiring activated referrals.'}
          </p>

          {/* Grid */}
          <div className="pkg-grid">
            {filteredPkgs.map(pkg => {
              const isLocked = pkg.is_locked;
              const reqInvites = pkg.vip_required_invites || 0;
              const meetsReq = userStats.activeRefs >= reqInvites;
              
              // Determine button state
              let btnClass = 'buy-btn';
              let btnText = 'Buy Now';
              let href = `/order-detail?id=${pkg.id}`;
              let badge = null;

              if (isLocked) {
                btnClass += ' btn-soon';
                btnText = 'Launching Soon';
                href = '#'; // Disable link
                badge = <span className="badge-soon">COMING SOON</span>;
              } else if (tab === 'vip' && !meetsReq) {
                btnClass += ' btn-disabled';
                btnText = `Need ${reqInvites} Refs`;
                href = '#';
                badge = <span className="badge-lock">🔒 Locked</span>;
              }

              return (
                <div key={pkg.id} className="pkg-card">
                  <div className="pkg-img">
                    {pkg.image_url && <img src={pkg.image_url} alt={pkg.name} />}
                    {badge}
                  </div>
                  <div className="pkg-body">
                    <div className="pkg-name">
                      <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      {pkg.name}
                    </div>
                    <div className="figs">
                      <div className="fig-row"><span>Price:</span><b>₦{parseFloat(pkg.price).toLocaleString()}</b></div>
                      <div className="fig-row"><span>Term:</span><b>{pkg.days} Days</b></div>
                      <div className="fig-row"><span>Daily:</span><b className="gold">₦{parseFloat(pkg.daily_income).toLocaleString()}</b></div>
                      <div className="fig-row"><span>Total:</span><b className="gold">₦{parseFloat(pkg.total_income).toLocaleString()}</b></div>
                    </div>
                    
                    {href !== '#' ? (
                      <Link href={href} className={btnClass}>{btnText}</Link>
                    ) : (
                      <button className={btnClass} disabled>{btnText}</button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredPkgs.length === 0 && <div className="empty-state">No packages found in this category.</div>}
          </div>
        </>
      )}
    </AppLayout>
  );
}
