import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { AppIcon, WhatsAppIcon } from '../components/Icons';

const fallbackBanners = [
  { image_url: '', href: '/packages', alt: 'Explore Lebara plans' },
  { image_url: '', href: '/recharge', alt: 'Add funds securely' },
  { image_url: '', href: '/team', alt: 'Grow your team' }
];
const actions = [
  { href: '/sign', label: 'Sign', icon: 'sparkle', tone: 'orange' },
  { href: '/team', label: 'My team', icon: 'team', tone: 'blue' },
  { href: '/recharge', label: 'Recharge', icon: 'recharge', tone: 'coral' },
  { href: '/withdraw', label: 'Withdraw', icon: 'withdraw', tone: 'purple' },
  { href: '/packages?vip=true', label: 'Packages', icon: 'packages', tone: 'orange' },
  { href: '/team', label: 'Invite', icon: 'team', tone: 'pink' },
  { href: '/download', label: 'Download', icon: 'download', tone: 'blue' },
  { href: '/support', label: 'WhatsApp', icon: 'whatsapp', tone: 'navy', external: true }
];

function money(value) { return `₦${Number(value || 0).toLocaleString()}`; }

export default function Dashboard() {
  const [account, setAccount] = useState(null);
  const [banners, setBanners] = useState(fallbackBanners);
  const [notifications, setNotifications] = useState([]);
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([fetch('/api/auth'), fetch('/api/public-settings')])
      .then(async ([authRes, contentRes]) => {
        if (!authRes.ok) throw new Error('Unable to load your account');
        const auth = await authRes.json();
        const content = contentRes.ok ? await contentRes.json() : {};
        if (mounted) {
          setAccount(auth);
          setBanners(Array.isArray(content.banners) && content.banners.length ? content.banners : fallbackBanners);
          setNotifications(Array.isArray(content.notifications) ? content.notifications : []);
          setWhatsappGroupUrl(content.whatsapp_group_url || '');
          setShowWelcome(true);
        }
      })
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = setInterval(() => setSlide((current) => (current + 1) % banners.length), 4500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const ticker = useMemo(() => notifications.length ? [...notifications, ...notifications] : [{ text: 'Welcome to Lebara', amount: 'Explore your rewards' }, { text: 'Daily rewards are available', amount: 'Claim today' }], [notifications]);
  const user = account?.user || {};
  const wallet = account?.wallet || {};

  if (loading) return <AppLayout><div className="premium-inline-loader">Loading your dashboard...</div></AppLayout>;
  if (error) return <AppLayout><div className="premium-error"><b>We could not load your account</b><span>{error}</span><button onClick={() => window.location.reload()}>Try again</button></div></AppLayout>;

  return <AppLayout>
    <section className="reference-banner-wrap">
      <div className="reference-banner-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
        {banners.map((banner, index) => <Link href={banner.href || '/packages'} key={`${banner.href}-${index}`} className="reference-banner">
          {banner.image_url ? <img src={banner.image_url} alt={banner.alt || 'Lebara promotion'} /> : <div className={`reference-banner-fallback banner-fallback-${index % 3}`}><strong>LEBARA</strong><span>{index === 0 ? 'Better rewards, brighter days' : index === 1 ? 'Recharge with confidence' : 'Grow together with Lebara'}</span></div>}
        </Link>)}
      </div>
      <div className="reference-dots">{banners.map((_, index) => <button type="button" key={index} className={index === slide ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Show banner ${index + 1}`} />)}</div>
    </section>

    <section className="reference-ticker" aria-label="Recent activity"><div className="reference-ticker-track">{ticker.map((item, index) => <span key={`${item.created_at || ''}-${index}`}><b>{item.text}</b> <strong>{item.amount || money(item.value)}</strong></span>)}</div></section>

    <section className="reference-action-card">{actions.map((action, index) => {
      const href = action.external ? (whatsappGroupUrl || action.href) : action.href;
      const content = <><span className={`reference-action-icon ${action.tone}`}>
        {action.icon === 'whatsapp' ? <WhatsAppIcon size={29} /> : <AppIcon name={action.icon} size={29} />}
      </span><b>{action.label}</b></>;
      return action.external && whatsappGroupUrl
        ? <a href={href} target="_blank" rel="noreferrer" key={`${action.label}-${index}`} className="reference-action">{content}</a>
        : <Link href={href} key={`${action.label}-${index}`} className="reference-action">{content}</Link>;
    })}</section>

    <section className="reference-wallet-strip"><div><small>Available balance</small><strong>{money(wallet.balance)}</strong></div><div><small>Income balance</small><strong>{money(wallet.income_balance)}</strong></div><Link href="/history">History ›</Link></section>

    <Link href="/gift-code" className="floating-gift-button" aria-label="Redeem gift code"><span>✉</span><i>✦</i></Link>
    {showWelcome && <div className="premium-modal-backdrop" role="dialog" aria-modal="true"><div className="premium-modal"><button className="modal-close" onClick={() => setShowWelcome(false)} aria-label="Close">×</button><div className="modal-sparkle"><AppIcon name="sparkle" size={25} /></div><span className="eyebrow">LEBARA MEMBER UPDATE</span><h2>Welcome back{user.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</h2><p>{notifications[0] ? `${notifications[0].text} ${notifications[0].amount || ''}. Keep your account active to unlock more rewards.` : 'Claim your daily reward and explore the latest Lebara opportunities.'}</p><Link href="/sign" className="modal-primary" onClick={() => setShowWelcome(false)}>View daily rewards →</Link><a href={whatsappGroupUrl || '/support'} target="_blank" rel="noreferrer" className="modal-whatsapp" onClick={() => setShowWelcome(false)}><WhatsAppIcon size={18} /> Join the WhatsApp group ↗</a><button className="modal-secondary" onClick={() => setShowWelcome(false)}>Maybe later</button></div></div>}
  </AppLayout>;
}
