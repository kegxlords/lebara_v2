import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../components/AppLayout';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [pkg, setPkg] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/packages/detail?id=${id}`);
        if (!res.ok) throw new Error('Package not found');
        const data = await res.json();
        setPkg(data.pkg);
        setBalance(data.balance);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  const handleBuy = async () => {
    if (!confirm(`Confirm purchase of ${pkg.name} for ₦${parseFloat(pkg.price).toLocaleString()}?`)) return;
    
    setProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/packages/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Purchase failed');
      
      alert('Purchase successful! Check your Orders page.');
      router.push('/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <AppLayout>Loading...</AppLayout>;
  if (error && !pkg) return <AppLayout>Error: {error}</AppLayout>;

  const remaining = Math.max(0, balance - parseFloat(pkg?.price || 0));

  return (
    <AppLayout title="Confirm Purchase">
      {!pkg ? <div className="empty-state">Package not found.</div> : (
        <div className="card-form">
          <h3>{pkg.name}</h3>
          <div className="figs" style={{ marginBottom: '20px' }}>
            <div className="fig-row"><span>Investment Amount</span><b>₦{parseFloat(pkg.price).toLocaleString()}</b></div>
            <div className="fig-row"><span>Daily Yield</span><b className="gold">₦{parseFloat(pkg.daily_income).toLocaleString()}</b></div>
            <div className="fig-row"><span>Duration</span><b>{pkg.days} Days</b></div>
            <div className="fig-row"><span>Total Return</span><b className="gold">₦{parseFloat(pkg.total_income).toLocaleString()}</b></div>
          </div>

          <div className="summary-box" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <div className="fig-row"><span>Your Balance</span><b>₦{balance.toLocaleString()}</b></div>
            <div className="fig-row"><span>Cost</span><b>-₦{parseFloat(pkg.price).toLocaleString()}</b></div>
            <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
            <div className="fig-row"><span>Remaining After Buy</span><b>₦{remaining.toLocaleString()}</b></div>
          </div>

          {error && <div className="msg error">{error}</div>}

          <button 
            className="btn-primary" 
            onClick={handleBuy} 
            disabled={processing || balance < parseFloat(pkg.price)}
          >
            {processing ? 'Processing...' : balance < parseFloat(pkg.price) ? 'Insufficient Balance' : 'Confirm Purchase'}
          </button>
          
          {balance < parseFloat(pkg.price) && (
            <div className="text-center mt-2">
              <Link href="/recharge" className="muted text-sm underline">Top up wallet →</Link>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
