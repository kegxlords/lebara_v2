import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function WithdrawPage() {
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [balance, setBalance] = useState(0);
  const [settings, setSettings] = useState({ min: 1000, max: 1000000, fee: 0 });
  const [windowStatus, setWindowStatus] = useState({ isOpen: true, label: '08:00 – 22:00 WAT' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [bankRes, authRes, settingsRes] = await Promise.all([fetch('/api/user-settings?type=banks'), fetch('/api/auth'), fetch('/api/admin?section=settings_public')]);
        if (bankRes.ok) { const data = await bankRes.json(); if (mounted) { setBanks(data); setSelectedBankId(data[0]?.id || ''); } }
        if (authRes.ok) { const data = await authRes.json(); if (mounted) setBalance(Number(data.wallet?.income_balance) || 0); }
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          const next = { min: Number(data.wd_min_amount) || 1000, max: Number(data.wd_max_amount) || 1000000, fee: Number(data.withdrawal_fee_pct) || 0 };
          const start = data.wd_hours_start || '08:00'; const end = data.wd_hours_end || '22:00';
          const now = new Date().toLocaleTimeString('en-NG', { hour12: false, timeZone: 'Africa/Lagos' }).slice(0, 5);
          if (mounted) { setSettings(next); setWindowStatus({ isOpen: now >= start && now <= end, label: `${start} – ${end} WAT` }); }
        }
      } catch (err) { console.error(err); } finally { if (mounted) setLoading(false); }
    }
    init();
    return () => { mounted = false; };
  }, []);

  const numericAmount = Number(amount) || 0;
  const fee = Math.round((numericAmount * settings.fee / 100) * 100) / 100;
  const receive = Math.max(0, numericAmount - fee);
  const selectedBank = banks.find((bank) => String(bank.id) === String(selectedBankId));
  const valid = numericAmount >= settings.min && numericAmount <= settings.max && numericAmount <= balance && Boolean(selectedBankId) && pin.length >= 4 && windowStatus.isOpen;

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!selectedBankId) return setError('Add or select a bank account before requesting a payout.');
    if (numericAmount < settings.min) return setError(`Minimum withdrawal is ${money(settings.min)}.`);
    if (numericAmount > settings.max) return setError(`Maximum withdrawal is ${money(settings.max)}.`);
    if (numericAmount > balance) return setError('The requested amount is higher than your available income balance.');
    if (pin.length < 4) return setError('Enter your 4–6 digit withdrawal PIN.');
    if (!windowStatus.isOpen) return setError(`Withdrawals are available ${windowStatus.label}.`);
    setSubmitting(true);
    try {
      const res = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: numericAmount, bankId: selectedBankId, pin }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal could not be submitted');
      setSuccess(`Withdrawal submitted successfully. Reference: ${data.ref}`); setAmount(''); setPin('');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  return <AppLayout title="Withdraw">
    <section className="moneyflow-hero withdraw-hero"><div className="moneyflow-icon">↗</div><div><span className="eyebrow">SECURE PAYOUTS</span><h1>Move money home</h1><p>Withdraw your earned income directly to your bank.</p></div><span className={`secure-badge ${windowStatus.isOpen ? 'open' : 'closed'}`}>{windowStatus.isOpen ? '● Open' : '● Closed'}</span></section>
    <section className="withdraw-balance"><div><span>Available income</span><strong>{loading ? 'Loading…' : money(balance)}</strong></div><div className="balance-caption">Only earned income is withdrawable</div></section>
    <div className={`payout-status ${windowStatus.isOpen ? 'open' : 'closed'}`}><span>{windowStatus.isOpen ? '✓' : '◷'}</span><div><b>{windowStatus.isOpen ? 'Payouts are open' : 'Payout window is closed'}</b><small>{windowStatus.isOpen ? 'Requests are being processed now' : `Available daily from ${windowStatus.label}`}</small></div><strong>{windowStatus.label}</strong></div>
    <form className="moneyflow-card withdraw-form" onSubmit={handleSubmit}>
      <div className="moneyflow-card-heading"><div><span className="eyebrow">SECURE REQUEST</span><h2>Withdrawal details</h2></div><span className="step-complete">Protected</span></div>
      {error && <div className="moneyflow-alert error">{error}</div>}{success && <div className="moneyflow-alert success">{success}<Link href="/history">View transaction history ›</Link></div>}
      <label className="money-label" htmlFor="withdraw-amount">How much would you like to withdraw?</label>
      <div className={`money-input-wrap ${amount ? 'filled' : ''}`}><span>₦</span><input id="withdraw-amount" type="number" inputMode="decimal" min={settings.min} max={Math.min(settings.max, balance)} step="50" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} required /><small>NGN</small></div>
      <div className="amount-presets">{[settings.min, 5000, 10000, Math.floor(balance)].filter((value, index, array) => value >= settings.min && value <= balance && value > 0 && array.indexOf(value) === index).map((preset) => <button type="button" key={preset} className={numericAmount === preset ? 'selected' : ''} onClick={() => setAmount(String(preset))}>{preset === Math.floor(balance) ? 'All available' : money(preset)}</button>)}</div>
      <div className="money-label bank-label">Send to bank account <Link href="/profile">Manage banks</Link></div>
      {banks.length === 0 ? <div className="empty-bank"><span>＋</span><div><b>No bank account saved</b><small>Add a verified bank account in your profile settings.</small></div><Link href="/profile">Add bank ›</Link></div> : <div className="bank-list">{banks.map((bank) => <button type="button" key={bank.id} className={`bank-card ${String(selectedBankId) === String(bank.id) ? 'selected' : ''}`} onClick={() => setSelectedBankId(bank.id)}><span className="bank-emblem">₦</span><span><b>{bank.bank_name}</b><small>{bank.account_name} · •••• {bank.account_number.slice(-4)}</small></span><i>{String(selectedBankId) === String(bank.id) ? '✓' : ''}</i></button>)}</div>}
      <label className="money-label" htmlFor="withdraw-pin">Withdrawal PIN <Link href="/profile">Forgot or change PIN?</Link></label><div className="pin-input-wrap"><span>⌁</span><input id="withdraw-pin" type="password" inputMode="numeric" maxLength="6" placeholder="Enter 4–6 digit PIN" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} required /><small>••••</small></div>
      <div className="cost-summary withdrawal-summary"><div><span>Withdrawal amount</span><b>{money(numericAmount)}</b></div><div><span>Service fee {settings.fee ? `(${settings.fee}%)` : ''}</span><b>{settings.fee ? money(fee) : 'Free'}</b></div><div className="summary-total"><span>You receive</span><strong>{money(receive)}</strong></div></div>
      <button className="moneyflow-primary withdrawal-button" disabled={submitting || !valid}>{submitting ? 'Submitting secure request…' : 'Request withdrawal  →'}</button><p className="moneyflow-footnote">Your PIN is encrypted and never shared with the payment provider.</p>
    </form>
  </AppLayout>;
}
