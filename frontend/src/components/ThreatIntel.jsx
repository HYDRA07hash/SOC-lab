import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  Search, 
  PlusCircle, 
  ShieldAlert, 
  Database,
  Globe,
  Radio,
  FileCode,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function ThreatIntel({ token, user }) {
  const [indicators, setIndicators] = useState([]);
  const [queryValue, setQueryValue] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Add indicator states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState('IP');
  const [newValue, setNewValue] = useState('');
  const [newScore, setNewScore] = useState(80);
  const [newCategory, setNewCategory] = useState('Malware C2');
  const [newDesc, setNewDesc] = useState('');
  const [addMsg, setAddMsg] = useState('');

  const isIntelAuthorized = user?.role === 'Security Engineer' || user?.role === 'Administrator';

  const fetchIndicators = async () => {
    try {
      const response = await fetch(API_URL + '/api/threat-intel/indicators', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setIndicators(data);
    } catch (err) {
      console.error("Failed to load IOC blocklists", err);
    }
  };

  useEffect(() => {
    fetchIndicators();
  }, [token]);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!queryValue.strip()) return;
    
    setLookupLoading(true);
    setLookupResult(null);
    setError('');

    try {
      const response = await fetch(`http://localhost:5000/api/threat-intel/lookup?value=${encodeURIComponent(queryValue.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLookupResult(data);
    } catch (err) {
      setError("Database lookup request failed.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddIndicator = async (e) => {
    e.preventDefault();
    if (!newValue.strip()) {
      setAddMsg('Indicator value is required.');
      return;
    }

    try {
      const response = await fetch(API_URL + '/api/threat-intel/indicators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          indicator_type: newType,
          value: newValue.trim(),
          reputation_score: parseInt(newScore),
          threat_category: newCategory,
          description: newDesc
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to append indicator');
      }

      setAddMsg('Indicator successfully committed to blocklist!');
      setNewValue('');
      setNewDesc('');
      fetchIndicators();
      setTimeout(() => {
        setAddMsg('');
        setShowAddForm(false);
      }, 2000);
    } catch (err) {
      setAddMsg(err.message || 'Error occurred during database insert');
    }
  };

  // Helper string check
  String.prototype.strip = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <Radio className="w-6 h-6 animate-pulse text-cyber-cyan" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Threat Intelligence Aggregator</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Query reputation indexes and sync local telemetry with global Indicators of Compromise (IOC) databases.
            </p>
          </div>
        </div>
        
        {isIntelAuthorized && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 py-2 px-4 bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/90 font-bold rounded-xl text-xs shadow-glow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Append Malicious IOC</span>
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Lookup and Add Forms */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* IOC Reputation Lookup Portal */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
              <Search className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">IOC Reputational Check</h3>
            </div>
            
            <form onSubmit={handleLookup} className="flex gap-2">
              <input
                type="text"
                value={queryValue}
                onChange={(e) => setQueryValue(e.target.value)}
                placeholder="IP, Domain or SHA256 Hash"
                className="flex-1 px-3 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-xs text-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-cyber-gray hover:bg-cyber-cyan hover:text-cyber-bg text-xs font-bold text-cyber-cyan rounded-xl transition-all border border-cyber-gray cursor-pointer"
              >
                Query
              </button>
            </form>

            {lookupLoading && (
              <div className="flex justify-center items-center py-6">
                <span className="w-6 h-6 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin"></span>
              </div>
            )}

            {lookupResult && (
              <div className="p-4 bg-cyber-bg/60 border border-cyber-gray rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-cyber-gray pb-2">
                  <span className="text-[10px] font-mono text-cyber-muted">REPUTATION ANALYSIS</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    lookupResult.data.reputation_score >= 70 ? 'bg-cyber-red text-white' : 'bg-cyber-green text-cyber-bg'
                  }`}>
                    {lookupResult.found ? 'KNOWN MALICIOUS' : 'UNKNOWN / SAFE'}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-cyber-muted font-mono block">INDICATOR VALUE:</span>
                    <span className="text-white font-mono font-semibold break-all">{lookupResult.data.value}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-cyber-muted font-mono block">IOC TYPE:</span>
                      <span className="text-white font-semibold font-mono">{lookupResult.data.indicator_type}</span>
                    </div>
                    <div>
                      <span className="text-cyber-muted font-mono block">REPUTATION SCORE:</span>
                      <span className={`font-semibold font-mono ${lookupResult.data.reputation_score >= 70 ? 'text-cyber-red' : 'text-cyber-green'}`}>
                        {lookupResult.data.reputation_score}/100
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-cyber-muted font-mono block">THREAT CATEGORY:</span>
                    <span className="text-white font-semibold">{lookupResult.data.threat_category}</span>
                  </div>
                  <div>
                    <span className="text-cyber-muted font-mono block">INTEL SUMMARY:</span>
                    <p className="text-cyber-text leading-snug mt-0.5">{lookupResult.data.description}</p>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded-lg text-cyber-red text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Append Form (Role Restricted UI) */}
          {showAddForm && isIntelAuthorized && (
            <div className="bg-cyber-card border border-cyber-cyan/30 p-5 rounded-2xl shadow-xl space-y-4 glass-panel-cyan">
              <div className="flex items-center gap-2 border-b border-cyber-cyan/30 pb-3 mb-2">
                <PlusCircle className="w-4 h-4 text-cyber-cyan" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Insert Compromise Indicator</h3>
              </div>

              {addMsg && (
                <div className="p-3 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs">
                  {addMsg}
                </div>
              )}

              <form onSubmit={handleAddIndicator} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-cyber-muted mb-1 uppercase">Indicator Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full px-2.5 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-white focus:outline-none"
                    >
                      <option value="IP">IP Address</option>
                      <option value="Domain">Domain DNS</option>
                      <option value="Hash">File Hash (SHA256)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-cyber-muted mb-1 uppercase">Risk Weight (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newScore}
                      onChange={(e) => setNewScore(e.target.value)}
                      className="w-full px-2.5 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1 uppercase">Indicator Value</label>
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="e.g. 192.168.4.15 or evil-domain.com"
                    className="w-full px-2.5 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1 uppercase">Threat Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-2.5 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-white focus:outline-none"
                  >
                    <option value="Malware C2">Malware Command & Control</option>
                    <option value="Scanner">IP Scanner / Sweeper</option>
                    <option value="Botnet">Botnet Node</option>
                    <option value="Phishing">Phishing Host</option>
                    <option value="Cryptominer">Cryptominer Pool</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1 uppercase">Indicator Notes</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows="2"
                    placeholder="Provide evidence summary or origin details..."
                    className="w-full px-2.5 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-white focus:outline-none resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-cyber-cyan text-cyber-bg font-bold rounded-xl shadow-glow cursor-pointer hover:bg-cyber-cyan/90 transition-colors"
                >
                  Sync to Blocklist Database
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Right Column: Local Threat Database Blocklist */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col h-[520px] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-4">
            <Database className="w-4 h-4 text-cyber-cyan" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sync\'d Threat Blocklists</h3>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-cyber-gray pr-1.5 scrollbar">
            {indicators.length === 0 ? (
              <div className="text-center py-20 text-cyber-muted text-xs font-mono">
                No compromise indicators found.
              </div>
            ) : (
              indicators.map((ioc) => {
                const isHigh = ioc.reputation_score >= 85;
                const Icon = ioc.indicator_type === 'IP' ? Globe : ioc.indicator_type === 'Domain' ? Radio : FileCode;
                
                return (
                  <div key={ioc.id} className="py-4 flex justify-between items-start gap-4 text-xs">
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isHigh ? 'bg-cyber-red/10 text-cyber-red' : 'bg-cyber-cyan/10 text-cyber-cyan'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <span className="font-mono font-bold text-white block break-all">{ioc.value}</span>
                        <p className="text-[11px] text-cyber-muted leading-tight">{ioc.description}</p>
                        <div className="flex gap-3 text-[10px] font-mono text-cyber-muted pt-1">
                          <span>Feed: <strong className="text-gray-300">{ioc.source_feed}</strong></span>
                          <span>Category: <strong className="text-cyber-cyan">{ioc.threat_category}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isHigh ? 'bg-cyber-red text-white' : 'bg-cyber-cyan text-cyber-bg'
                      }`}>
                        SCORE: {ioc.reputation_score}
                      </span>
                      <span className="text-[9px] font-mono text-cyber-muted">
                        {new Date(ioc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
