import { useState } from 'react';
import AppLayout from '../components/AppLayout';

export default function DownloadPage() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');

  const triggerDownload = () => {
    const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL;
    if (!apkUrl) {
      setDownloadMessage('The Android download is not configured yet. Please contact customer service for the official app link.');
      return;
    }
    const link = document.createElement('a');
    link.href = apkUrl;
    link.download = 'Lebara_App_v1.0.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show instructions modal after download starts
    setTimeout(() => setShowInstallPrompt(true), 1000);
  };

  return (
    <AppLayout title="Get the App">
      
      {/* HERO BANNER */}
      <div className="download-hero-card">
        <div className="app-logo-placeholder">L</div>
        <h2>LEBARA for Android</h2>
        <p>Track earnings, sign in daily, withdraw instantly – all from one app.</p>
        
        <div className="meta-badges">
          <span className="badge-meta">📱 v1.0.0</span>
          <span className="badge-meta">💾 7.7 MB</span>
          <span className="badge-meta">🤖 Android 8.0+</span>
        </div>

        <button className="btn-download-large-yellow" onClick={triggerDownload}>↓ Download APK</button>
        {downloadMessage && <p className="download-error" role="alert">{downloadMessage}</p>}
      </div>

      {/* INSTALLATION STEPS */}
      <div className="steps-card">
        <h3 className="steps-title">Installation Steps</h3>
        
        <div className="step-item">
          <div className="step-number">1</div>
          <div className="step-content">
            <strong>Tap “Download APK” above</strong>
            <p>The file saves to your Downloads folder. Allow the prompt if your browser asks permission.</p>
          </div>
        </div>

        <div className="step-item">
          <div className="step-number">2</div>
          <div className="step-content">
            <strong>Open the downloaded file</strong>
            <p>Pull down the notification shade and tap it, or open Files → Downloads → app.apk.</p>
          </div>
        </div>

        <div className="step-item">
          <div className="step-number">3</div>
          <div className="step-content">
            <strong>Allow installs from this source</strong>
            <p>Android will ask you to permit your browser (or Files app) to install unknown apps. Toggle it on, then return to the installer.</p>
          </div>
        </div>
      </div>

      {/* FAKE SYSTEM MODAL OVERLAY (For Demo Purposes) */}
      {showInstallPrompt && (
        <div className="system-modal-overlay" onClick={() => setShowInstallPrompt(false)}>
          <div className="system-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <img src="/assets/logo.png" alt="Icon" className="dialog-icon-img" />
              <h4>LEBARA</h4>
            </div>
            <p className="dialog-msg">Do you want to install this app?</p>
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setShowInstallPrompt(false)}>Cancel</button>
              <button className="btn-install-green" onClick={() => { alert("Proceeding with installation..."); setShowInstallPrompt(false); }}>Install</button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
