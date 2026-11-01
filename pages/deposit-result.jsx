import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DepositResult() {
  const router = useRouter();
  const { ref } = router.query;
  const [status, setStatus] = useState('checking'); // checking, success, failed
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!ref) return;
    
    // Poll API to check webhook status
    const interval = setInterval(async () => {
      const res = await fetch(`/api/deposit-status?ref=${ref}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'approved') {
          setStatus('success');
          setAmount(parseFloat(data.amount));
          clearInterval(interval);
        } else if (data.status === 'rejected') {
          setStatus('failed');
          clearInterval(interval);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ref]);

  return (
    <div className="result-page-bg">
      <div className="result-card">
        {status === 'checking' && (
          <>
            <div className="spinner-large"></div>
            <h2>Verifying Payment...</h2>
            <p>Please wait while we confirm your transaction.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="check-icon-big">✅</div>
            <h2>Payment Successful</h2>
            <div className="amount-highlight">₦{amount.toLocaleString()}</div>
            <p>Your recharge balance has been credited automatically. Commissions to your upline (if any) have also been settled.</p>
            
            <Link href="/dashboard" className="btn-primary-full">Continue to Dashboard</Link>
            
            <small className="ref-id">REF: {ref}</small>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="cross-icon-big">❌</div>
            <h2>Payment Failed</h2>
            <p>We could not verify this transaction. If funds were deducted, contact support.</p>
            <Link href="/profile" className="btn-outline-full">Contact Support</Link>
          </>
        )}
      </div>
    </div>
  );
}
