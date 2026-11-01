import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

export default function TeamPage() {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      // Assuming /api/team returns structured L1/L2 data
      const res = await fetch('/api/team');
      if (res.ok) {
        setTeamData(await res.json());
      }
      setLoading(false);
    }
    fetchTeam();
  }, []);

  if (loading) return <AppLayout>Loading...</AppLayout>;
  if (!teamData) return <AppLayout>Error loading team.</AppLayout>;

  const { l1Members, l2Members, stats } = teamData;

  return (
    <AppLayout title="My Team">
      
      {/* COMMISSION EARNINGS SUMMARY */}
      <div className="card-form" style={{ marginBottom: '20px' }}>
        <h3>Your commission earnings</h3>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: '10px 0' }}>
          <div className="stat-card gold" style={{ padding: '10px' }}>
            <span className="value" style={{ fontSize: '16px' }}>₦{(stats.l1Commission || 0).toLocaleString()}</span>
            <span className="label" style={{ fontSize: '9px' }}>FROM LEVEL 1</span>
          </div>
          <div className="stat-card gold" style={{ padding: '10px' }}>
            <span className="value" style={{ fontSize: '16px' }}>₦{(stats.l2Commission || 0).toLocaleString()}</span>
            <span className="label" style={{ fontSize: '9px' }}>FROM LEVEL 2</span>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <span className="value" style={{ fontSize: '16px', color: '#1E7A46' }}>₦{(stats.totalCommission || 0).toLocaleString()}</span>
            <span className="label" style={{ fontSize: '9px' }}>TOTAL EARNED</span>
          </div>
        </div>
      </div>

      {/* LEVEL 1 REFERRALS SECTION */}
      <div className="section-header flex justify-between items-center" style={{ margin: '20px 16px 10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#123A8F' }}>Level 1 referrals</h3>
        <span className="badge-pill yellow">{stats.l1Rate || 20}% commission</span>
      </div>

      <div className="list-container" style={{ margin: '0 16px' }}>
        {l1Members && l1Members.length > 0 ? (
          l1Members.map(member => (
            <div key={member.id} className="referral-card-item">
              <div className="ref-head">
                <div className="avatar-sm purple">{member.name.charAt(0)}</div>
                <div className="ref-info">
                  <b>{member.name}</b>
                  <small className="block muted">joined {new Date(member.joined).toLocaleDateString()} · activated {member.isActive ? new Date(member.activatedAt).toLocaleDateString() : '-'}</small>
                </div>
                <span className={`status-chip ${member.isActive ? 'green' : 'gray'}`}>
                  {member.isActive ? 'ACTIVE' : 'PENDING'}
                </span>
              </div>
              
              <div className="ref-stats-grid">
                <div className="ref-stat">
                  <b>{member.depositCount}</b>
                  <span>DEPOSITS</span>
                </div>
                <div className="ref-stat">
                  <b className="gold">₦{member.totalDeposited.toLocaleString()}</b>
                  <span>TOTAL DEPOSITED</span>
                </div>
                <div className="ref-stat">
                  <b>₦{member.investedAmount.toLocaleString()}</b>
                  <span>INVESTED</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No Level 1 referrals yet.</div>
        )}
      </div>

      {/* LEVEL 2 REFERRALS SECTION */}
      <div className="section-header flex justify-between items-center" style={{ margin: '20px 16px 10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#123A8F' }}>Level 2 referrals</h3>
        <span className="badge-pill gray">{stats.l2Rate || 2}% commission</span>
      </div>

      <div className="list-container" style={{ margin: '0 16px' }}>
        {l2Members && l2Members.length > 0 ? (
          l2Members.map(member => (
            <div key={member.id} className="referral-card-item compact">
               <div className="ref-head">
                <div className="avatar-sm pink">{member.name.charAt(0)}</div>
                <div className="ref-info">
                  <b>{member.name}</b>
                  <small className="block muted">joined {new Date(member.joined).toLocaleDateString()}</small>
                </div>
                <span className={`status-chip ${member.isActive ? 'green' : 'orange'}`}>
                  {member.isActive ? 'ACTIVE' : 'PENDING'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No Level 2 referrals yet.</div>
        )}
      </div>

    </AppLayout>
  );
}
