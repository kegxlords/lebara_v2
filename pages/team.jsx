import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

export default function TeamPage() {
  const [team, setTeam] = useState([]);
  const [stats, setStats] = useState({ l1Count: 0, l1Active: 0, totalComm: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      const res = await fetch('/api/user/team');
      if (res.ok) {
        const data = await res.json();
        setTeam(data.members);
        setStats(data.stats);
      }
      setLoading(false);
    }
    fetchTeam();
  }, []);

  return (
    <AppLayout title="My Team">
      {/* SUMMARY CARDS */}
      <div className="grid-cards">
        <div className="stat-card">
          <span className="label">Direct Referrals</span>
          <span className="value">{stats.l1Count}</span>
        </div>
        <div className="stat-card gold">
          <span className="label">Activated Members</span>
          <span className="value">{stats.l1Active}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total Commission</span>
          <span className="value">₦{stats.totalComm.toLocaleString()}</span>
        </div>
      </div>

      {/* INVITE LINK BOX */}
      <div className="card-form" style={{ marginBottom: '20px', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <h4 style={{ color: '#166534', marginBottom: '8px' }}>Share Your Link</h4>
        <p className="muted text-sm mb-2">Earn commission when they deposit!</p>
        <div className="input-group" style={{ background: '#fff', borderRadius: '8px', padding: '8px' }}>
           <code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
             https://lebara-ng.cyou/register?ref=YOUR_CODE
           </code>
           <button className="q-btn" style={{ marginLeft: '8px' }}>Copy</button>
        </div>
      </div>

      {/* MEMBERS LIST */}
      <div className="section-title">My Members (Level 1)</div>
      <div className="list-container">
        {loading ? <div className="empty-state">Loading team...</div> : (
          team.length === 0 ? (
            <div className="empty-state">You haven't referred anyone yet.<br/>Share your link above!</div>
          ) : (
            team.map(member => (
              <div key={member.id} className="list-item">
                <div>
                  <strong>{member.full_name || 'Member'}</strong>
                  <small className="block muted">{member.phone}</small>
                  <small className={`badge ${member.activated_at ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`} 
                         style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginTop: '4px', display: 'inline-block' }}>
                    {member.activated_at ? 'ACTIVE' : 'PENDING'}
                  </small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="amt-pos block">+₦{parseFloat(member.commission_earned || 0).toLocaleString()}</span>
                  <small className="muted">from deposits</small>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </AppLayout>
  );
}
