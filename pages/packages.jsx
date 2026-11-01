import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function PackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general'); // 'general' or 'vip'
  
  // User Stats for VIP Gating
  const [userStats, setUserStats] = useState({ 
    activeRefs: 0, 
    balance: 0 
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch All Packages
        const pkgRes = await fetch('/api/packages'); 
        if (!pkgRes.ok) throw new Error('Failed to load packages');
        const pkgs = await pkgRes.json();
        setPackages(Array.isArray(pkgs) ? pkgs : []);

        // 2. Fetch User Stats (Balance + Active Refs)
        const authRes = await fetch('/api/auth');
        if (authRes.ok) {
          const data = await authRes.json();
          setUserStats({
            activeRefs: data.stats?.activeReferrals || 0,
            balance: parseFloat(data.wallet?.balance || 0)
          });
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
      {loading ? (
        <div className="empty-state">Loading plans...</div>
      ) : (
        <>
          {/* TABS */}
          <div className="tabs">
            <button 
              className={`tab-btn ${tab==='general'?'on':''}`} 
              onClick={() => setTab('general')}
            >
              General
            </button>
            <button 
              className={`tab-btn ${tab==='vip'?'on':''}`} 
              onClick={() => setTab('vip')}
            >
              VIP
            </button>
          </div>
          
          <p className="subhead">
            {tab === 'general' 
              ? 'Standard investment tiers available to all members.' 
              : 'Exclusive high-yield packages requiring activated referrals.'}
          </p>

          {/* GRID */}
          <div className="pkg-grid">
            {filteredPkgs.length === 0 && (
              <div className="empty-state" style={{ gridColumn: 'span 2' }}>No packages found.</div>
            )}
            
            {filteredPkgs.map(pkg => {
              const isLocked = pkg.is_locked;
              const reqInvites = pkg.vip_required_invites || 0;
              const meetsReq = userStats.activeRefs >= reqInvites;
              const canAfford = userStats.balance >= parseFloat(pkg.price);
              
              // Determine Visual State
              let badgeHtml = null;
              let btnClass = 'buy-btn';
              let btnText = 'Buy Now';
              let href = `/order-detail?id=${pkg.id}`;
              let isDisabled = false;

              if (isLocked) {
                // Coming Soon State
                badgeHtml = <span className="badge-soon">COMING SOON</span>;
                btnClass += ' btn-soon';
                btnText = 'Launching Soon';
                href = '#';
                isDisabled = true;
              } else if (tab === 'vip' && !meetsReq) {
                // Locked by Referral Count
                badgeHtml = <span className="badge-lock">🔒 REQUIRES {reqInvITES} REFERRALS</span>;
                btnClass += ' btn-disabled';
                btnText = `You have ${userStats.activeRefs}/${reqInvites}`;
                href = '#';
                isDisabled = true;
              } else if (!canAfford) {
                // Insufficient Balance (Visual cue only, still clickable to show error/topup)
                btnText = 'Insufficient Balance';
                btnClass += ' btn-warning';
              }

              return (
                <div key={pkg.id} className="pkg-card">
                  <div className="pkg-img">
                    {pkg.image_url && <img src={pkg.image_url} alt={pkg.name} />}
                    {badgeHtml}
                  </div>
                  
                  <div className="pkg-body">
                    <div className="pkg-name">
                      <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      {pkg.name}
                    </div>
                    
                    {/* ALWAYS SHOW DATA EVEN IF LOCKED */}
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
          </div>
        </>
      )}
    </AppLayout>
  );
}
