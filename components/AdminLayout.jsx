import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin via API or local storage flag
    // For simplicity, we assume /api/admin/check returns { isAdmin: true/false }
    fetch('/api/admin/check')
      .then(res => res.json())
      .then(data => {
        if (!data.isAdmin) {
          alert('Access Denied');
          router.push('/dashboard');
        } else {
          setIsAdmin(true);
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="admin-body" style={{ padding: '20px' }}>Verifying access...</div>;
  if (!isAdmin) return null;

  const links = [
    { href: '/admin', label: 'Overview', icon: '📊' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/deposits', label: 'Deposits', icon: '💰' },
    { href: '/admin/withdrawals', label: 'Withdrawals', icon: '🏦' },
    { href: '/admin/packages', label: 'Packages', icon: '📦' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="admin-body">
      {/* TOP BAR */}
      <header className="top-bar" style={{ background: '#1e293b' }}>
        <Link href="/admin" className="brand" style={{ color: '#fff' }}>LEBARA <span style={{ color: '#ef4444' }}>Admin</span></Link>
        <button className="icon-btn" onClick={() => router.push('/dashboard')}>Exit</button>
      </header>

      {/* TAB NAVIGATION */}
      <nav className="admin-nav-tabs">
        {links.map(link => (
          <Link key={link.href} href={link.href} className={`admin-tab ${router.pathname === link.href ? 'active' : ''}`}>
            {link.icon} {link.label}
          </Link>
        ))}
      </nav>

      {/* MAIN CONTENT */}
      <main className="content-area" style={{ paddingBottom: '40px' }}>
        {title && <h2 className="page-title" style={{ color: '#fff' }}>{title}</h2>}
        {children}
      </main>
    </div>
  );
}
