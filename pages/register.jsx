import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ 
    fullName: '', 
    phone: '', 
    email: '', 
    password: '', 
    refCode: '' 
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call unified auth endpoint with action 'register'
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...formData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      // Success: Redirect to Dashboard
      router.replace('/dashboard');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* HERO BACKGROUND IMAGE (Same as Login) */}
      <div className="auth-hero-bg">
         <img src="/assets/file_0000000020a881f58a4ebe5b727b73bd.png" alt="Lebara Voice" />
      </div>

      {/* FORM CARD */}
      <div className="auth-card-modern">
        <h1>Create Account</h1>
        <p className="sub">Join Lebara and start earning today</p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          
          {/* Full Name */}
          <div className="input-group-wrapper">
            <label>Full Name</label>
            <div className="input-box-row">
               <svg className="icon-left" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <input 
                name="fullName" 
                value={formData.fullName} 
                onChange={handleChange} 
                placeholder="Enter your full name" 
                required 
                autoComplete="name"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="input-group-wrapper">
            <label>Phone Number</label>
            <div className="input-box-row">
              <span className="prefix-flag">🇳🇬 +234</span>
              <input 
                name="phone" 
                type="tel" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} 
                placeholder="Enter phone number" 
                required 
                maxLength="10"
                autoComplete="tel-national"
              />
            </div>
          </div>

          {/* Email (Optional) */}
          <div className="input-group-wrapper">
            <label>Email (Optional)</label>
            <div className="input-box-row">
               <svg className="icon-left" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <input 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
                placeholder="example@mail.com" 
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-group-wrapper">
            <label>Password</label>
            <div className="input-box-row">
               <svg className="icon-left" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              <input 
                name="password" 
                type={showPass ? "text" : "password"} 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="Min 6 characters" 
                required 
                minLength="6"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="toggle-pass">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Referral Code (Optional) */}
          <div className="input-group-wrapper">
            <label>Referral Code (Optional)</label>
            <div className="input-box-row">
               <svg className="icon-left" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              <input 
                name="refCode" 
                value={formData.refCode} 
                onChange={handleChange} 
                placeholder="Leave blank if none" 
                autoComplete="off"
              />
            </div>
          </div>

          <button type="submit" className="btn-signin-full" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="footer-links">
          Already have an account? <Link href="/">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
