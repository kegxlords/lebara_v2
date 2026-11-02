import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const weekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWindowStatus(settings) {
  const start = settings.wd_hours_start || '00:00';
  const end = settings.wd_hours_end || '23:59';
  if (!settings.wd_schedule_enabled) return { isOpen: true, label: 'Open 24/7' };
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'short' }).format(new Date());
  const todayIndex = weekNames.indexOf(day);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const now = Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const toMinutes = (time) => { const [hours, minutes] = String(time).split(':').map(Number); return (hours || 0) * 60 + (minutes || 0); };
  const from = toMinutes(start); const until = toMinutes(end);
  const days = Array.isArray(settings.wd_days) ? settings.wd_days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
  const dayOpen = days.includes(todayIndex);
  const timeOpen = from <= until ? now >= from && now <= until : now >= from || now <= until;
  const dayLabel = days.map((item) => weekNames[item]).join(', ') || 'No days selected';
  return { isOpen: dayOpen && timeOpen, label: `${dayLabel} · ${start}–${end} WAT` };
}

export default function WithdrawPage() {
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [balance, setBalance] = useState(0);
  const [settings, setSettings] = useState({ min: 1000, max: 1000000, dailyLimit: 3, manual: false });
  const [windowStatus, setWindowStatus] = useState({ isOpen: true, label: 'Schedule loading' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [bankRes, authRes, settingsRes] = await Promise.all([
          fetch('/api/user-settings?type=banks'), fetch('/api/auth'), fetch('/api/public-settings', { cache: 'no-store' })
        ]);
        if (bankRes.ok) { const data = await bankRes.json(); if (mounted) { setBanks(data); setSelectedBankId(data[0]?.id || ''); } }
        if (authRes.ok) { const data = await authRes.json(); if (mounted) setBalance(Number(data.wallet?.income_balance) || 0); }
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          const parsedMin = Number(data.wd_min_amount);
          const parsedMax = Number(data.wd_max_amount);
          const next = {
            min: Number.isFinite(parsedMin) ? parsedMin : 1000,
            max: Number.isFinite(parsedMax) ? parsedMax : 1000000,
            dailyLimit: Math.max(1, Math.min(100, Number(data.wd_daily_limit) || 3)),
            manual: data.withdrawal_mode === 'manual'
          };
          if (mounted) { setSettings(next); setWindowStatus(getWindowStatus(data)); }
        }
      } catch (err) { console.error(err); } finally { if (mounted) setLoading(false); }
    }
    init();
    return () => { mounted = false; };
  }, []);

  const numericAmount = Number(amount) || 0;
  const selectedBank = banks.find((bank) => String(bank.id) === String(selectedBankId));
  const validDecimals = Math.abs(numericAmount * 100 - Math.round(numericAmount * 100)) < 0.000001;
  const valid = numericAmount > 0 && numericAmount >= settings.min && (settings.max <= 0 || numericAmount <= settings.max) && numericAmount <= balance && validDecimals && Boolean(selectedBankId) && pin.length >= 4 && windowStatus.isOpen;

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!selectedBankId) return setError('Add or select a bank account before requesting a payout.');
    if (numericAmount < settings.min) return setError(`Minimum withdrawal is ${money(settings.min)}.`);
    if (settings.max > 0 && numericAmount > settings.max) return setError(`Maximum withdrawal is ${money(settings.max)}.`);
    if (numericAmount > balance) return setError('The requested amount is higher than your available income balance.');
    if (!validDecimals) return setError('Enter an amount with up to two decimal places.');
    if (pin.length < 4) return setError('Enter your 4–6 digit withdrawal PIN.');
    if (!windowStatus.isOpen) return setError(`Withdrawals are available ${windowStatus.label}.`);
    setSubmitting(true);
    try {
      const res = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: numericAmount, bankId: selectedBankId, pin }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal could not be submitted');
      setSuccess(`${data.message || (settings.manual ? 'Request submitted for administrator approval.' : 'Withdrawal submitted to the payout gateway.')}${data.ref ? ` Reference: ${data.ref}` : ''}`);
      setAmount(''); setPin('');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  return <AppLayout title="Withdraw">
    <section className="moneyflow-hero withdraw-hero"><div className="moneyflow-icon">↗</div><div><span className="eyebrow">SECURE PAYOUTS</span><h1>Move money home</h1><p>Withdraw your earned income directly to your bank.</p></div><span className={`secure-badge ${windowStatus.isOpen ? 'open' : 'closed'}`}>{windowStatus.isOpen ? 'Open' : 'Closed'}</span></section>
    <section className="withdraw-balance"><div><span>Available income</span><strong>{loading ? 'Loading…' : money(balance)}</strong></div><div className="balance-caption">Only earned income is withdrawable</div></section>
    <div className={`payout-status ${windowStatus.isOpen ? 'open' : 'closed'}`}><span>{windowStatus.isOpen ? '✓' : '◷'}</span><div><b>{windowStatus.isOpen ? 'Payouts are open' : 'Payout window is closed'}</b><small>{windowStatus.isOpen ? `${settings.manual ? 'Requests wait for administrator approval. ' : 'Requests are sent to the payout gateway. '}Up to ${settings.dailyLimit} withdrawal${settings.dailyLimit === 1 ? '' : 's'} per day.` : 'Available during the configured schedule'}</small></div><strong>{windowStatus.label}</strong></div>
    <form className="moneyflow-card withdraw-form" onSubmit={handleSubmit}>
      <div className="moneyflow-card-heading"><div><span className="eyebrow">SECURE REQUEST</span><h2>Withdrawal details</h2></div><span className="step-complete">Protected</span></div>
      {error && <div className="moneyflow-alert error">{error}</div>}{success && <div className="moneyflow-alert success">{success}<Link href="/history">View transaction history ›</Link></div>}
      <label className="money-label" htmlFor="withdraw-amount">How much would you like to withdraw?</label>
      <div className={`money-input-wrap ${amount ? 'filled' : ''}`}><span>₦</span><input id="withdraw-amount" type="number" inputMode="decimal" min={settings.min} max={settings.max > 0 ? Math.min(settings.max, balance) : balance} step="0.01" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} required /><small>NGN</small></div>
      <small className="moneyflow-footnote">Minimum {money(settings.min)} · {settings.max > 0 ? `Maximum ${money(settings.max)}` : 'No maximum'}</small>
      <div className="amount-presets">{[settings.min, 5000, 10000, Math.floor(balance)].filter((value, index, array) => value >= settings.min && value <= balance && (settings.max <= 0 || value <= settings.max) && value > 0 && array.indexOf(value) === index).map((preset) => <button type="button" key={preset} className={numericAmount === preset ? 'selected' : ''} onClick={() => setAmount(String(preset))}>{preset === Math.floor(balance) ? 'All available' : money(preset)}</button>)}</div>
      <div className="money-label bank-label">Send to bank account <Link href="/bank-cards">Manage banks</Link></div>
      {banks.length === 0 ? <div className="empty-bank"><span>＋</span><div><b>No bank account saved</b><small>Add a verified bank account in your profile settings.</small></div><Link href="/bank-cards">Add bank ›</Link></div> : <div className="bank-list">{banks.map((bank) => <button type="button" key={bank.id} className={`bank-card ${String(selectedBankId) === String(bank.id) ? 'selected' : ''}`} onClick={() => setSelectedBankId(bank.id)}><span className="bank-emblem">₦</span><span><b>{bank.bank_name}</b><small>{bank.account_name} · •••• {bank.account_number.slice(-4)}</small></span><i>{String(selectedBankId) === String(bank.id) ? '✓' : ''}</i></button>)}</div>}
      <label className="money-label" htmlFor="withdraw-pin">Withdrawal PIN <Link href="/withdrawal-password">Forgot or change PIN?</Link></label><div className="pin-input-wrap"><span>⌁</span><input id="withdraw-pin" type="password" inputMode="numeric" maxLength="6" placeholder="Enter 4–6 digit PIN" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} required /><small>••••</small></div>
      <button className="moneyflow-primary withdrawal-button" disabled={submitting || !valid}>{submitting ? 'Submitting secure request…' : settings.manual ? 'Request admin approval  →' : 'Request withdrawal  →'}</button><p className="moneyflow-footnote">Your PIN is encrypted and never shared with the payment provider.</p>
    </form>
  </AppLayout>;
}
