export default function PublicLayout({ children }) {
  return (
    <div className="auth-wrap">
      {/* Optional: Logo Header */}
      <header className="auth-header">
        <img src="/assets/logo.png" alt="Lebara" height="40" />
      </header>
      
      <main className="auth-container">
        {children}
      </main>
    </div>
  );
}
