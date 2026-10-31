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
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    async function initData() {
      // Fetch Saved Banks
      const bankRes = await fetch('/api/user/banks');
      if (bankRes.ok) {
        const data = await bankRes.json();
        setBanks(data);
        if (data.length > 0) setSelectedBankId(data[0].id); // Default to first
      }
      
      // Fetch Balance
      const balRes = await fetch('/api/user/stats');
      if (balRes.ok) {
        const stats = await balRes.json();
        setBalance(parseFloat(stats.income || 0));
      }
    }
    initData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBankId) return setError('Select a bank account');
    if (!amount || parseFloat(amount) <= 0) return setError('Enter valid amount');
    if (!pin) return setError('Enter Withdrawal PIN');

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/gateway/payout-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: parseFloat(amount), 
          bankId: selectedBankId, 
          pin 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      
      setSuccess(`Request submitted! Ref: ${data.ref}`);
      setAmount('');
      setPin('');
      // Optionally refresh balance here
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Withdraw Funds">
      <div className="form-hero">
        <div className="k">Available Balance</div>
        <div className="v">₦{balance.toLocaleString()}</div>
      </div>

      {error && <div className="msg error" style={{ margin: '16px' }}>{error}</div>}
      {success && <div className="msg success" style={{ margin: '16px' }}>{success}</div>}

      <div className="card-form">
        <h3>New Withdrawal</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Select Bank Account</label>
            {banks.length === 0 ? (
              <div className="notice-gate" style={{ padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                No saved banks. <a href="/profile/settings" className="underline">Add one in Settings</a>.
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

          <div className="field">
            <label className="label">Amount (₦)</label>
            <input 
              type="number" 
              step="0.01" 
              min="1000" 
              max={balance}
              className="input-large" 
              placeholder="0.00" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              required 
            />
          </div>

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
          
          <button type="submit" className="btn-primary" disabled={loading || banks.length === 0}>
            {loading ? 'Processing...' : 'Request Withdrawal'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
