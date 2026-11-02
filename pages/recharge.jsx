import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function RechargePage() {
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [name, setName] = useState('Member');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth').then((res) => res.ok ? res.json() : null).then((data) => {
      if (!mounted || !data) return;
      setBalance(Number(data.wallet?.balance) || 0);
      setName(data.user?.full_name || 'Member');
    }).catch(() => {}).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const numericAmount = Number(amount) || 0;
  const serviceFee = 0;
  const total = numericAmount + serviceFee;
  const valid = numericAmount >= 1000;
  const formattedAmount = useMemo(() => numericAmount ? money(numericAmount) : '₦0.00', [numericAmount]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!valid) { setError('Minimum wallet funding amount is ₦1,000.'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: numericAmount }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to start secure payment');
      if (!data.url) throw new Error('Payment provider did not return a checkout link');
      window.location.href = data.url;
    } catch (err) { setError(err.message); setSubmitting(false); }
  }

  return <AppLayout title="Add funds">
    <section className="moneyflow-hero deposit-hero"><div className="moneyflow-icon">＋</div><div><span className="eyebrow">SECURE WALLET FUNDING</span><h1>Power your account</h1><p>Top up your Lebara wallet in a few simple steps.</p></div><span className="secure-badge">🔒 Secure</span></section>

    <section className="wallet-snapshot"><div><span>Current wallet balance</span><strong>{loading ? 'Loading…' : money(balance)}</strong></div><Link href="/history">View activity <span>›</span></Link></section>

    <form className="moneyflow-card" onSubmit={handleSubmit}>
      <div className="moneyflow-card-heading"><div><span className="eyebrow">STEP 1 OF 1</span><h2>Choose an amount</h2></div><span className="step-complete">Fast checkout</span></div>
      {error && <div className="moneyflow-alert error">{error}</div>}
      <label className="money-label" htmlFor="deposit-amount">How much would you like to add?</label>
      <div className={`money-input-wrap ${amount ? 'filled' : ''}`}><span>₦</span><input id="deposit-amount" type="number" inputMode="decimal" min="1000" step="50" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} required /><small>NGN</small></div>
      <div className="cost-summary"><div><span>Amount to wallet</span><b>{formattedAmount}</b></div><div><span>Processing fee</span><b className="green-text">Free</b></div><div className="summary-total"><span>Total payment</span><strong>{money(total)}</strong></div></div>
      <button className="moneyflow-primary" disabled={submitting || !valid}>{submitting ? 'Opening secure checkout…' : 'Continue to payment  →'}</button>
      <p className="moneyflow-footnote">You will be redirected to our encrypted payment partner. Never share your card PIN or OTP.</p>
    </form>
    <div className="moneyflow-help"><span>Need help?</span><Link href="/support">Contact customer service ›</Link></div>
  </AppLayout>;
}
