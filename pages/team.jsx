import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function TeamPage() {
  const [data, setData] = useState(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/team').then((res) => res.ok ? res.json() : res.json().then((body) => Promise.reject(new Error(body.error || 'Unable to load team')))).then(setData).catch((err) => setError(err.message));
  }, []);

  const members = data?.members || [];
  const stats = data?.stats || {};
  const referralCode = data?.referralCode || '—';
  const referralLink = origin && data?.referralCode ? `${origin}/register?ref=${data.referralCode}` : '';
  const active = Number(stats.l1Active) || 0;
  const progress = Math.min(100, (active / 3) * 100);
  const copy = async (value, label) => { if (!value) return; try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(''), 1800); } catch { setError('Copy is not available on this browser.'); } };
  const joinedLabel = useMemo(() => (date) => date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently', []);

  if (error) return <AppLayout title="My Team"><div className="team-error"><b>Team data unavailable</b><span>{error}</span><button onClick={() => window.location.reload()}>Try again</button></div></AppLayout>;
  if (!data) return <AppLayout title="My Team"><div className="premium-inline-loader">Syncing your team data…</div></AppLayout>;

  return <AppLayout title="My Team">
    <section className="team-future-hero"><div className="team-orb">♧</div><div><span className="eyebrow">NETWORK COMMAND</span><h1>My team</h1><p>{data.userPhone || 'Your referral network'} · invite, grow, earn</p></div><button className="team-share-button" onClick={() => copy(referralLink, 'link')}>{copied === 'link' ? 'Copied' : 'Share'}</button></section>
    <section className="team-metrics"><div><b>{stats.l1Count || 0}</b><span>Direct members</span></div><div><b>{active}</b><span>Activated</span></div><div><b>{money(stats.totalComm)}</b><span>Commissions</span></div></section>
    <section className="team-invite-card"><div className="team-invite-top"><div><span className="eyebrow">YOUR INVITE CODE</span><strong>{referralCode}</strong></div><button onClick={() => copy(referralCode, 'code')}>{copied === 'code' ? 'Copied' : 'Copy code'}</button></div><div className="team-link-row"><input readOnly value={referralLink || 'Preparing invite link…'} /><button onClick={() => copy(referralLink, 'link')}>Copy link</button></div></section>
    <section className="team-progress-card"><div className="team-progress-copy"><div><span className="eyebrow">NEXT MILESTONE</span><h2>{active >= 3 ? 'VIP progress unlocked' : `${3 - active} more activation${3 - active === 1 ? '' : 's'} to VIP 1`}</h2></div><strong>{Math.round(progress)}%</strong></div><div className="team-progress-track"><span style={{ width: `${progress}%` }} /></div><small>Activated members unlock stronger earning potential.</small></section>
    <div className="team-section-heading"><div><span className="eyebrow">DIRECT NETWORK</span><h2>Your members</h2></div><span>{members.length} total</span></div>
    <section className="team-member-list">{members.length === 0 ? <div className="team-empty"><span>＋</span><b>Your team is ready to grow</b><small>Share your invite code to bring your first member into the network.</small></div> : members.map((member) => { const name = member.full_name || member.phone || 'Member'; return <article className="team-member-card" key={member.id}><div className="team-member-avatar">{name.charAt(0).toUpperCase()}</div><div className="team-member-main"><b>{name}</b><small>{member.phone || 'Lebara member'} · joined {joinedLabel(member.created_at)}</small></div><div className="team-member-side"><span className={member.activated_at ? 'active' : 'pending'}>{member.activated_at ? 'ACTIVE' : 'PENDING'}</span><small>{money(member.commission_earned)} earned</small></div></article>; })}</section>
  </AppLayout>;
}
