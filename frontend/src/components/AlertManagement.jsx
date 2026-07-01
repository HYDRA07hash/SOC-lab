import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  Check, 
  Trash2, 
  PlusCircle, 
  Eye, 
  Briefcase,
  Layers,
  Sparkles
} from 'lucide-react';

export default function AlertManagement({ token, onRaiseIncident }) {
  const [alerts, setAlerts] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      let url = 'http://localhost:5000/api/alerts';
      
      const params = [];
      if (severityFilter) params.push(`severity=${severityFilter}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load alerts feed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [token, severityFilter, statusFilter]);

  const handleAcknowledge = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/alerts/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alert", err);
    }
  };

  const handleSuppress = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/alerts/${id}/suppress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchAlerts();
    } catch (err) {
      console.error("Failed to suppress alert", err);
    }
  };

  const handleBulkAcknowledge = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/alerts/bulk-acknowledge', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchAlerts();
    } catch (err) {
      console.error("Failed to bulk acknowledge alerts", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-red/10 rounded-xl text-cyber-red shadow-glow-red">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Alert Management Center</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Acknowledge alarms, suppress signature noise, and escalate alerts to investigation incidents.
            </p>
          </div>
        </div>
        
        <button
          onClick={handleBulkAcknowledge}
          className="flex items-center gap-2 py-2.5 px-4 bg-cyber-gray hover:bg-cyber-cyan hover:text-cyber-bg font-bold border border-cyber-gray text-cyber-cyan rounded-xl text-xs transition-all cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>Acknowledge All Active</span>
        </button>
      </div>

      {/* Filters & Grid */}
      <div className="bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl p-5 space-y-4">
        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 items-center justify-between bg-cyber-bg/50 p-3 rounded-xl border border-cyber-gray">
          <div className="flex flex-wrap gap-3">
            <div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-1.5 bg-cyber-card border border-cyber-gray rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Informational">Informational</option>
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-cyber-card border border-cyber-gray rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Suppressed">Suppressed</option>
              </select>
            </div>
          </div>
          <span className="text-[10px] text-cyber-muted font-mono font-bold uppercase">
            Telemetered Alarms: {alerts.length}
          </span>
        </div>

        {/* Table/List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-cyber-gray text-cyber-muted text-[10px] font-mono uppercase tracking-wider">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Alert Description</th>
                <th className="py-3 px-4">Source IP</th>
                <th className="py-3 px-4">Destination IP</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-gray/40">
              {loading && alerts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 font-mono text-cyber-cyan animate-pulse">
                    LOADING ALERTS STREAM...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-cyber-muted font-mono">
                    No matching alerts found in history.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => {
                  const isCrit = alert.severity === 'Critical';
                  const isHigh = alert.severity === 'High';
                  const isActive = alert.status === 'Active';
                  const isAcknowledged = alert.status === 'Acknowledged';
                  
                  return (
                    <tr 
                      key={alert.id} 
                      className={`hover:bg-[#111c2e]/20 transition-colors ${
                        isCrit && isActive ? 'bg-cyber-red/5' : isHigh && isActive ? 'bg-cyber-orange/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
                          isCrit ? 'bg-cyber-red text-white' : isHigh ? 'bg-cyber-orange text-cyber-bg' : 'bg-cyber-cyan text-cyber-bg'
                        }`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white font-mono">{alert.category}</td>
                      <td className="py-3.5 px-4 text-cyber-text leading-tight max-w-[320px] truncate" title={alert.description}>
                        {alert.description}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-cyber-cyan">{alert.source_ip}</td>
                      <td className="py-3.5 px-4 font-mono text-cyber-muted">{alert.destination_ip}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-mono ${
                          isActive ? 'text-cyber-red animate-pulse' : isAcknowledged ? 'text-cyber-green' : 'text-cyber-muted'
                        }`}>
                          {alert.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right flex justify-end gap-2.5 items-center">
                        {isActive && (
                          <>
                            <button
                              onClick={() => handleAcknowledge(alert.id)}
                              className="p-1.5 bg-cyber-gray hover:bg-cyber-green/20 text-cyber-green rounded-lg transition-colors border border-cyber-gray"
                              title="Acknowledge Alert"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSuppress(alert.id)}
                              className="p-1.5 bg-cyber-gray hover:bg-cyber-red/20 text-cyber-red rounded-lg transition-colors border border-cyber-gray"
                              title="Suppress Signature"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {!alert.incident_id && (
                          <button
                            onClick={() => onRaiseIncident(alert)}
                            className="p-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/35 text-cyber-cyan rounded-lg border border-cyber-cyan/20 transition-all"
                            title="Raise Incident"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
