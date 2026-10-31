import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PublicLayout from '../components/PublicLayout';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ fullName: '', phone: '', password: '', email: '', refCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
    <PublicLayout>
      <div className="auth-card">
        <h1>Create Account</h1>
        {error && <div className="msg error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full Name</label>
            <input name="fullName" value={formData.fullName} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Phone Number</label>
            <input name="phone" type="tel" value={formData.phone} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Email (Optional)</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} required minLength="6"/>
          </div>
          <div className="field">
            <label>Referral Code (Optional)</label>
            <input name="refCode" value={formData.refCode} onChange={handleChange} placeholder="Leave blank if none" />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>

        <div className="links">
          Already have an account? <Link href="/">Sign In</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
