import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  TableProperties, 
  Layers, 
  X, 
  Briefcase, 
  Check, 
  AlertTriangle,
  Activity,
  ChevronRight
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function MitreMatrix({ token }) {
  const [mitreStats, setMitreStats] = useState([]);
  const [selectedTechnique, setSelectedTechnique] = useState(null);
  const [loading, setLoading] = useState(true);

  // MITRE Tactics Matrix Layout structure
  const matrixTactics = [
    {
      tactic: 'Reconnaissance',
      techniques: [
        { id: 'T1595', name: 'Active Scanning', desc: 'Pre-attack host vulnerability scans' }
      ]
    },
    {
      tactic: 'Initial Access',
      techniques: [
        { id: 'T1190', name: 'Exploit Public-Facing App', desc: 'SQL Injection / command probes' }
      ]
    },
    {
      tactic: 'Execution',
      techniques: [
        { id: 'T1203', name: 'User Execution', desc: 'XSS script executions' }
      ]
    },
    {
      tactic: 'Credential Access',
      techniques: [
        { id: 'T1110.001', name: 'Brute Force', desc: 'SSH/RDP login brute forcing' }
      ]
    },
    {
      tactic: 'Discovery',
      techniques: [
        { id: 'T1046', name: 'Network Service Scanning', desc: 'Port scanning scans' },
        { id: 'T1083', name: 'File Discovery', desc: 'Directory traversal probes' }
      ]
    }
  ];

  const fetchMitreData = async () => {
    try {
      const res = await fetch(API_URL + '/api/dashboard/mitre-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMitreStats(data);
      
      // Update selected technique detail if currently open
      if (selectedTechnique) {
        const updated = data.find(t => t.id === selectedTechnique.id);
        setSelectedTechnique(updated || null);
      }
    } catch (err) {
      console.error("Failed to load MITRE matrix stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMitreData();
    const interval = setInterval(fetchMitreData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAcknowledge = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/alerts/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchMitreData();
    } catch (err) {
      console.error("Failed to acknowledge alert", err);
    }
  };

  const getTechStats = (techId) => {
    return mitreStats.find(t => t.id === techId) || { count: 0, severity: 'Info', alerts: [] };
  };

  // Chart config for frequency
  const chartData = {
    labels: mitreStats.map(m => m.id),
    datasets: [{
      label: 'Volume of Detections',
      data: mitreStats.map(m => m.count),
      backgroundColor: mitreStats.map(m => {
        if (m.count === 0) return '#1f2937';
        if (m.severity === 'Critical') return '#FF3B30';
        if (m.severity === 'High') return '#FFA500';
        return '#00D4FF';
      }),
      borderRadius: 4
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 10 } } },
      y: { grid: { color: 'rgba(31, 41, 55, 0.4)' }, ticks: { color: '#9CA3AF', font: { size: 10 } }, stepSize: 2 }
    }
  };

  if (loading && mitreStats.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-mono text-cyber-cyan animate-pulse">COMPILING MITRE ATT&CK MATRIX...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <Layers className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">MITRE ATT&CK Matrix Matrix Mapping</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Correlate active SOC alert telemetry against the adversary Tactics & Techniques database.
            </p>
          </div>
        </div>
      </div>

      {/* MITRE Grid Mapping */}
      <div className="grid md:grid-cols-5 gap-4 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl">
        {matrixTactics.map((tac, idx) => (
          <div key={idx} className="flex flex-col gap-3 min-h-[220px]">
            {/* Tactic Header */}
            <div className="p-3 bg-cyber-bg border border-cyber-gray rounded-xl text-center font-bold text-[11px] uppercase tracking-wider text-white">
              {tac.tactic}
            </div>
            
            {/* Techniques */}
            <div className="flex-1 flex flex-col gap-3">
              {tac.techniques.map((tech) => {
                const stats = getTechStats(tech.id);
                const hasAlerts = stats.alerts.length > 0;
                
                // Color border matches highest active alert severity
                let borderClass = 'border-cyber-gray bg-cyber-card';
                let glowClass = '';
                if (hasAlerts) {
                  if (stats.severity === 'Critical') {
                    borderClass = 'border-cyber-red/80 bg-cyber-red/5';
                    glowClass = 'shadow-glow-red';
                  } else if (stats.severity === 'High') {
                    borderClass = 'border-cyber-orange/80 bg-cyber-orange/5';
                    glowClass = 'shadow-glow-orange';
                  } else {
                    borderClass = 'border-cyber-cyan/80 bg-cyber-cyan/5';
                    glowClass = 'shadow-glow';
                  }
                }
                
                return (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTechnique(stats)}
                    className={`w-full text-left p-3 border rounded-xl transition-all duration-200 ${borderClass} ${glowClass} hover:bg-cyber-gray/30 relative group`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono text-cyber-cyan font-bold">{tech.id}</span>
                      {stats.count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-cyber-red text-white flex items-center justify-center text-[9px] font-bold animate-pulse">
                          {stats.count}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white text-[11px] mt-1 group-hover:text-cyber-cyan">{tech.name}</div>
                    <p className="text-[9px] text-cyber-muted mt-1 leading-snug">{tech.desc}</p>
                    
                    {stats.count > 0 && (
                      <span className="absolute right-2 bottom-2 text-cyber-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Frequency Stats and Slide-out Alert Details */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Frequency chart */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl h-[340px] flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
            <Activity className="w-4 h-4 text-cyber-cyan" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Technique Detections Frequency</h3>
          </div>
          <div className="flex-1 relative min-h-0">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Slide-out details drawer (Interactive details of selected technique cell) */}
        <div className="lg:col-span-5">
          {selectedTechnique ? (
            <div className="bg-cyber-card border border-cyber-cyan/30 rounded-2xl shadow-xl p-5 space-y-4 relative glass-panel-cyan min-h-[340px] max-h-[340px] flex flex-col justify-between">
              <div>
                <button 
                  onClick={() => setSelectedTechnique(null)}
                  className="absolute right-4 top-4 p-1 rounded-lg hover:bg-cyber-gray text-cyber-muted hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="border-b border-cyber-cyan/30 pb-3">
                  <span className="text-[10px] text-cyber-cyan font-mono font-bold block">{selectedTechnique.id}</span>
                  <h3 className="font-extrabold text-white text-base mt-0.5">{selectedTechnique.technique}</h3>
                  <span className="text-[9px] text-cyber-muted font-mono block mt-1 uppercase">
                    TACTIC: {selectedTechnique.tactic} · ACTIVE ALERTS: {selectedTechnique.alerts.length}
                  </span>
                </div>

                <div className="overflow-y-auto space-y-3 mt-4 max-h-[180px] pr-1.5 scrollbar">
                  {selectedTechnique.alerts.length === 0 ? (
                    <div className="text-center py-6 text-cyber-muted text-xs font-mono">
                      No active alerts for this technique code.
                    </div>
                  ) : (
                    selectedTechnique.alerts.map((alert) => (
                      <div key={alert.id} className="p-3 border border-cyber-gray bg-cyber-bg/40 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white">{alert.title}</span>
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            alert.severity === 'Critical' ? 'bg-cyber-red text-white' : 'bg-cyber-cyan text-cyber-bg'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-cyber-muted leading-tight">{alert.description}</p>
                        <div className="flex justify-between items-center text-[9px] font-mono text-cyber-muted pt-1 border-t border-cyber-gray/40">
                          <span>IP: {alert.source_ip}</span>
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="text-cyber-green hover:underline cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl flex flex-col items-center justify-center p-6 h-[340px] text-cyber-muted">
              <TableProperties className="w-10 h-10 mb-2 opacity-40 text-cyber-cyan" />
              <span className="text-xs font-mono text-center">Select a highlighted technique card to examine active alert mitigations</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
