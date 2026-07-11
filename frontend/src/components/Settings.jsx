import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  ToggleLeft, 
  ToggleRight,
  Flame,
  Users,
  Lock,
  CheckCircle,
  AlertTriangle,
  Play
} from 'lucide-react';

export default function Settings({ token, user }) {
  const [simEnabled, setSimEnabled] = useState(true);
  const [simInterval, setSimInterval] = useState(5);
  const [usersList, setUsersList] = useState([]);
  
  const [triggerMsg, setTriggerMsg] = useState('');
  const [triggerLoading, setTriggerLoading] = useState(false);

  const isSettingsAuthorized = user?.role === 'Security Engineer' || user?.role === 'Administrator';

  const fetchSimulatorSettings = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(API_URL + '/api/settings/simulator', { headers });
      const data = await res.json();
      setSimEnabled(data.enabled);
      setSimInterval(data.interval);
    } catch (err) {
      console.error("Failed to load simulator configurations", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(API_URL + '/api/auth/users', { headers });
      const data = await res.json();
      setUsersList(data);
    } catch (err) {
      console.error("Failed to fetch user profiles", err);
    }
  };

  useEffect(() => {
    fetchSimulatorSettings();
    fetchUsers();
  }, [token]);

  const handleToggleSim = async () => {
    if (!isSettingsAuthorized) return;
    
    try {
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      };
      const response = await fetch(API_URL + '/api/settings/simulator', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: !simEnabled, interval: simInterval })
      });
      if (response.ok) {
        setSimEnabled(!simEnabled);
      }
    } catch (err) {
      console.error("Failed to toggle simulator", err);
    }
  };

  const handleChangeInterval = async (interval) => {
    if (!isSettingsAuthorized) return;
    
    try {
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      };
      const response = await fetch(API_URL + '/api/settings/simulator', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: simEnabled, interval: parseInt(interval) })
      });
      if (response.ok) {
        setSimInterval(parseInt(interval));
      }
    } catch (err) {
      console.error("Failed to update simulator rate", err);
    }
  };

  const handleTriggerAttack = async (category) => {
    if (!isSettingsAuthorized) return;
    
    setTriggerLoading(true);
    setTriggerMsg('');
    
    try {
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      };
      const response = await fetch(API_URL + '/api/settings/simulator/trigger', {
        method: 'POST',
        headers,
        body: JSON.stringify({ category })
      });
      const data = await response.json();
      
      if (response.ok) {
        setTriggerMsg(`SUCCEEDED: Simulated ${category} injected successfully.`);
      } else {
        setTriggerMsg(`FAILED: ${data.message || 'Error occurred.'}`);
      }
    } catch (err) {
      setTriggerMsg('FAILED: Connections refused.');
    } finally {
      setTriggerLoading(false);
      setTimeout(() => setTriggerMsg(''), 4000);
    }
  };

  const attackCategories = [
    'SQL Injection',
    'XSS',
    'Directory Traversal',
    'Command Injection',
    'Brute Force',
    'Port Scan'
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <SettingsIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">System Settings Console</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Tweak attack simulator schedules, run live security drill injections, and audit user permissions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Attack Simulator Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Simulator Scheduling config */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-gray pb-3">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-cyber-cyan" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Log Simulation Engine</h3>
              </div>
              
              {isSettingsAuthorized ? (
                <button 
                  onClick={handleToggleSim}
                  className="text-cyber-cyan hover:text-white transition-colors cursor-pointer"
                >
                  {simEnabled ? (
                    <ToggleRight className="w-9 h-9 text-cyber-cyan" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-cyber-muted" />
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-cyber-muted font-mono uppercase bg-cyber-gray px-2 py-0.5 rounded font-bold">
                  View-Only Mode
                </span>
              )}
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-white block">Simulator State</span>
                  <p className="text-[11px] text-cyber-muted">Enable background mock threat generation logs.</p>
                </div>
                <span className={`font-mono font-bold ${simEnabled ? 'text-cyber-green' : 'text-cyber-muted'}`}>
                  {simEnabled ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="font-bold text-white block">Simulation Speed Interval</span>
                  <p className="text-[11px] text-cyber-muted">Seconds between generated logs.</p>
                </div>
                <div>
                  <select
                    disabled={!isSettingsAuthorized}
                    value={simInterval}
                    onChange={(e) => handleChangeInterval(e.target.value)}
                    className="px-2.5 py-1.5 bg-cyber-bg border border-cyber-gray rounded-lg font-mono text-white focus:outline-none"
                  >
                    <option value="2">2 Seconds</option>
                    <option value="5">5 Seconds</option>
                    <option value="10">10 Seconds</option>
                    <option value="30">30 Seconds</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Drill Attack Simulator Injections */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-cyber-gray pb-3">
              <Flame className="w-4 h-4 text-cyber-red animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cyber Security Drills (Manual Injections)</h3>
            </div>
            
            <p className="text-xs text-cyber-muted leading-relaxed">
              Force an immediate intrusion attempt payload to inspect SOC dashboard response, triggers, and notification system.
            </p>

            {triggerMsg && (
              <div className={`p-3 rounded-lg text-xs font-mono border ${
                triggerMsg.startsWith('SUCCEEDED') 
                  ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green' 
                  : 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red'
              }`}>
                {triggerMsg}
              </div>
            )}

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {attackCategories.map((cat) => (
                <button
                  key={cat}
                  disabled={!isSettingsAuthorized || triggerLoading}
                  onClick={() => handleTriggerAttack(cat)}
                  className="py-2.5 px-3 bg-cyber-bg hover:bg-cyber-red hover:text-white border border-cyber-gray hover:border-cyber-red/50 text-xs font-bold text-cyber-red rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: RBAC Auditor & Password Policies */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* User Management Grid */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col h-[270px] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-3">
              <Users className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Operators ({usersList.length})</h3>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-cyber-gray pr-1.5 scrollbar space-y-1">
              {usersList.map((usr) => (
                <div key={usr.id} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-white block">{usr.username}</span>
                    <span className="text-[10px] text-cyber-muted font-mono block mt-0.5">{usr.email}</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyber-cyan bg-cyber-cyan/15 px-2 py-0.5 rounded uppercase">
                    {usr.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Password Policy & Security Rules */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-cyber-gray pb-3">
              <Lock className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">SOC Compliance Policies</h3>
            </div>

            <div className="space-y-2 text-xs leading-relaxed text-cyber-text font-mono">
              <div className="flex gap-2">
                <span className="text-cyber-green">&#10003;</span>
                <p>Hash Encryption: PBKDF2 with HMAC-SHA256.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-cyber-green">&#10003;</span>
                <p>Authorization Strategy: Signed JWT Bearer tokens.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-cyber-green">&#10003;</span>
                <p>Access Boundaries: Role-Based Access Controls (RBAC).</p>
              </div>
              <div className="flex gap-2">
                <span className="text-cyber-green">&#10003;</span>
                <p>JWT Token TTL Session expiry limit: 8 Hours.</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
