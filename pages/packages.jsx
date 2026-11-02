import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function PackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('general');
  const [userStats, setUserStats] = useState({ activeRefs: 0, balance: 0 });

  useEffect(() => {
    if (router.isReady && router.query.vip === 'true') setTab('vip');
  }, [router.isReady, router.query.vip]);

  useEffect(() => {
    Promise.all([fetch('/api/packages'), fetch('/api/auth')])
      .then(async ([pkgRes, authRes]) => {
        if (!pkgRes.ok) throw new Error('Unable to load packages');
        const pkgs = await pkgRes.json();
        const auth = authRes.ok ? await authRes.json() : {};
        setPackages(Array.isArray(pkgs) ? pkgs : []);
        setUserStats({
          activeRefs: Number(auth.stats?.activeReferrals) || 0,
          balance: Number(auth.wallet?.balance) || 0
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = packages.filter((pkg) => (pkg.category || 'general').toLowerCase() === tab);

  return (
    <AppLayout title="">
      <section className="package-reference-page">
        <div className="package-reference-tabs" role="tablist" aria-label="Package category">
          <button type="button" role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>General</button>
          <button type="button" role="tab" aria-selected={tab === 'vip'} className={tab === 'vip' ? 'active' : ''} onClick={() => setTab('vip')}>VIP</button>
        </div>

        <h1 className="package-reference-heading">{tab === 'vip' ? 'Exclusive high-yield packages for activated teams' : 'Choose your preferred package'}</h1>

        {loading ? (
          <section className="package-reference-grid package-reference-loading" aria-label="Loading packages">
            <i /><i /><i /><i />
          </section>
        ) : error ? (
          <section className="package-empty package-reference-empty"><span>!</span><h2>Packages unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section>
        ) : filtered.length === 0 ? (
          <section className="package-empty package-reference-empty"><span>◫</span><h2>{tab === 'vip' ? 'VIP packages are coming soon' : 'No packages available'}</h2><p>Our team is preparing the next set of packages. Please check back shortly.</p><Link href="/support">Contact support →</Link></section>
        ) : (
          <section className="package-reference-grid">
            {filtered.map((pkg) => {
              const required = Number(pkg.vip_required_invites) || 0;
              const locked = Boolean(pkg.is_locked) || (tab === 'vip' && userStats.activeRefs < required);
              const affordable = userStats.balance >= Number(pkg.price);
              return (
                <article key={pkg.id} className={`package-reference-card ${locked ? 'locked' : ''}`}>
                  <div className="package-reference-image">
                    {pkg.image_url ? <img src={pkg.image_url} alt="" /> : <span>{tab === 'vip' ? 'VIP' : 'LEBARA'}</span>}
                    {tab === 'vip' && locked && <span className="package-reference-requirement">🔒 REQUIRES {required} REFERRALS</span>}
                  </div>
                  <div className="package-reference-body">
                    <h2><span>★</span>{pkg.name}</h2>
                    <dl>
                      <div><dt>Price:</dt><dd>{money(pkg.price)}</dd></div>
                      <div><dt>Term:</dt><dd>{pkg.days} days</dd></div>
                      <div><dt>Daily:</dt><dd>{money(pkg.daily_income)}</dd></div>
                      <div><dt>Total:</dt><dd>{money(pkg.total_income)}</dd></div>
                    </dl>
                    {locked ? (
                      <button type="button" className="package-reference-buy disabled" disabled>{pkg.is_locked ? 'Coming Soon' : `Need ${Math.max(0, required - userStats.activeRefs)} invite${required - userStats.activeRefs === 1 ? '' : 's'}`}</button>
                    ) : (
                      <Link href={`/order-detail?id=${pkg.id}`} className={`package-reference-buy ${affordable ? '' : 'fund'}`}>Buy Now</Link>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </AppLayout>
  );
}
