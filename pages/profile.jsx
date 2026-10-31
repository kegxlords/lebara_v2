import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Bank Form State
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankData, setBankData] = useState({ bankCode: '', accountNumber: '', accountName: '' });
  const [bankError, setBankError] = useState('');

  // PIN Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [isSettingNew, setIsSettingNew] = useState(false); // True if user has no PIN yet
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch User Info
        const resUser = await fetch('/api/auth/me');
        if (!resUser.ok) throw new Error('Not authenticated');
        const dataUser = await resUser.json();
        setUser(dataUser.user);
        setIsSettingNew(!dataUser.user.has_pin);

        // Fetch Banks
        const resBanks = await fetch('/api/user/banks');
        if (resBanks.ok) {
          setBanks(await resBanks.json());
        }
      } catch (err) {
        console.error(err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  // --- Bank Handlers ---
  const handleAddBank = async (e) => {
    e.preventDefault();
    setBankError('');
    try {
      const res = await fetch('/api/user/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setBanks([...banks, data]);
      setShowBankForm(false);
      setBankData({ bankCode: '', accountNumber: '', accountName: '' });
    } catch (err) {
      setBankError(err.message);
    }
  };

  const handleDeleteBank = async (id) => {
    if (!confirm('Remove this bank account?')) return;
    await fetch(`/api/user/banks?id=${id}`, { method: 'DELETE' });
    setBanks(banks.filter(b => b.id !== id));
  };

  // --- PIN Handlers ---
  const handleSavePin = async () => {
    setPinError('');
    if (pinInput.length < 4 || pinInput.length > 6) return setPinError('PIN must be 4-6 digits');
    
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin: pinInput, 
          currentPin: isSettingNew ? null : currentPin 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('PIN saved successfully!');
      setShowPinModal(false);
      setPinInput('');
      setCurrentPin('');
      setUser({ ...user, has_pin: true });
    } catch (err) {
      setPinError(err.message);
    }
  };

  if (loading) return <AppLayout>Loading...</AppLayout>;

  return (
    <AppLayout title="My Profile">
      {/* USER INFO CARD */}
      <div className="card-form" style={{ marginBottom: '20px' }}>
        <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: '16px' }}>
          <div className="avatar-lg" style={{ width: '50px', height: '50px', fontSize: '20px' }}>
            {user.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{user.full_name}</h3>
            <small className="muted">{user.phone}</small>
          </div>
        </div>
        
        <div className="fig-row"><span>Referral Code</span><b>{user.referral_code}</b></div>
        <div className="fig-row"><span>Joined</span><b>{new Date(user.created_at).toLocaleDateString()}</b></div>
      </div>

      {/* SECURITY SECTION */}
      <div className="section-title">Security</div>
      <div className="list-container" style={{ marginBottom: '20px' }}>
        <div className="list-item" onClick={() => setShowPinModal(true)} style={{ cursor: 'pointer' }}>
          <div>
            <strong>Withdrawal PIN</strong>
            <small className="block muted">Required for all payouts</small>
          </div>
          <span className={user.has_pin ? 'amt-pos' : 'amt-neg'}>
            {user.has_pin ? '✓ Set' : '✗ Not Set'}
          </span>
        </div>
        <div className="list-item" onClick={() => router.push('/change-password')} style={{ cursor: 'pointer' }}>
          <div>
            <strong>Login Password</strong>
            <small className="block muted">Change your login password</small>
          </div>
          <span>›</span>
        </div>
      </div>

      {/* BANK ACCOUNTS SECTION */}
      <div className="section-title flex justify-between">
        <span>Saved Banks</span>
        <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => setShowBankForm(!showBankForm)}>
          + Add Bank
        </button>
      </div>

      {showBankForm && (
        <div className="card-form" style={{ marginBottom: '16px', border: '1px solid var(--lb-pink)' }}>
          <h4>Add New Bank Account</h4>
          {bankError && <div className="msg error">{bankError}</div>}
          <form onSubmit={handleAddBank}>
            <div className="field">
              <label>Select Bank</label>
              <select 
                className="input-large select-bank" 
                value={bankData.bankCode} 
                onChange={(e) => setBankData({...bankData, bankCode: e.target.value})}
                required
              >
                <option value="">Choose a bank...</option>
                {/* In real app, map NIGERIAN_BANKS array here */}
                <option value="80000009">GTBank</option>
                <option value="80000025">Zenith Bank</option>
                <option value="80000030">OPay</option>
              </select>
            </div>
            <div className="field">
              <label>Account Number</label>
              <input type="text" className="input-large" placeholder="10-digit number" 
                value={bankData.accountNumber} 
                onChange={(e) => setBankData({...bankData, accountNumber: e.target.value.replace(/\D/g,'')})}
                maxLength="11" required />
            </div>
            <div className="field">
              <label>Account Name</label>
              <input type="text" className="input-large" placeholder="As on bank slip" 
                value={bankData.accountName} 
                onChange={(e) => setBankData({...bankData, accountName: e.target.value})}
                required />
            </div>
            <button type="submit" className="btn-primary">Save Bank</button>
          </form>
        </div>
      )}

      <div className="list-container">
        {banks.length === 0 ? (
          <div className="empty-state">No banks saved yet.</div>
        ) : (
          banks.map(bank => (
            <div key={bank.id} className="list-item">
              <div>
                <strong>{bank.bank_name}</strong>
                <small className="block muted">{bank.account_number} • {bank.account_name}</small>
              </div>
              <button className="icon-btn" style={{ color: 'var(--lb-red)' }} onClick={() => handleDeleteBank(bank.id)}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* LOGOUT BUTTON */}
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button className="btn-danger" onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          router.push('/login');
        }}>Log Out</button>
      </div>

      {/* PIN MODAL */}
      {showPinModal && (
        <div className="pin-overlay">
          <div className="pin-modal">
            <h3>{isSettingNew ? 'Set Withdrawal PIN' : 'Change PIN'}</h3>
            {!isSettingNew && (
              <div className="field">
                <label>Current PIN</label>
                <input type="password" className="input-large" maxLength="6" 
                  value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g,''))} />
              </div>
            )}
            <div className="field">
              <label>New PIN (4-6 Digits)</label>
              <input type="password" className="input-large" maxLength="6" autoFocus
                value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g,''))} />
            </div>
            {pinError && <div className="msg error">{pinError}</div>}
            
            <div className="flex gap-2" style={{ marginTop: '16px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPinModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSavePin}>Save</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
