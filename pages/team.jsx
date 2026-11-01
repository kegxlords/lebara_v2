import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

export default function TeamPage() {
  const [teamData, setTeamData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchTeam() {
      const res = await fetch('/api/team'); 
      if (res.ok) setTeamData(await res.json());
    }
    fetchTeam();
  }, []);

  if (!teamData) return <AppLayout>Loading...</AppLayout>;

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') { setCopiedCode(true); setTimeout(()=>setCopiedCode(false), 2000); }
    else { setCopiedLink(true); setTimeout(()=>setCopiedLink(false), 2000); }
  };

  return (
    <AppLayout title="My Team">
      
      {/* HEADER WITH SHARE BUTTON */}
      <div className="team-header-flex">
        <div className="avatar-medium purple-gradient">M</div>
        <div className="header-text">
          <h2>My Team</h2>
          <small>{teamData.userPhone} · code {teamData.referralCode}</small>
        </div>
        <button className="btn-share-yellow" onClick={() => alert("Native share dialog triggered")}>Share</button>
      </div>

      {/* STATS ROW (4 Items) */}
      <div className="stats-row-4-bordered">
        <div className="stat-col"><b>{teamData.stats.directCount}</b><span>DIRECT</span></div>
        <div className="stat-col"><b>{teamData.stats.level2Count}</b><span>LEVEL-2</span></div>
        <div className="stat-col highlight-pink"><b>{teamData.stats.activatedCount}</b><span>ACTIVATED</span></div>
        <div className="stat-col money-gold"><b>₦{parseFloat(teamData.stats.totalDeposits).toLocaleString()}</b><span>TEAM DEPOSITS</span></div>
      </div>

      {/* INVITATION CODE BOX */}
      <div className="invite-box-dashed">
        <label>YOUR INVITATION CODE</label>
        <div className="code-action-row">
          <h2 className="big-code">{teamData.referralCode}</h2>
          <button className={`btn-copy-sm ${copiedCode ? 'success' : ''}`} onClick={() => handleCopy(teamData.referralCode, 'code')}>
            {copiedCode ? 'Copied!' : 'Copy code'}
          </button>
        </div>
        <div className="link-action-row">
          <input type="text" readOnly value={`${window.location.origin}/register?ref=${teamData.referralCode}`} />
          <button className={`btn-copy-link ${copiedLink ? 'success' : ''}`} onClick={() => handleCopy(`${window.location.origin}/register?ref=${teamData.referralCode}`, 'link')}>
            {copiedLink ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* VIP PROGRESS MINI-CARD */}
      <div className="vip-mini-card-dark">
        <div className="flex-between mb-2">
          <span className="diamond-icon-sm">💎</span>
          <span className="font-bold">VIP Level {teamData.currentVipLevel}</span>
        </div>
        <p className="text-xs opacity-80">{teamData.vipStatusText}</p>
        <div className="progress-bar-white-track mt-2">
          <div className="progress-fill-yellow-solid" style={{ width: `${teamData.vipProgress}%` }}></div>
        </div>
      </div>

      {/* LEVEL 1 REFERRALS LIST */}
      <div className="section-title-with-badge">
        <h3>Level 1 referrals</h3>
        <span className="badge-commission">{teamData.l1Rate}% commission</span>
      </div>

      <div className="referrals-list-container">
        {teamData.l1Members && teamData.l1Members.length > 0 ? (
          teamData.l1Members.map(member => (
            <div key={member.id} className="member-card-full">
              <div className="member-head">
                <div className="avatar-small-purple">{member.name.charAt(0)}</div>
                <div className="member-info">
                  <b>{member.name}</b>
                  <small className="block muted">joined {new Date(member.joined).toLocaleDateString()}</small>
                </div>
                <span className={`status-pill ${member.isActive ? 'green' : 'orange'}`}>
                  {member.isActive ? 'ACTIVE' : 'PENDING'}
                </span>
              </div>
              
              <div className="member-stats-grid-3">
                <div className="m-stat">
                  <b className="pink">{member.depositCount}</b>
                  <span>DEPOSITS</span>
                </div>
                <div className="m-stat">
                  <b className="gold">₦{member.totalDeposited.toLocaleString()}</b>
                  <span>TOTAL DEPOSITED</span>
                </div>
                <div className="m-stat">
                  <b className="navy">₦{member.investedAmount.toLocaleString()}</b>
                  <span>INVESTED</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state-card">No Level 1 members yet.</div>
        )}
      </div>

      {/* LEVEL 2 REFERRALS LIST (Compact) */}
      <div className="section-title-with-badge mt-4">
        <h3>Level 2 referrals</h3>
        <span className="badge-commission gray">{teamData.l2Rate}% commission</span>
      </div>
       <div className="referrals-list-container">
        {teamData.l2Members && teamData.l2Members.length > 0 ? (
          teamData.l2Members.map(member => (
             <div key={member.id} className="member-card-compact">
               <div className="avatar-small-pink">{member.name.charAt(0)}</div>
               <div className="flex-1 ml-2">
                 <b>{member.name}</b>
                 <small className="block muted text-xs">joined {new Date(member.joined).toLocaleDateString()}</small>
               </div>
               <span className={`status-pill small ${member.isActive ? 'green' : 'gray'}`}>{member.isActive ? 'ACTIVE' : 'PENDING'}</span>
             </div>
          ))
        ) : (
          <div className="empty-state-card small">No Level 2 members yet.</div>
        )}
      </div>

    </AppLayout>
  );
}
