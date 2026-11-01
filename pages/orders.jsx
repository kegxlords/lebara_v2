import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

// Helper: Format seconds into HH:MM:SS
function formatTimeLeft(seconds) {
  if (seconds <= 0) return 'Ready Now';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'
  const [, setTick] = useState(0); // Forces re-render every second for timers

  // Fetch Data on Load
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders');
        if (!res.ok) throw new Error('Failed to load orders');
        const data = await res.json();
        
        // Sort: Active first, then Completed. Newest first within groups.
        const sorted = data.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return new Date(b.purchased_at) - new Date(a.purchased_at);
        });
        
        setOrders(sorted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Live Ticker Loop (Updates UI every 1 second)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return o.status === 'active';
    if (filter === 'completed') return o.status === 'completed';
    return true;
  });

  return (
    <AppLayout title="My Investments">
      
      {/* FILTER TABS */}
      <div className="tabs">
        <button className={`tab-btn ${filter==='all'?'on':''}`} onClick={()=>setFilter('all')}>All</button>
        <button className={`tab-btn ${filter==='active'?'on':''}`} onClick={()=>setFilter('active')}>Active</button>
        <button className={`tab-btn ${filter==='completed'?'on':''}`} onClick={()=>setFilter('completed')}>Completed</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading orders...</div>
      ) : (
        <div className="list-container" style={{ marginTop: '16px', background: 'transparent', border: 'none' }}>
          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              No orders found.<br/>
              <Link href="/packages" className="btn-primary" style={{marginTop:'10px', display:'inline-block'}}>Browse Packages</Link>
            </div>
          ) : (
            filteredOrders.map(order => {
              // --- COUNTDOWN LOGIC ---
              // Next Drop = Purchase Time + ((Days Collected + 1) * 24 Hours)
              const purchaseMs = new Date(order.purchased_at).getTime();
              const nextDropMs = purchaseMs + ((order.days_collected + 1) * 24 * 60 * 60 * 1000);
              const nowMs = Date.now();
              const diffSecs = Math.floor((nextDropMs - nowMs) / 1000);
              
              const isComplete = order.status === 'completed';
              const progressPct = order.days > 0 ? Math.min(100, (order.days_collected / order.days) * 100) : 0;

              return (
                <div key={order.id} className="order-card" style={{ marginBottom: '16px' }}>
                  
                  {/* HEADER */}
                  <div className="order-head">
                    <div className="order-avatar">
                      {order.image_url ? <img src={order.image_url} alt="" /> : order.name.charAt(0)}
                    </div>
                    <div className="order-info">
                      <b>{order.name}</b>
                      <span>Purchased {new Date(order.purchased_at).toLocaleDateString()} at {new Date(order.purchased_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} WAT</span>
                    </div>
                    <span className={`status-chip ${isComplete ? 'chip-done' : 'chip-active'}`}>
                      {isComplete ? 'COMPLETED' : 'ACTIVE'}
                    </span>
                  </div>
                  
                  {/* BODY */}
                  <div className="order-body">
                    <div className="fig-row"><span>Invested</span><b>₦{parseFloat(order.price_paid).toLocaleString()}</b></div>
                    <div className="fig-row"><span>Daily Yield</span><b className="gold">₦{parseFloat(order.daily_income).toLocaleString()}</b></div>
                    <div className="fig-row"><span>Earned So Far</span><b className="gold">₦{parseFloat(order.total_collected).toLocaleString()}</b></div>
                    
                    {/* TIMER SECTION */}
                    {!isComplete && (
                      <div className="timer-row">
                        <span className="timer-label">NEXT INCOME DROP IN</span>
                        <span className="timer-val">
                          {formatTimeLeft(diffSecs)}
                        </span>
                      </div>
                    )}
                    
                    {/* PROGRESS BAR */}
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                    </div>
                    <div className="fig-row" style={{ fontSize: '11px', marginTop: '4px' }}>
                      <span>Cycle Progress</span>
                      <em>{order.days_collected}/{order.days} Days</em>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </AppLayout>
  );
}
