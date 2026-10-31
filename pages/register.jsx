import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', password: '', refCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-simple">
       <div className="auth-card-modern">
        <h1>Create Account</h1>
        
        {error && <div className="alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="input-group-wrapper">
            <label>Full Name</label>
            <input name="fullName" value={formData.fullName} onChange={handleChange} required className="standalone-input" />
          </div>
          
          <div className="input-group-wrapper">
            <label>Phone Number</label>
             <div className="input-box-row">
              <span className="prefix-flag">🇳🇬 +234</span>
              <input name="phone" type="tel" value={formData.phone} onChange={handleChange} required />
            </div>
          </div>

          <div className="input-group-wrapper">
            <label>Email (Optional)</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} className="standalone-input" />
          </div>
          
          <div className="input-group-wrapper">
            <label>Password</label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} required minLength="6" className="standalone-input" />
          </div>
          
          <div className="input-group-wrapper">
            <label>Referral Code (Optional)</label>
            <input name="refCode" value={formData.refCode} onChange={handleChange} placeholder="Leave blank if none" className="standalone-input" />
          </div>
          
          <button type="submit" className="btn-signin-full" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>

        <div className="footer-links">
          Already have an account? <Link href="/">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
