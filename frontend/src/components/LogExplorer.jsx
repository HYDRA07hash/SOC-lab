import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  Terminal, 
  Search, 
  FileDown, 
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  FolderDot
} from 'lucide-react';

export default function LogExplorer({ token }) {
  const [logs, setLogs] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Reporting states
  const [reports, setReports] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportType, setReportType] = useState('Alerts');
  const [reportFormat, setReportFormat] = useState('PDF');
  const [reportGenerating, setReportGenerating] = useState(false);

  const fetchLogs = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      let url = API_URL + '/api/logs';
      
      const params = [];
      if (sourceFilter) params.push(`source=${sourceFilter}`);
      if (severityFilter) params.push(`severity=${severityFilter}`);
      if (searchQuery.strip()) params.push(`search=${encodeURIComponent(searchQuery.trim())}`);
      
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(API_URL + '/api/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Failed to load reports archive", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchReports();
  }, [token, sourceFilter, severityFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    setReportGenerating(true);
    try {
      const response = await fetch(API_URL + '/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          report_type: reportType,
          file_format: reportFormat
        })
      });
      
      if (response.ok) {
        setShowReportForm(false);
        fetchReports();
      }
    } catch (err) {
      console.error("Report compilation failed", err);
    } finally {
      setReportGenerating(false);
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
            <Terminal className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Security Log Explorer</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Correlate authentication failures, firewall reports, and system telemetry across endpoints.
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="flex items-center gap-2 py-2.5 px-4 bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/95 font-bold rounded-xl text-xs shadow-glow transition-all cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          <span>Export Security Report</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Logs Table & Filters */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl p-5 space-y-4">
          
          {/* Query Bar */}
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2.5 items-center justify-between bg-cyber-bg/50 p-3 border border-cyber-gray rounded-xl">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search raw log payloads..."
                className="w-full pl-9 pr-4 py-1.5 bg-cyber-card border border-cyber-gray rounded-lg text-xs text-white placeholder-cyber-muted focus:outline-none"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-cyber-card border border-cyber-gray rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="">All Sources</option>
                <option value="Auth">Auth Logs</option>
                <option value="Web Server">Web Server</option>
                <option value="System">System Kernel</option>
                <option value="Security">Security Firewall</option>
                <option value="Application">Application Audit</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-cyber-card border border-cyber-gray rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="">All Severities</option>
                <option value="Info">Info</option>
                <option value="Warning">Warning</option>
                <option value="Error">Error</option>
                <option value="Critical">Critical</option>
              </select>

              <button
                type="submit"
                className="p-2 bg-cyber-gray hover:bg-cyber-cyan hover:text-cyber-bg rounded-lg border border-cyber-gray transition-colors text-cyber-cyan cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[450px] overflow-y-auto scrollbar pr-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-cyber-gray text-cyber-muted text-[10px] font-mono uppercase tracking-wider sticky top-0 bg-cyber-card z-10">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Log Message</th>
                  <th className="py-2.5 px-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-gray/40 font-mono text-[11px]">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-cyber-cyan animate-pulse">
                      LOADING AUDIT LOGS DATABASE...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-cyber-muted">
                      No events match selected filter queries.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isError = log.severity === 'Error' || log.severity === 'Critical';
                    const isWarning = log.severity === 'Warning';
                    const severityClass = isError ? 'text-cyber-red bg-cyber-red/10' : isWarning ? 'text-cyber-orange bg-cyber-orange/10' : 'text-cyber-cyan bg-cyber-cyan/10';
                    
                    return (
                      <tr 
                        key={log.id} 
                        className={`hover:bg-[#111c2e]/10 transition-colors border-l-2 ${
                          log.is_malicious ? 'border-cyber-red bg-cyber-red/5' : 'border-transparent'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-cyber-muted shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 text-white font-bold">{log.log_source}</td>
                        <td className="py-2.5 px-3 text-cyber-text break-all max-w-[350px] leading-relaxed">
                          {log.message}
                          {log.raw_data && (
                            <pre className="mt-1 p-2 bg-black/60 rounded text-[9px] text-cyber-cyan border border-cyber-gray leading-normal overflow-x-auto max-w-[340px]">
                              {log.raw_data}
                            </pre>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${severityClass}`}>
                            {log.severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Right Column: Report Generators & Downloads Archive */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Export Report Config */}
          {showReportForm && (
            <div className="bg-cyber-card border border-cyber-cyan/35 p-5 rounded-2xl shadow-xl space-y-4 glass-panel-cyan">
              <div className="flex items-center gap-2 border-b border-cyber-cyan/30 pb-3">
                <FileSpreadsheet className="w-4 h-4 text-cyber-cyan" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Compile SOC Report</h3>
              </div>

              <form onSubmit={handleGenerateReport} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1.5 uppercase">Report Category</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-2.5 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-white focus:outline-none"
                  >
                    <option value="Alerts">Daily Alerts Log</option>
                    <option value="Incidents">Weekly Incident Summary</option>
                    <option value="Threat Intel">Threat Intelligence blocklist</option>
                    <option value="System Logs">Raw Security Audit Logs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1.5 uppercase">Export Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['PDF', 'CSV', 'Excel'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setReportFormat(fmt)}
                        className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                          reportFormat === fmt 
                            ? 'bg-cyber-cyan text-cyber-bg border-cyber-cyan' 
                            : 'bg-cyber-bg text-white border-cyber-gray hover:border-cyber-cyan/40'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={reportGenerating}
                  className="w-full py-2.5 bg-cyber-cyan text-cyber-bg font-extrabold rounded-xl shadow-glow transition-colors cursor-pointer"
                >
                  {reportGenerating ? 'Compiling Datastores...' : 'Compile & Export Document'}
                </button>
              </form>
            </div>
          )}

          {/* Generated Reports Archive */}
          <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col h-[400px] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-4">
              <FolderDot className="w-4 h-4 text-cyber-cyan animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Reports Archive</h3>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-cyber-gray/40 pr-1.5 scrollbar space-y-1">
              {reports.length === 0 ? (
                <div className="text-center py-20 text-cyber-muted text-xs font-mono">
                  No compiled reports archived.
                </div>
              ) : (
                reports.map((rep) => (
                  <div key={rep.id} className="py-3 flex justify-between items-center gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-white block">{rep.name}</span>
                      <span className="text-[10px] text-cyber-cyan font-mono mt-0.5 inline-block">
                        Type: {rep.report_type} · Format: {rep.file_format}
                      </span>
                      <span className="text-[9px] text-cyber-muted block mt-0.5">
                        By: {rep.generated_by} · {new Date(rep.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <a
                      href={`http://localhost:5000/api/reports/download/${rep.id}`}
                      className="p-2 bg-cyber-cyan/15 hover:bg-cyber-cyan/40 text-cyber-cyan border border-cyber-cyan/20 rounded-xl transition-all font-bold font-mono text-[10px]"
                      download
                    >
                      GET
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
