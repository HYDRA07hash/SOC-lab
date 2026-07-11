import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  Globe, 
  Clock, 
  Search, 
  MapPin, 
  AlertTriangle,
  Calendar,
  X,
  ShieldAlert,
  Flame,
  Info
} from 'lucide-react';

export default function AttackMapTimeline({ token }) {
  const [mapEvents, setMapEvents] = useState([]);
  const [countriesStats, setCountriesStats] = useState([]);
  
  // Timeline filters
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch geographic points and country statistics
  const fetchMapData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const resStats = await fetch(API_URL + '/api/dashboard/countries-stats', { headers });
      const dataStats = await resStats.json();
      setCountriesStats(dataStats);
      
      const resMap = await fetch(API_URL + '/api/dashboard/attack-map', { headers });
      const dataMap = await resMap.json();
      setMapEvents(dataMap);
    } catch (err) {
      console.error("Failed to load map data", err);
    }
  };

  // Fetch filtered timeline events
  const fetchTimelineData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      let url = API_URL + '/api/dashboard/timeline-events';
      
      const params = [];
      if (filterCategory) params.push(`category=${filterCategory}`);
      if (filterSeverity) params.push(`severity=${filterSeverity}`);
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      setTimelineEvents(data);
    } catch (err) {
      console.error("Failed to fetch timeline logs", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMapData(), fetchTimelineData()]);
      setLoading(false);
    };
    init();
    
    const interval = setInterval(() => {
      fetchMapData();
      fetchTimelineData();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, filterCategory, filterSeverity, startDate, endDate]);

  const getMapCoords = (lat, lon) => {
    const x = ((parseFloat(lon) + 180) / 360) * 100;
    const y = ((90 - parseFloat(lat)) / 180) * 100;
    return { x: `${x}%`, y: `${y}%` };
  };

  // Determines fill color for country region in SVG based on attack count
  const getCountryColor = (countryName) => {
    const match = countriesStats.find(c => c.country === countryName);
    if (!match || match.count === 0) return '#1f2937'; // Default dark gray
    
    if (match.count > 15) return 'rgba(255, 59, 48, 0.65)';  // Critical Red
    if (match.count > 6) return 'rgba(255, 165, 0, 0.65)';  // Warning Orange
    return 'rgba(0, 212, 255, 0.4)';  // Attack active: Cyan
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Live Attack Heatmap & Historical Timeline</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Visualize real-time attack density distributions geographically and inspect events chronologically.
            </p>
          </div>
        </div>
      </div>

      {/* Row 1: Heatmap Visualizer */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Heatmap canvas */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl p-5 flex flex-col h-[420px] justify-between relative">
          <div className="flex justify-between items-center border-b border-cyber-gray pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyber-cyan" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">Attack Intensity Map</span>
            </div>
            <div className="flex gap-4 text-[9px] font-mono text-cyber-muted items-center">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1f2937]"></span> Safe</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyber-cyan"></span> Low/Med</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyber-orange"></span> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyber-red"></span> Critical</span>
            </div>
          </div>

          <div className="flex-1 relative bg-[#090f1a] border border-cyber-gray/50 rounded-xl overflow-hidden flex items-center justify-center p-2">
            <svg 
              className="w-full h-full opacity-65" 
              viewBox="0 0 1000 500" 
              fill="none" 
              stroke="#111827" 
              strokeWidth="1.5"
            >
              {/* Regional geographic path mapping with dynamic coloring */}
              {/* North America / Canada */}
              <path d="M 50 100 L 250 80 L 300 120 L 220 250 L 150 250 L 120 300 L 100 240 Z" fill={getCountryColor("Canada")} />
              {/* United States */}
              <path d="M 120 120 L 240 110 L 270 160 L 210 240 L 140 220 Z" fill={getCountryColor("United States")} />
              {/* Brazil / South America */}
              <path d="M 220 260 L 260 280 L 310 320 L 270 450 L 240 460 L 210 330 Z" fill={getCountryColor("Brazil")} />
              {/* United Kingdom */}
              <path d="M 400 120 L 415 110 L 415 130 Z" fill={getCountryColor("United Kingdom")} />
              {/* Netherlands & Germany */}
              <path d="M 430 130 L 460 120 L 470 140 L 440 150 Z" fill={getCountryColor("Germany")} />
              {/* Ukraine & Russia Eurasia */}
              <path d="M 470 120 L 530 110 L 530 130 L 490 140 Z" fill={getCountryColor("Ukraine")} />
              <path d="M 530 80 L 780 60 L 900 110 L 920 200 L 800 280 L 710 320 L 610 200 Z" fill={getCountryColor("Russia")} />
              {/* China */}
              <path d="M 680 180 L 800 170 L 810 240 L 720 250 Z" fill={getCountryColor("China")} />
              {/* India */}
              <path d="M 680 230 L 740 220 L 720 290 Z" fill={getCountryColor("India")} />
              {/* Africa */}
              <path d="M 440 220 L 520 200 L 580 250 L 590 320 L 520 400 L 460 380 L 430 260 Z" fill="#1f2937" />
              {/* Australia */}
              <path d="M 780 340 L 880 360 L 870 410 L 790 400 Z" fill="#1f2937" />
              
              {/* Radar sweeps */}
              <circle cx="500" cy="250" r="150" stroke="#00D4FF" strokeWidth="0.4" strokeDasharray="3,3" opacity="0.2" />
            </svg>

            {/* Geographic scatter plots */}
            {mapEvents.map((evt, idx) => {
              if (evt.latitude === null || evt.longitude === null) return null;
              const coords = getMapCoords(evt.latitude, evt.longitude);
              const colorClass = evt.type === 'SQL Injection' || evt.type === 'Command Injection' ? 'bg-cyber-red shadow-glow-red' : 'bg-cyber-orange';
              
              return (
                <div 
                  key={evt.id || idx}
                  className="absolute"
                  style={{ left: coords.x, top: coords.y }}
                >
                  <span className={`absolute -left-1 -top-1 w-3 h-3 rounded-full ${evt.type === 'SQL Injection' ? 'bg-cyber-red/30 animate-ping' : 'bg-cyber-orange/30 animate-ping'}`}></span>
                  <div 
                    className={`w-1 h-1 rounded-full ${colorClass} group cursor-pointer relative`}
                  >
                    <div className="absolute hidden group-hover:block bottom-2.5 left-1/2 -translate-x-1/2 bg-cyber-card border border-cyber-gray p-2 rounded-lg w-40 text-[9px] leading-tight z-30 font-mono shadow-2xl">
                      <p className="text-cyber-cyan font-bold">{evt.type}</p>
                      <p className="text-white">IP: {evt.source_ip}</p>
                      <p className="text-cyber-muted">Loc: {evt.city}, {evt.country}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap country statistics */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl p-5 h-[420px] flex flex-col justify-between">
          <div className="border-b border-cyber-gray pb-3 mb-2 flex items-center gap-2">
            <Flame className="w-4 h-4 text-cyber-red animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Attack Country Distribution</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar">
            {countriesStats.map((c, idx) => {
              const pct = countriesStats.length > 0 ? (c.count / countriesStats[0].count) * 100 : 0;
              const intensityColor = c.intensity === 'Critical' ? 'bg-cyber-red' : c.intensity === 'High' ? 'bg-cyber-orange' : 'bg-cyber-cyan';
              
              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-white">{c.country}</span>
                    <span className="text-cyber-muted">{c.count} attacks</span>
                  </div>
                  <div className="w-full bg-cyber-gray/40 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${intensityColor}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Row 2: Chronological Timeline Logs */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Filters and Timeline list */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-cyber-gray pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyber-cyan animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chronological Event Timeline</h3>
            </div>
            <span className="text-[10px] text-cyber-muted font-mono font-bold uppercase">Matches: {timelineEvents.length}</span>
          </div>

          {/* Filter Controls Row */}
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 bg-cyber-bg/50 p-3 rounded-xl border border-cyber-gray">
            {/* Category dropdown */}
            <div>
              <label className="block text-[9px] font-mono text-cyber-muted uppercase tracking-wider mb-1">Attack Type</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-2 py-1 bg-cyber-card border border-cyber-gray rounded text-[11px] text-white focus:outline-none"
              >
                <option value="">All Categories</option>
                <option value="SQL Injection">SQL Injection</option>
                <option value="XSS">XSS Scripting</option>
                <option value="Directory Traversal">Directory Traversal</option>
                <option value="Command Injection">Command Injection</option>
                <option value="Brute Force">Brute Force</option>
                <option value="Port Scan">Port Scan</option>
              </select>
            </div>

            {/* Severity dropdown */}
            <div>
              <label className="block text-[9px] font-mono text-cyber-muted uppercase tracking-wider mb-1">Severity</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full px-2 py-1 bg-cyber-card border border-cyber-gray rounded text-[11px] text-white focus:outline-none"
              >
                <option value="">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[9px] font-mono text-cyber-muted uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1 bg-cyber-card border border-cyber-gray rounded text-[11px] text-white focus:outline-none font-mono"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[9px] font-mono text-cyber-muted uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1 bg-cyber-card border border-cyber-gray rounded text-[11px] text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Timeline events feed */}
          <div className="max-h-[340px] overflow-y-auto space-y-4 pr-1.5 scrollbar relative border-l border-cyber-gray/80 pl-6 mt-4">
            {timelineEvents.length === 0 ? (
              <div className="text-center py-10 text-cyber-muted text-xs font-mono">
                No chronological alerts match selected filters.
              </div>
            ) : (
              timelineEvents.map((evt) => {
                const isCrit = evt.severity === 'Critical';
                const isHigh = evt.severity === 'High';
                const nodeColor = isCrit ? 'bg-cyber-red border-cyber-red/35' : isHigh ? 'bg-cyber-orange border-cyber-orange/35' : 'bg-cyber-cyan border-cyber-cyan/35';
                
                return (
                  <div key={evt.id} className="relative group cursor-pointer" onClick={() => setSelectedEvent(evt)}>
                    {/* Node Dot */}
                    <span className={`absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${nodeColor} group-hover:scale-125 transition-transform`}></span>
                    
                    <div className="p-3.5 border border-cyber-gray hover:border-cyber-cyan/40 bg-cyber-card rounded-xl transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-white text-xs">{evt.type}</span>
                          <span className="text-[10px] text-cyber-cyan font-mono ml-2">MITRE: {evt.mitre}</span>
                        </div>
                        <span className="text-[9px] font-mono text-cyber-muted">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-cyber-text leading-tight mt-1.5 truncate max-w-[500px]">
                        {evt.message}
                      </p>
                      <div className="flex justify-between items-center text-[10px] font-mono text-cyber-muted mt-2 border-t border-cyber-gray/40 pt-1.5">
                        <span>Source: <strong className="text-gray-300">{evt.source_ip}</strong></span>
                        <span className={`font-bold ${isCrit ? 'text-cyber-red' : isHigh ? 'text-cyber-orange' : 'text-cyber-cyan'}`}>
                          {evt.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detailed Event Inspection Panel */}
        <div className="lg:col-span-4">
          {selectedEvent ? (
            <div className="bg-cyber-card border border-cyber-cyan/30 rounded-2xl shadow-xl p-5 space-y-4 relative glass-panel-cyan min-h-[380px]">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="absolute right-4 top-4 p-1 rounded-lg hover:bg-cyber-gray text-cyber-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="border-b border-cyber-cyan/30 pb-3">
                <div className="flex items-center gap-2 text-cyber-cyan">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                  <h3 className="font-extrabold text-white text-sm uppercase">Threat Investigation</h3>
                </div>
                <span className="text-[9px] text-cyber-muted font-mono block mt-1">
                  EVENT CODE: SS-EVT-{selectedEvent.id}
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-cyber-muted font-mono block text-[10px]">CATEGORY:</span>
                  <span className="text-white font-bold">{selectedEvent.type}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-cyber-muted font-mono block text-[10px]">SOURCE IP:</span>
                    <span className="text-white font-semibold font-mono text-cyber-cyan">{selectedEvent.source_ip}</span>
                  </div>
                  <div>
                    <span className="text-cyber-muted font-mono block text-[10px]">DESTINATION IP:</span>
                    <span className="text-white font-semibold font-mono">{selectedEvent.destination_ip}</span>
                  </div>
                </div>

                <div>
                  <span className="text-cyber-muted font-mono block text-[10px]">MITRE TECHNIQUE:</span>
                  <span className="text-cyber-cyan font-bold font-mono">{selectedEvent.mitre}</span>
                </div>

                <div>
                  <span className="text-cyber-muted font-mono block text-[10px]">TIMESTAMP:</span>
                  <span className="text-white font-mono">{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                </div>

                <div>
                  <span className="text-cyber-muted font-mono block text-[10px]">RAW LOG PAYLOAD:</span>
                  <pre className="mt-1 p-2 bg-black/60 rounded text-[10px] text-cyber-cyan border border-cyber-gray leading-normal overflow-x-auto max-h-[100px] whitespace-pre-wrap break-all scrollbar">
                    {selectedEvent.message}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl flex flex-col items-center justify-center p-6 h-[400px] text-cyber-muted">
              <Info className="w-10 h-10 mb-2 opacity-40 text-cyber-cyan" />
              <span className="text-xs font-mono text-center">Select an event from the timeline to launch deep payload inspection</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
