import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Settings2,
  TableProperties,
  Flame,
  Info,
  Server
} from 'lucide-react';

export default function IDS({ token }) {
  const [idsAlerts, setIdsAlerts] = useState([]);
  const [mitreMapping, setMitreMapping] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIDSData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch alerts
        const resAlerts = await fetch('http://localhost:5000/api/alerts', { headers });
        const dataAlerts = await resAlerts.json();
        
        // Filter alerts relevant to IDS (Brute Force, Port Scan, Malicious IP)
        const idsCategories = ['Brute Force', 'Port Scan', 'Malicious IP', 'Suspicious User-Agent'];
        setIdsAlerts(dataAlerts.filter(a => idsCategories.includes(a.category)));
        
        // Fetch MITRE mapping
        const resMitre = await fetch('http://localhost:5000/api/settings/mitre', { headers });
        const dataMitre = await resMitre.json();
        setMitreMapping(dataMitre);
        
      } catch (err) {
        console.error("Failed to load IDS console data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIDSData();
    const interval = setInterval(fetchIDSData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Intrusion Detection System (IDS)</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Rule-based network scanning, authentication auditing, and correlation with the MITRE ATT&CK framework.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 px-3 py-1.5 rounded-lg">
          <Server className="w-4 h-4 animate-bounce" />
          <span>IDS ENGINE: SENSING</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Alerts List and Parameters */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Rules Configuration & Thresholds */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-4">
              <Settings2 className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Correlation & Detection Rules</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-cyber-bg/60 border border-cyber-gray rounded-xl">
                <span className="text-[10px] font-mono text-cyber-cyan block font-semibold uppercase">Auth Audit Rule (SSH/RDP)</span>
                <h4 className="text-sm font-bold text-white mt-1">Brute Force Attack Detector</h4>
                <p className="text-[11px] text-cyber-muted mt-1 leading-snug">
                  Flags source IP addresses attempting greater than <span className="text-cyber-cyan font-bold">5 failed login requests</span> within any sliding 60-second window.
                </p>
              </div>
              <div className="p-4 bg-cyber-bg/60 border border-cyber-gray rounded-xl">
                <span className="text-[10px] font-mono text-cyber-cyan block font-semibold uppercase">Network Scan Rule (TCP/UDP)</span>
                <h4 className="text-sm font-bold text-white mt-1">Port Scan Analyzer</h4>
                <p className="text-[11px] text-cyber-muted mt-1 leading-snug">
                  Flags source IPs triggering connections to greater than <span className="text-cyber-cyan font-bold">10 unique destination ports</span> in less than 10 seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Active Network Alerts Table */}
          <div className="bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl p-5">
            <div className="flex justify-between items-center border-b border-cyber-gray pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-cyber-red animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Network Alerts ({idsAlerts.length})</h3>
              </div>
              <span className="text-[10px] text-cyber-muted font-mono">CORRELATING</span>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-cyber-gray pr-1">
              {idsAlerts.length === 0 ? (
                <div className="text-center py-12 text-cyber-muted text-xs font-mono">
                  No active host intrusion alerts in current logs.
                </div>
              ) : (
                idsAlerts.map((alert) => (
                  <div key={alert.id} className="py-3 flex justify-between items-start gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{alert.title}</span>
                        <span className="text-[9px] font-mono bg-cyber-cyan/15 text-cyber-cyan px-1.5 py-0.2 rounded uppercase">
                          {alert.mitre_technique || 'T1110'}
                        </span>
                      </div>
                      <p className="text-[11px] text-cyber-muted mt-1 leading-tight">{alert.description}</p>
                      <div className="mt-1 text-[10px] font-mono text-cyber-cyan">
                        Src: {alert.source_ip} &rarr; Dst: {alert.destination_ip}
                      </div>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                      alert.severity === 'Critical' ? 'bg-cyber-red text-white' : 'bg-cyber-orange text-cyber-bg'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: MITRE ATT&CK Matrix Alignment */}
        <div className="lg:col-span-5 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col h-[520px] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-4">
            <TableProperties className="w-4 h-4 text-cyber-cyan" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">MITRE ATT&CK Mapping</h3>
          </div>
          
          <p className="text-xs text-cyber-muted mb-4 leading-relaxed">
            SentinelShield automatically correlates alert telemetry with the global MITRE adversary behaviors framework to aid threat hunting operations.
          </p>

          <div className="flex-1 overflow-y-auto divide-y divide-cyber-gray space-y-3 pr-1 scrollbar">
            {mitreMapping.map((item, idx) => (
              <div key={idx} className="pt-3 first:pt-0 flex flex-col gap-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-cyber-cyan font-bold">{item.id}</span>
                  <span className="text-[9px] font-mono bg-cyber-gray text-cyber-muted px-1.5 py-0.5 rounded font-bold uppercase">
                    {item.tactic}
                  </span>
                </div>
                <div className="font-bold text-white mt-0.5">{item.technique}</div>
                <div className="text-[10px] text-cyber-muted font-mono mt-0.5">
                  Flags: {item.category}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-cyber-gray flex items-center gap-2 bg-[#090f1a]/50 p-2.5 rounded-lg border">
            <Info className="w-4 h-4 text-cyber-cyan shrink-0" />
            <span className="text-[10px] text-cyber-muted font-mono leading-tight">
              Tactic classifications derived from Enterprise ATT&CK Matrix v14.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
