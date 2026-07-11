import { API_URL } from '../config';
import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const quickRoles = [
    { label: 'Administrator', user: 'admin', pass: 'admin123', desc: 'Full System Settings & Rules control' },
    { label: 'SOC Analyst', user: 'analyst', pass: 'analyst123', desc: 'Realtime Alert & Log monitoring' },
    { label: 'Incident Responder', user: 'responder', pass: 'responder123', desc: 'Mitigate and audit security incidents' },
    { label: 'Security Engineer', user: 'engineer', pass: 'engineer123', desc: 'Add threat intel and simulate attacks' },
  ];

  const handleQuickFill = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide all credentials.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(API_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message || 'Connection failure to SentinelShield core.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg cyber-grid flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Neon Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyber-cyan/5 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyber-red/5 blur-3xl"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 relative z-10">
        
        {/* Brand/Hero Section */}
        <div className="md:col-span-7 flex flex-col justify-center text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
              <Shield className="w-10 h-10 pulse-cyan" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-wider text-white">
                SENTINEL<span className="text-cyber-cyan">SHIELD</span>
              </h1>
              <p className="text-xs text-cyber-cyan tracking-widest font-mono">ADVANCED INTRUSION & WEB PROTECTION SYSTEM</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-100 mb-4">Enterprise SOC Operations Platform</h2>
          <p className="text-cyber-muted text-sm leading-relaxed mb-6">
            Real-time threat monitoring, rule-based log analysis, MITRE ATT&CK alignment, and comprehensive threat intelligence aggregations. Log in to access the Secure Operations Center dashboard.
          </p>

          {/* Quick-fill Roles panel */}
          <div className="border border-cyber-gray bg-cyber-card/60 backdrop-blur-md rounded-2xl p-5">
            <h3 className="text-xs font-semibold tracking-wider font-mono text-cyber-cyan uppercase mb-4">
              Demo Access Portals (Quick-Fill)
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {quickRoles.map((role) => (
                <button
                  key={role.label}
                  onClick={() => handleQuickFill(role.user, role.pass)}
                  className="p-3 rounded-xl border border-cyber-gray bg-[#162032]/40 hover:bg-cyber-cyan/5 hover:border-cyber-cyan/40 text-left transition-all duration-200 group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white group-hover:text-cyber-cyan">{role.label}</span>
                    <span className="text-[10px] text-cyber-cyan font-mono bg-cyber-cyan/10 px-1 py-0.5 rounded">
                      {role.user}
                    </span>
                  </div>
                  <p className="text-[10px] text-cyber-muted mt-1 leading-snug">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Login Form Section */}
        <div className="md:col-span-5 flex items-center justify-center">
          <div className="w-full bg-cyber-card border border-cyber-gray rounded-2xl shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyber-cyan to-cyber-green"></div>
            
            <h2 className="text-xl font-bold text-white mb-2">Operator Login</h2>
            <p className="text-xs text-cyber-muted mb-6">Provide digital signature to unlock SOC Console</p>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-cyber-red/10 border border-cyber-red/30 text-cyber-red text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyber-muted uppercase tracking-wider mb-1.5">
                  Operator Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter operator code"
                    className="w-full pl-10 pr-4 py-2.5 bg-cyber-bg border border-cyber-gray rounded-xl text-sm text-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-cyber-muted uppercase tracking-wider mb-1.5">
                  Passkey Authentication
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-cyber-bg border border-cyber-gray rounded-xl text-sm text-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-3 px-4 bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/90 font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Initialize Interface</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
