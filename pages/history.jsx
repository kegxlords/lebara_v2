import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

// Helper to format date nicely
function formatDate(dateString) {
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  const date = new Date(dateString);
  return `${date.toLocaleDateString('en-US', options)} ${date.toLocaleTimeString('en-US', timeOptions)}`;
}

// Map transaction types to display labels and colors
const TXN_CONFIG = {
  deposit: { label: 'Deposit', icon: '↓', colorClass: 'bg-green-100 text-green-700 border-green-200', amountClass: 'text-green-600' },
  income: { label: 'Daily Yield', icon: '↓', colorClass: 'bg-gold-100 text-gold-700 border-gold-200', amountClass: 'text-gold-600' },
  bonus: { label: 'Referral Bonus', icon: '↓', colorClass: 'bg-purple-100 text-purple-700 border-purple-200', amountClass: 'text-purple-600' },
  withdraw: { label: 'Withdrawal', icon: '↑', colorClass: 'bg-red-100 text-red-700 border-red-200', amountClass: 'text-red-600' },
  purchase: { label: 'Package Purchase', icon: '↑', colorClass: 'bg-orange-100 text-orange-700 border-orange-200', amountClass: 'text-orange-600' },
  adjust: { label: 'Balance Adjustment', icon: '↕', colorClass: 'bg-blue-100 text-blue-700 border-blue-200', amountClass: 'text-blue-600' },
};

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, credit, debit

  useEffect(() => {
    async function fetchHistory() {
      try {
        // Fetch from /api/auth which now includes recent txns 
        // OR create a specific /api/transactions if you added one.
        // Assuming /api/auth returns { ..., recentTxns: [...] }
        const res = await fetch('/api/auth');
        if (!res.ok) throw new Error('Failed to load history');
        
        const data = await res.json();
        
        // If your API only returns 5, you might want to increase that limit in the backend
        // For this frontend, we just render what comes back.
        const txns = data.recentTxns || [];
        setTransactions(txns);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const filteredTxns = transactions.filter(t => {
    if (filter === 'credit') return t.direction === 'credit';
    if (filter === 'debit') return t.direction === 'debit';
    return true;
  });

  return (
    <AppLayout title="Transaction History">
      
      {/* FILTER TABS */}
      <div className="tabs" style={{ marginBottom: '16px' }}>
        <button className={`tab-btn ${filter==='all'?'on':''}`} onClick={()=>setFilter('all')}>All</button>
        <button className={`tab-btn ${filter==='credit'?'on':''}`} onClick={()=>setFilter('credit')}>Credits</button>
        <button className={`tab-btn ${filter==='debit'?'on':''}`} onClick={()=>setFilter('debit')}>Debits</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading history...</div>
      ) : (
        <div className="list-container">
          {filteredTxns.length === 0 ? (
            <div className="empty-state">No transactions found.</div>
          ) : (
            filteredTxns.map((txn, index) => {
              const config = TXN_CONFIG[txn.type] || { label: txn.type.toUpperCase(), icon: '?', colorClass: 'bg-gray-100 text-gray-700 border-gray-200', amountClass: 'text-gray-600' };
              const isCredit = txn.direction === 'credit';
              
              return (
                <div key={txn.id || index} className="history-item">
                  {/* ICON BOX */}
                  <div className={`history-icon ${config.colorClass}`}>
                    {config.icon}
                  </div>

                  {/* DETAILS */}
                  <div className="history-details">
                    <h4>{config.label}</h4>
                    <p>{formatDate(txn.created_at)}</p>
                  </div>

                  {/* AMOUNT */}
                  <div className={`history-amount ${isCredit ? 'positive' : 'negative'}`}>
                    {isCredit ? '+' : '-'}₦{parseFloat(txn.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      
      <div style={{ height: '20px' }}></div>
    </AppLayout>
  );
}
