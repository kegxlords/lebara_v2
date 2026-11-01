import { useState } from 'react';
import AppLayout from '../components/AppLayout';

const whatsappGroupUrl = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || 'https://chat.whatsapp.com/';

export default function SupportPage() {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    try { await navigator.clipboard.writeText(whatsappGroupUrl); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { setCopied(false); }
  }
  return <AppLayout title="Customer service">
    <section className="support-hero"><div className="support-orb">◌</div><span className="eyebrow">WE ARE HERE FOR YOU</span><h1>Customer service</h1><p>Get updates, ask questions, and connect with the Lebara support community.</p></section>
    <section className="whatsapp-card"><div className="whatsapp-mark">⌁</div><div className="whatsapp-copy"><span className="eyebrow">COMMUNITY SUPPORT</span><h2>Join our WhatsApp group</h2><p>Receive important updates and get help from our support team and community.</p></div><a href={whatsappGroupUrl} target="_blank" rel="noreferrer" className="whatsapp-join">Join group <span>↗</span></a><div className="whatsapp-link-row"><code>{whatsappGroupUrl}</code><button onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</button></div></section>
    <section className="support-options"><a href={whatsappGroupUrl} target="_blank" rel="noreferrer"><span>◉</span><div><b>WhatsApp community</b><small>Join the group for fast updates</small></div><strong>›</strong></a><a href="mailto:support@lebara-ng.com"><span>✉</span><div><b>Email support</b><small>support@lebara-ng.com</small></div><strong>›</strong></a><a href="/history"><span>?</span><div><b>Transaction help</b><small>Review your latest activity</small></div><strong>›</strong></a></section>
  </AppLayout>;
}
