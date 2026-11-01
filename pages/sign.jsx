import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

// Helper to generate last 7 days labels
function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue...
      dayNum: d.getDate()
    });
  }
  return days;
}

export default function SignInPage() {
  const [loading, setLoading] = useState(true);
  const [signedInToday, setSignedInToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]); // Array of dates signed in
  
  // Generate calendar grid
  const weekDays = getLast7Days();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      // In a real app, fetch stats from /api/auth or a dedicated endpoint
      // For this demo, we simulate checking local storage or API response structure
      // Assuming /api/auth returns { stats: { signStreak: X, lastSignDate: Y } }
      
      const res = await fetch('/api/auth');
      if(res.ok) {
         const data = await res.json();
         // Mock logic: If API doesn't return streak yet, fallback to local storage for UI feel
         const storedStreak = parseInt(localStorage.getItem('lebara_sign_streak') || '0');
         const storedLastDate = localStorage.getItem('lebara_sign_date');
         
         const todayStr = new Date().toDateString();
         const isSigned = storedLastDate === todayStr;
         
         setSignedInToday(isSigned);
         setStreak(storedStreak);
         
         // Simulate history based on streak for visual effect
         const histDates = [];
         let curr = new Date();
         for(let i=0; i<storedStreak; i++) {
             histDates.unshift(curr.toISOString().split('T')[0]);
             curr.setDate(curr.getDate()-1);
         }
         setHistory(histDates);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (signedInToday) return;

    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'daily-sign' })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      // Success
      const todayStr = new Date().toDateString();
      const newStreak = streak + 1;
      
      // Save to LocalStorage for instant UI feedback (Real persistence is in DB)
      localStorage.setItem('lebara_sign_streak', newStreak.toString());
      localStorage.setItem('lebara_sign_date', todayStr);
      
      setStreak(newStreak);
      setSignedInToday(true);
      setMessage(`🎉 Bonus Claimed! +₦50 added to wallet.`);
      
      // Refresh history array
      const newHist = [...history, new Date().toISOString().split('T')[0]];
      setHistory(newHist.slice(-7)); // Keep last 7

    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Daily Check-in">
      
      {/* HERO CARD */}
      <div className="signin-hero-card">
        <div className="hero-icon">🔥</div>
        <h2>Daily Rewards</h2>
        <p>Sign in every day to build your streak and earn bonuses.</p>
        
        <div className="streak-display">
          <span className="streak-num">{streak}</span>
          <span className="streak-label">Day Streak</span>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="calendar-container">
        <h3>This Week</h3>
        <div className="week-grid">
          {weekDays.map((day, idx) => {
            const isPastOrToday = day.date <= new Date().toISOString().split('T')[0];
            const hasCheckedIn = history.includes(day.date);
            const isToday = day.date === new Date().toISOString().split('T')[0];
            
            let circleClass = 'cal-circle empty';
            if (hasCheckedIn) circleClass = 'cal-circle filled';
            else if (isToday && !signedInToday) circleClass = 'cal-circle active-pulse';
            else if (isToday && signedInToday) circleClass = 'cal-circle filled';

            return (
              <div key={idx} className="cal-item">
                <span className="cal-day-name">{day.label}</span>
                <div className={circleClass}>
                  {hasCheckedIn ? '✓' : day.dayNum}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTION AREA */}
      <div className="action-area">
        {message && (
          <div className={`msg-box ${message.includes('Bonus') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <button 
          className={`btn-signin-main ${signedInToday ? 'disabled' : ''}`}
          onClick={handleSignIn}
          disabled={signedInToday || loading}
        >
          {loading ? 'Processing...' : (signedInToday ? '✓ Signed In Today' : 'Claim Daily Bonus')}
        </button>
        
        {!signedInToday && (
           <p className="hint-text">Come back tomorrow for another chance!</p>
        )}
      </div>

    </AppLayout>
  );
}
