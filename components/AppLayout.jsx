import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabasePublic } from '../lib/supabase'; // Use public client for simple reads if RLS allows, else fetch via API

export default function AppLayout({ children, title = "" }) {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch Balance on Load
  useEffect(() => {
    async function getBal() {
      try {
        // Call our Auth Me endpoint or direct Supabase read
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.wallet) setBalance(parseFloat(data.wallet.balance));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    getBal();
  }, [router]);

  const isActive = (path) => router.pathname === path ? 'active' : '';

  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <div className="app-shell">
      {/* TOP BAR */}
      <header className="top-bar">
        <Link href="/" className="brand">LEBARA</Link>
        <div className="wallet-pill">₦{balance.toLocaleString()}</div>
        <button className="icon-btn"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="content-area">
        {title && <h1 className="page-title">{title}</h1>}
        {children}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className={`nav-item ${isActive('/dashboard')}`}>
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Home</span>
        </Link>
        <Link href="/packages" className={`nav-item ${isActive('/packages')}`}>
          <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c-.11-.31-.27-.59-.48-.84l1.42-1.42-1.42-1.42-1.42 1.42c-.25-.21-.53-.37-.84-.48V2h-2v1.82c-.31.11-.59.27-.84.48L8.84 2.9 7.42 4.32l1.42 1.42c-.21.25-.37.53-.48.84H4v2h2.18c.11.31.27.59.48.84L5.24 11.4l1.42 1.42 1.42-1.42c.25.21.53.37.84.48V16h2v-2.18c.31-.11.59-.27.84-.48l1.42 1.42 1.42-1.42-1.42-1.42c.21-.25.37-.53.48-.84H20V6zm-8 4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
          <span>Package</span>
        </Link>
        <Link href="/orders" className={`nav-item ${isActive('/orders')}`}>
          <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
          <span>Order</span>
        </Link>
        <Link href="/team" className={`nav-item ${isActive('/team')}`}>
          <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <span>Team</span>
        </Link>
        <Link href="/profile" className={`nav-item ${isActive('/profile')}`}>
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span>My</span>
        </Link>
      </nav>
    </div>
  );
}
