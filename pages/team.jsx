import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

export default function TeamPage() {
  const [teamData, setTeamData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchTeam() {
      const res = await fetch('/api/team'); // Assuming /api/team returns members + stats
      if (res.ok) {
        setTeamData(await res.json());
      }
    }
    fetchTeam();
  }, []);

  if (!teamData) return <AppLayout>Loading...</AppLayout>;

  const handleCopy = () => {
    navigator.clipboard.writeText(teamData.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout title="My Team">
      
      {/* STATS ROW */}
      <div className="stats-row-4">
        <div className="stat-mini"><b>{teamData.stats.directCount}</b><span>DIRECT</span></div>
        <div className="stat-mini"><b>{teamData.stats.level2Count}</b><span>LEVEL-2</span></div>
        <div className="stat-mini highlight"><b>{teamData.stats.activatedCount}</b><span>ACTIVATED</span></div>
        <div className="stat-mini money"><b>₦{parseFloat(teamData.stats.totalDeposits).toLocaleString()}</b><span>TEAM DEPOSITS</span></div>
      </div>

      {/* INVITATION CARD */}
      <div className="invite-card">
        <label>YOUR INVITATION CODE</label>
        <div className="code-display">
          <h2>{teamData.referralCode}</h2>
          <button className="btn-copy-sm" onClick={() => navigator.clipboard.writeText(teamData.referralCode)}>Copy code</button>
        </div>
        
        <div className="link-box">
          <input type="text" readOnly value={teamData.inviteLink} />
          <button className={`btn-copy-link ${copied ? 'success' : ''}`} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* VIP PROGRESS */}
      <div className="vip-progress-card">
        <div className="vip-header">
          <span className="diamond-icon">💎</span>
          <h3>VIP Level {teamData.currentVipLevel}</h3>
        </div>
        <p className="vip-desc">{teamData.nextTierRequirement}</p>
        
        <div className="progress-bar-container">
          <div className="progress-fill" style={{ width: `${teamData.progressPercent}%` }}></div>
        </div>
        
        <div className="tier-chips">
          <span className="chip inactive">&gt;VIP 1 · 3 activated</span>
          <span className="chip inactive">&gt;VIP 2 · 5 activated</span>
          <span className="chip inactive">&gt;VIP 3 · 10 activated</span>
        </div>
      </div>

    </AppLayout>
  );
}
