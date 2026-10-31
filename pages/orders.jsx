import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';

// Helper to format seconds into HH:MM:SS
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

  useEffect(() => {
    async function fetchOrders() {
      const res = await fetch('/api/orders/my-orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
      setLoading(false);
    }
    fetchOrders();
    
    // Refresh every minute to update statuses
    const interval = setInterval(fetchOrders, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return o.status === 'active';
    if (filter === 'completed') return o.status === 'completed';
    return true;
  });

  return (
    <AppLayout title="My Investments">
      <div className="tabs">
        <button className={`tab-btn ${filter==='all'?'on':''}`} onClick={()=>setFilter('all')}>All</button>
        <button className={`tab-btn ${filter==='active'?'on':''}`} onClick={()=>setFilter('active')}>Active</button>
        <button className={`tab-btn ${filter==='completed'?'on':''}`} onClick={()=>setFilter('completed')}>Completed</button>
      </div>

      {loading ? <div className="empty-state">Loading orders...</div> : (
        <div className="list-container" style={{ marginTop: '16px' }}>
          {filteredOrders.length === 0 ? (
            <div className="empty-state">No orders found.</div>
          ) : (
            filteredOrders.map(order => {
              // Calculate Next Drop Time based on purchased_at + (days_collected + 1) * 24h
              // Note: This assumes server sends accurate UTC timestamps or we adjust client-side
              const purchaseDate = new Date(order.purchased_at);
              const nextDropMs = purchaseDate.getTime() + ((order.days_collected + 1) * 24 * 60 * 60 * 1000);
              const nowMs = Date.now();
              const diffSecs = Math.floor((nextDropMs - nowMs) / 1000);
              
              const isComplete = order.status === 'completed';
              const progressPct = order.days > 0 ? Math.min(100, (order.days_collected / order.days) * 100) : 0;

              return (
                <div key={order.id} className="order-card" style={{ margin: '0 0 12px 0' }}>
                  <div className="order-head">
                    <div className="order-avatar">
                      {order.image_url ? <img src={order.image_url} alt="" /> : order.name.charAt(0)}
                    </div>
                    <div className="order-info">
                      <b>{order.name}</b>
                      <span>Purchased {purchaseDate.toLocaleDateString()}</span>
                    </div>
                    <span className={`status-chip ${isComplete ? 'chip-done' : 'chip-active'}`}>
                      {isComplete ? 'COMPLETED' : 'ACTIVE'}
                    </span>
                  </div>
                  
                  <div className="order-body">
                    <div className="fig-row"><span>Invested</span><b>₦{parseFloat(order.price_paid).toLocaleString()}</b></div>
                    <div className="fig-row"><span>Daily Yield</span><b className="gold">₦{parseFloat(order.daily_income).toLocaleString()}</b></div>
                    <div className="fig-row"><span>Earned So Far</span><b className="gold">₦{parseFloat(order.total_collected).toLocaleString()}</b></div>
                    
                    <div className="timer-row">
                      <span className="timer-label">Next Income Drop In</span>
                      <span className="timer-val">
                        {isComplete ? 'Cycle Complete' : formatTimeLeft(diffSecs)}
                      </span>
                    </div>
                    
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
