import { useState } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../components/AppLayout';

export default function RechargePage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return setError('Enter a valid amount');
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gateway/deposit-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payment');
      
      // Redirect to AfrStar Hosted Checkout
      window.location.href = data.url;
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Fund Wallet">
      <div className="form-hero">
        <div className="k">Current Balance</div>
        <div className="v">₦0.00</div> {/* Ideally fetched from API */}
      </div>

      <div className="card-form">
        <h3>Fund Your Wallet</h3>
        {error && <div className="msg error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Amount (₦)</label>
            <input 
              type="number" 
              step="0.01" 
              min="1000" 
              className="input-large" 
              placeholder="0.00" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              required 
            />
            <div className="quick-select">
              {[1000, 2000, 5000, 10000].map(q => (
                <button key={q} type="button" className="q-btn" onClick={() => setAmount(q)}>₦{q.toLocaleString()}</button>
              ))}
            </div>
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Redirecting...' : 'Continue to Secure Payment'}
          </button>
          <p className="secure-note">🔒 You'll complete payment on AfrStar's encrypted cashier.</p>
        </form>
      </div>
    </AppLayout>
  );
}
