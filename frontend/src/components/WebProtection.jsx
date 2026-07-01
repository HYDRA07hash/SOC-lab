import React, { useEffect, useState } from 'react';
import { 
  Globe, 
  ShieldAlert, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  AlertTriangle,
  Code2
} from 'lucide-react';

export default function WebProtection({ token }) {
  const [webAlerts, setWebAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mitigation guide lookup based on attack category
  const mitigationGuides = {
    'SQL Injection': {
      title: 'SQL Injection Mitigation Strategy',
      steps: [
        'Implement Parameterized Queries / Prepared Statements in SQL integrations (e.g., ORM models).',
        'Configure Web Application Firewall (WAF) rule to block common SQL syntaxes (UNION SELECT, OR 1=1).',
        'Employ Least Privilege database user accounts; revoke drop/alter grants from web user roles.',
        'Sanitize and cast query variables before compiling SQL queries.'
      ],
      impact: 'Critical - Unauthorized Data Read/Write access (CIA compromised)'
    },
    'XSS': {
      title: 'Cross-Site Scripting Mitigation Strategy',
      steps: [
        'Apply Context-Aware HTML/Javascript output escaping on all user-supplied data in layouts.',
        'Establish a strong Content Security Policy (CSP) blocking unsafe inline scripts.',
        'Set HTTPOnly and Secure flags on session cookies to block access via Javascript document.cookie.',
        'Validate input schemas against strict string bounds.'
      ],
      impact: 'High - Client Session Hijacking, phishing scripts injection'
    },
    'Directory Traversal': {
      title: 'Directory/Path Traversal Mitigation Strategy',
      steps: [
        'Avoid passing file paths directly from user request inputs to filesystem APIs.',
        'Implement rigid whitelists for filename requests.',
        'Sanitize inputs using basename() to strip traversal characters (../, ..\\).',
        'Jail the application server process using chroot or standard container boundary rules.'
      ],
      impact: 'High - System File Exposure (e.g. /etc/passwd leakage)'
    },
    'Command Injection': {
      title: 'OS Command Injection Mitigation Strategy',
      steps: [
        'Avoid invoking shell commands (os.system, subprocess) via user-provided inputs.',
        'Use built-in framework APIs / libraries for operations instead of shell utilities (e.g. python ping libs).',
        'Sanitize command arguments using strict whitelist validation regex (alphanumeric only).',
        'Run the service container as a non-root system user.'
      ],
      impact: 'Critical - Remote Code Execution (RCE) / System takeover'
    },
    'Suspicious User-Agent': {
      title: 'Vulnerability Scanner Mitigation Strategy',
      steps: [
        'Configure rate-limiting policies at WAF / Reverse Proxy levels.',
        'Add reputation-based blocking for known threat scanners IP feeds.',
        'Deploy custom Honeypots/Decoys; block IPs interacting with hidden trap directories (e.g., /wp-admin on non-wordpress sites).'
      ],
      impact: 'Medium - Automated Reconnaissance and vulnerability indexing'
    }
  };

  useEffect(() => {
    const fetchWebAlerts = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/alerts', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        // Filter alerts to web-relevant categories
        const webCategories = ['SQL Injection', 'XSS', 'Directory Traversal', 'Command Injection', 'Suspicious User-Agent'];
        const webData = data.filter(a => webCategories.includes(a.category));
        
        setWebAlerts(webData);
        if (webData.length > 0 && !selectedAlert) {
          setSelectedAlert(webData[0]);
        }
      } catch (err) {
        console.error("Failed to load web protection logs", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWebAlerts();
    const interval = setInterval(fetchWebAlerts, 5000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Web Application Protection</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Live inspection of application-layer inputs, query strings, and payload signatures.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-cyber-green/10 text-cyber-green border border-cyber-green/30 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4" />
          <span>WAF ENGINE: ACTIVE</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Panel: List of detected threats */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-cyber-gray flex justify-between items-center bg-[#0d1525]/30">
            <h3 className="text-xs font-bold font-mono text-cyber-cyan uppercase tracking-wider">
              Application Layer Alerts ({webAlerts.length})
            </h3>
            <span className="text-[10px] text-cyber-muted font-mono">Auto-Updating</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-cyber-gray p-2 space-y-1.5 scrollbar">
            {webAlerts.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center text-cyber-muted py-20">
                <ShieldCheck className="w-12 h-12 mb-3 text-cyber-green opacity-40" />
                <span className="text-xs font-mono">No application layer threats detected.</span>
              </div>
            ) : (
              webAlerts.map((alert) => {
                const isActive = selectedAlert?.id === alert.id;
                const isCrit = alert.severity === 'Critical';
                const isHigh = alert.severity === 'High';
                
                return (
                  <button
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`w-full text-left p-4 rounded-xl transition-all duration-200 border ${
                      isActive 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan/40 shadow-glow' 
                        : 'bg-cyber-card border-transparent hover:bg-cyber-gray/30'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Code2 className={`w-4 h-4 ${isCrit ? 'text-cyber-red' : isHigh ? 'text-cyber-orange' : 'text-cyber-cyan'}`} />
                        <span className="text-sm font-bold text-white">{alert.category}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                        isCrit ? 'bg-cyber-red text-white' : isHigh ? 'bg-cyber-orange text-cyber-bg' : 'bg-cyber-cyan text-cyber-bg'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-cyber-muted truncate max-w-[500px]">
                      Payload: <code className="text-white font-mono bg-black/40 px-1 rounded">{alert.description.split("Payload: ")[1] || alert.description}</code>
                    </div>

                    <div className="flex justify-between items-center mt-3 text-[10px] font-mono text-cyber-muted">
                      <span>Source IP: <strong className="text-gray-300">{alert.source_ip}</strong></span>
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Incident Mitigation & Recommendations */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {selectedAlert ? (
            <>
              {/* Alert Details Card */}
              <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl shadow-xl space-y-4">
                <div className="border-b border-cyber-gray/80 pb-3">
                  <div className="flex items-center gap-2 text-cyber-red">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-extrabold text-white text-base">Threat Inspection</h3>
                  </div>
                  <span className="text-[10px] text-cyber-muted font-mono block mt-1 uppercase">
                    CORRELATION ID: SS-WAF-{selectedAlert.id}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-cyber-muted font-mono block">ATTACK PATTERN:</span>
                    <span className="text-white font-semibold">{selectedAlert.title}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-cyber-muted font-mono block">SOURCE IP:</span>
                      <span className="text-white font-semibold font-mono text-cyber-cyan">{selectedAlert.source_ip}</span>
                    </div>
                    <div>
                      <span className="text-cyber-muted font-mono block">TARGET HOST:</span>
                      <span className="text-white font-semibold font-mono">{selectedAlert.destination_ip}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-cyber-muted font-mono block">MITRE TECHNIQUE:</span>
                    <span className="text-cyber-cyan font-semibold font-mono">{selectedAlert.mitre_technique || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-cyber-muted font-mono block">DETECTION TIMEFRAME:</span>
                    <span className="text-white font-mono">{new Date(selectedAlert.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Mitigation Strategy Guide */}
              {mitigationGuides[selectedAlert.category] && (
                <div className="bg-cyber-card border border-cyber-cyan/20 p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden glass-panel-cyan">
                  <div className="absolute right-2 top-2 text-cyber-cyan/10">
                    <Cpu className="w-24 h-24" />
                  </div>
                  <div className="border-b border-cyber-cyan/30 pb-3">
                    <h4 className="font-bold text-cyber-cyan text-sm uppercase tracking-wider font-mono">
                      {mitigationGuides[selectedAlert.category].title}
                    </h4>
                    <span className="text-[9px] text-cyber-red font-mono font-bold mt-1 block uppercase">
                      IMPACT: {mitigationGuides[selectedAlert.category].impact}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {mitigationGuides[selectedAlert.category].steps.map((step, idx) => (
                      <div key={idx} className="flex gap-2 text-xs leading-relaxed">
                        <span className="text-cyber-cyan font-mono font-bold">{idx + 1}.</span>
                        <p className="text-cyber-text">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl shadow-xl flex items-center justify-center h-[300px]">
              <span className="text-xs font-mono text-cyber-muted">Select an alert to view threat mitigation insights</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
