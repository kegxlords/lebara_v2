export function AppIcon({ name, size = 24, strokeWidth = 1.9, className = '' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className };
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></>,
    packages: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 8 4-2 4 2-4 2-4-2Z" /><path d="M8 12h8M8 16h5" /></>,
    orders: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3.5h6M8 9h8M8 13h8M8 17h5" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.4-3.2 2.1-5 5.5-5s5.1 1.8 5.5 5M15 15c3.1-.2 4.9 1.4 5.5 4.5" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.5-4 2.8-6 7-6s6.5 2 7 6" /></>,
    sparkle: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />,
    recharge: <><rect x="3" y="7" width="16" height="10" rx="2" /><path d="M19 10h2v4h-2M7 12h8" /></>,
    withdraw: <><path d="M5 19 19 5" /><path d="M9 5h10v10" /><path d="M5 19h10V9" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M5 21h14" /></>,
    whatsapp: <><path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3.5 20l1.2-4.1A8.5 8.5 0 1 1 20.5 11.5Z" /><path d="M8.2 8.1c.3-.5.7-.5 1-.4l1.1 2.2c.1.3.1.5-.1.7l-.6.6c.7 1.2 1.6 2.1 2.8 2.8l.6-.6c.2-.2.5-.2.7-.1l2.2 1.1c.3.2.3.6-.1 1-.5.6-1.2.9-1.9.8-3.5-.6-6.5-3.6-7.1-7.1-.1-.7.2-1.4.8-2Z" /></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M12 9v12M3 13h18M12 9H8.5a2.5 2.5 0 1 1 2.4-3.2L12 9Zm0 0h3.5a2.5 2.5 0 1 0-2.4-3.2L12 9Z" /></>
  };
  return <svg {...common}>{paths[name] || paths.sparkle}</svg>;
}

export function WhatsAppIcon({ size = 24, className = '' }) {
  return <AppIcon name="whatsapp" size={size} strokeWidth={1.75} className={className} />;
}
