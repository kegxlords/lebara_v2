import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

export default function WithdrawPage() {
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Settings & Balance State
  const [settings, setSettings] = useState({ min: 1000, max: 1000000, fee: 0 });
  const [balance, setBalance] = useState(0);
  const [windowStatus, setWindowStatus] = useState({ isOpen: true, label: '' });

  useEffect(() => {
    async function initData() {
      try {
        // 1. Fetch Saved Banks
        const bankRes = await fetch('/api/user-settings?type=banks');
        if (bankRes.ok) {
          const data = await bankRes.json();
          setBanks(data);
          if (data.length > 0) setSelectedBankId(data[0].id);
        }

        // 2. Fetch User Stats (Balance)
        const authRes = await fetch('/api/auth');
        if (authRes.ok) {
          const data = await authRes.json();
          setBalance(parseFloat(data.wallet.income_balance || 0));
        }

        // 3. Fetch Platform Limits (Simulated via Admin API or hardcoded fallback)
        // In production, create an endpoint /api/settings/public
        const settingsRes = await fetch('/api/admin?section=settings_public'); 
        if(settingsRes.ok) {
           const sData = await settingsRes.json();
           setSettings({
             min: parseFloat(sData.wd_min_amount || 1000),
             max: parseFloat(sData.wd_max_amount || 1000000),
             fee: parseFloat(sData.withdrawal_fee_pct || 0)
           });
           
           // Check Window Status Client-Side for UX
           const start = sData.wd_hours_start || '08:00';
           const end = sData.wd_hours_end || '22:00';
           const now = new Date().toLocaleTimeString('en-NG', { hour12: false, timeZone: 'Africa/Lagos' }).slice(0,5);
           
           const isOpen = now >= start && now <= end;
           setWindowStatus({ isOpen, label: `${start} – ${end} WAT` });
        }

      } catch (err) {
        console.error(err);
      }
    }
    initData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // CLIENT SIDE VALIDATION FIRST
    const amtNum = parseFloat(amount);
    if (!amtNum || isNaN(amtNum)) return setError('Enter a valid amount');
    if (amtNum < settings.min) return setError(`Minimum withdrawal is ₦${settings.min.toLocaleString()}`);
    if (amtNum > settings.max) return setError(`Maximum withdrawal is ₦${settings.max.toLocaleString()}`);
    if (amtNum > balance) return setError('Insufficient balance');
    if (!selectedBankId) return setError('Select a bank account');
    if (!pin) return setError('Enter Withdrawal PIN');

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amtNum, 
          bankId: selectedBankId, 
          pin 
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      
      setSuccess(`Request submitted! Ref: ${data.ref}`);
      setAmount('');
      setPin('');
      // Refresh balance logic would go here
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Withdraw Funds">
      
      {/* ERROR/SUCCESS ALERTS */}
      {error && <div className="alert-error" style={{ margin: '16px' }}>{error}</div>}
      {success && <div className="msg success" style={{ margin: '16px' }}>{success}</div>}

      {/* BALANCE HERO */}
      <div className="form-hero">
        <div className="k">Available Balance</div>
        <div className="v">₦{balance.toLocaleString()}</div>
        <div className="s">
          Payout window: {windowStatus.label} · Now {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} WAT
        </div>
      </div>

      {/* STATUS NOTICE */}
      {!windowStatus.isOpen ? (
         <div className="notice closed" style={{ margin: '16px' }}>⏸ Withdrawals open {windowStatus.label}. Try again later.</div>
      ) : (
         <div className="notice open" style={{ margin: '16px' }}>✅ Payouts open. Transfers dispatch instantly.</div>
      )}

      {/* FORM */}
      <div className="card-form">
        <h3>New Withdrawal</h3>
        
        <form onSubmit={handleSubmit}>
          
          {/* AMOUNT INPUT */}
          <div className="field">
            <label className="label">Amount (₦)</label>
            <input 
              type="number" 
              step="0.01" 
              min={settings.min} 
              max={Math.min(balance, settings.max)}
              className="input-large" 
              placeholder="0.00" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              required 
            />
            
            {/* QUICK SELECT BUTTONS */}
            <div className="quick-select">
              <button type="button" className="q-btn" onClick={() => setAmount(settings.min)}>₦{settings.min.toLocaleString()}</button>
              <button type="button" className="q-btn" onClick={() => setAmount(5000)}>₦5,000</button>
              <button type="button" className="q-btn" onClick={() => setAmount(10000)}>₦10,000</button>
              <button type="button" className="q-btn" onClick={() => setAmount(Math.floor(balance))}>All</button>
            </div>
            <p className="help-text mt-2 text-center muted">Range: ₦{settings.min.toLocaleString()} – ₦{settings.max.toLocaleString()}</p>
          </div>

          {/* BANK SELECTOR */}
          <div className="field">
            <label className="label">Select Bank Account</label>
            {banks.length === 0 ? (
               <div className="notice-gate" style={{ padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                 No saved banks. <a href="/profile" className="underline">Add one in Profile</a>.
               </div>
            ) : (
              <select 
                className="input-large select-bank" 
                value={selectedBankId} 
                onChange={(e) => setSelectedBankId(e.target.value)}
                required
              >
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} • {b.account_number.slice(-4)} ({b.account_name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* PIN INPUT */}
          <div className="field">
            <label className="label">Withdrawal PIN</label>
            <input 
              type="password" 
              maxLength="6"
              className="input-large" 
              placeholder="••••" 
              value={pin} 
              onChange={(e) => setPin(e.target.value.replace(/\D/g,''))} 
              required 
            />
            <p className="secure-note">Required for security. Set in Profile Settings.</p>
          </div>
          
          <button type="submit" className="btn-primary-full" disabled={loading || banks.length === 0 || !windowStatus.isOpen}>
            {loading ? 'Processing...' : 'Request Withdrawal'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
