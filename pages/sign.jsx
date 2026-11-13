import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';

const STORAGE_KEY = 'lebara_daily_reward_v2';
const rewardForDay = () => 50;
const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000);

function readRewardState() {
  if (typeof window === 'undefined') return { streak: 0, lastDate: '', completed: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const state = { streak: Number(saved.streak) || 0, lastDate: saved.lastDate || '', completed: Array.isArray(saved.completed) ? saved.completed : [] };
    const gap = state.lastDate ? daysBetween(state.lastDate, dateKey()) : 0;
    if (gap > 1) return { streak: 0, lastDate: '', completed: [] };
    return state;
  } catch { return { streak: 0, lastDate: '', completed: [] }; }
}

export default function SignInPage() {
  const [state, setState] = useState({ streak: 0, lastDate: '', completed: [] });
  const [ready, setReady] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setState(readRewardState()); setReady(true); }, []);
  const signedToday = state.lastDate === dateKey();
  const currentDay = state.streak >= 30 ? 30 : Math.max(1, state.streak + (signedToday ? 0 : 1));
  const monthProgress = Math.min(100, (state.streak / 30) * 100);
  const calendar = useMemo(() => Array.from({ length: 30 }, (_, index) => index + 1), []);

  async function handleClaim() {
    if (!ready || claiming || signedToday || state.streak >= 30) return;
    const day = currentDay;
    setClaiming(true); setMessage('');
    try {
      const res = await fetch('/api/user-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'daily-sign', day }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not claim today’s reward');
      const next = { streak: day, lastDate: dateKey(), completed: [...new Set([...state.completed, day])] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setState(next);
      setMessage(`Reward claimed: ₦${Number(data.amount || rewardForDay(day)).toLocaleString()} added to your income balance.`);
    } catch (error) { setMessage(error.message); } finally { setClaiming(false); }
  }

  return <AppLayout title="Daily rewards">
    <section className="signin-premium-hero"><div className="reward-icon">✦</div><div><span className="eyebrow">CONSISTENCY PAYS</span><h1>Daily rewards</h1><p>Show up every day and unlock bigger bonuses.</p></div><div className="streak-pill"><b>{state.streak}</b><span>day streak</span></div></section>
    <section className="reward-rules"><div><b>₦50</b><span>Every daily check-in</span></div><div><b>30 days</b><span>Maximum streak</span></div></section>
    <section className="calendar-card"><div className="calendar-heading"><div><span className="eyebrow">30-DAY JOURNEY</span><h2>Complete your month</h2></div><strong>{state.streak}/30</strong></div><div className="calendar-progress"><span style={{ width: `${monthProgress}%` }} /></div><div className="reward-calendar">{calendar.map((day) => { const complete = state.completed.includes(day); const active = day === currentDay && !signedToday; return <div key={day} className={`reward-day ${complete ? 'complete' : ''} ${active ? 'active' : ''}`}><span>DAY</span><b>{day}</b><small>{complete ? '✓' : `₦${rewardForDay(day)}`}</small></div>; })}</div></section>
    {message && <div className={`reward-message ${message.startsWith('Reward') ? 'success' : 'error'}`}>{message}</div>}
    <button className="premium-claim-button" onClick={handleClaim} disabled={!ready || claiming || signedToday || state.streak >= 30}>{claiming ? 'Securing your reward…' : signedToday ? '✓ Claimed today' : state.streak >= 30 ? '30-day journey complete' : `Claim day ${currentDay} · ₦${rewardForDay(currentDay)}`}</button>
    {!signedToday && state.streak > 0 && <p className="reward-hint">Miss one day and your 30-day journey resets. Come back tomorrow to keep your streak alive.</p>}
  </AppLayout>;
}
