import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Flame, 
  ServerCrash, 
  MapPin, 
  Activity, 
  Skull,
  TrendingUp,
  AlertOctagon,
  Clock
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard({ token }) {
  const [stats, setStats] = useState({
    alerts: { total: 0, critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
    active_incidents: 0,
    security_score: 100
  });
  const [trends, setTrends] = useState([]);
  const [attackTypes, setAttackTypes] = useState([]);
  const [mapEvents, setMapEvents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  // Poll dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch stats
        const resStats = await fetch(API_URL + '/api/dashboard/stats', { headers });
        const dataStats = await resStats.json();
        setStats(dataStats);
        
        // Fetch trends
        const resTrends = await fetch(API_URL + '/api/dashboard/threat-trends', { headers });
        const dataTrends = await resTrends.json();
        setTrends(dataTrends);
        
        // Fetch attack types
        const resTypes = await fetch(API_URL + '/api/dashboard/attack-types', { headers });
        const dataTypes = await resTypes.json();
        setAttackTypes(dataTypes);
        
        // Fetch attack map events
        const resMap = await fetch(API_URL + '/api/dashboard/attack-map', { headers });
        const dataMap = await resMap.json();
        setMapEvents(dataMap);
        
        // Fetch timeline
        const resTimeline = await fetch(API_URL + '/api/dashboard/timeline', { headers });
        const dataTimeline = await resTimeline.json();
        setTimeline(dataTimeline);
        
      } catch (err) {
        console.error("Failed to load dashboard statistics", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000); // refresh statistics every 4s
    return () => clearInterval(interval);
  }, [token]);

  // Chart configs
  const lineChartData = {
    labels: trends.map(t => t.time),
    datasets: [{
      label: 'Security Alerts (Hourly)',
      data: trends.map(t => t.count),
      borderColor: '#00D4FF',
      backgroundColor: 'rgba(0, 212, 255, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#00D4FF',
      pointHoverRadius: 6,
    }]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        titleColor: '#00D4FF',
        bodyColor: '#FFF',
        borderColor: '#1F2937',
        borderWidth: 1,
        font: { family: 'Outfit' }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(31, 41, 55, 0.5)' }, ticks: { color: '#9CA3AF', font: { size: 10 } } },
      y: { grid: { color: 'rgba(31, 41, 55, 0.5)' }, ticks: { color: '#9CA3AF', font: { size: 10 }, stepSize: 1 } }
    }
  };

  const barChartData = {
    labels: attackTypes.map(a => a.category),
    datasets: [{
      label: 'Volume',
      data: attackTypes.map(a => a.count),
      backgroundColor: attackTypes.map((_, i) => {
        const colors = [
          'rgba(255, 59, 48, 0.85)',  // Critical Red
          'rgba(255, 165, 0, 0.85)',  // Warning Orange
          'rgba(0, 212, 255, 0.85)',   // Accent Blue
          'rgba(0, 255, 153, 0.85)',   // Success Green
          'rgba(156, 163, 175, 0.85)'  // Gray
        ];
        return colors[i % colors.length];
      }),
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderRadius: 4
    }]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        bodyColor: '#FFF',
        borderColor: '#1F2937',
        borderWidth: 1
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 9 } } },
      y: { grid: { color: 'rgba(31, 41, 55, 0.5)' }, ticks: { color: '#9CA3AF', font: { size: 9 }, stepSize: 2 } }
    }
  };

  // Convert GPS Coordinates to SVG Map percentages
  // Mapping Lat range (90 to -90) to SVG Y range (0% to 100%)
  // Mapping Lon range (-180 to 180) to SVG X range (0% to 100%)
  const getMapCoords = (lat, lon) => {
    const x = ((parseFloat(lon) + 180) / 360) * 100;
    const y = ((90 - parseFloat(lat)) / 180) * 100;
    return { x: `${x}%`, y: `${y}%` };
  };

  if (loading && trends.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-mono text-cyber-cyan animate-pulse">ESTABLISHING DATALINK...</span>
        </div>
      </div>
    );
  }

  // Determine posture status and color
  let scoreColor = 'text-cyber-green border-cyber-green/30';
  if (stats.security_score < 50) scoreColor = 'text-cyber-red border-cyber-red/30';
  else if (stats.security_score < 80) scoreColor = 'text-cyber-orange border-cyber-orange/30';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex justify-between items-center bg-cyber-card border border-cyber-gray p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none">
          <Activity className="w-full h-full text-cyber-cyan" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-wide">SOC Command Center</h2>
          <p className="text-xs text-cyber-muted mt-1 font-mono">
            LIVE FEEDS LOADED · HEALTH POSTURE STATUS: ACTIVE MONITORING
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-cyber-muted font-mono block">SYSTEM SECURITY SCORE</span>
            <div className="text-2xl font-bold font-mono tracking-widest text-white flex items-center justify-end gap-1.5">
              <span className={scoreColor.split(' ')[0]}>{stats.security_score}</span>
              <span className="text-cyber-muted text-xs">/100</span>
            </div>
          </div>
          <div className={`p-4 rounded-xl border ${scoreColor.split(' ')[1]} bg-black/20 font-bold font-mono text-center min-w-[70px]`}>
            {stats.security_score >= 80 ? 'SECURE' : stats.security_score >= 50 ? 'WARN' : 'ALERT'}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Critical Alerts */}
        <div className="bg-cyber-card border border-cyber-gray/80 p-5 rounded-2xl flex items-center justify-between shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-red"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Critical Alerts</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-red mt-1">{stats.alerts.critical}</h3>
          </div>
          <div className="p-3 bg-cyber-red/10 rounded-xl text-cyber-red pulse-red">
            <Skull className="w-6 h-6" />
          </div>
        </div>

        {/* High Severity */}
        <div className="bg-cyber-card border border-cyber-gray/80 p-5 rounded-2xl flex items-center justify-between shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-orange"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">High Threats</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-orange mt-1">{stats.alerts.high}</h3>
          </div>
          <div className="p-3 bg-cyber-orange/10 rounded-xl text-cyber-orange">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Medium/Low */}
        <div className="bg-cyber-card border border-cyber-gray/80 p-5 rounded-2xl flex items-center justify-between shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-cyan"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Active Alerts</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-cyan mt-1">{stats.alerts.total}</h3>
          </div>
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Active Incidents */}
        <div className="bg-cyber-card border border-cyber-gray/80 p-5 rounded-2xl flex items-center justify-between shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-green"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Active Incidents</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-green mt-1">{stats.active_incidents}</h3>
          </div>
          <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green">
            <ServerCrash className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Graph Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Line Chart: Threat Trends */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-cyber-gray/50 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Real-Time Threat Volume</h3>
            </div>
            <span className="text-[10px] bg-cyber-cyan/10 text-cyber-cyan px-2 py-0.5 rounded font-mono uppercase">24 Hour Window</span>
          </div>
          <div className="flex-1 relative min-h-0">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Bar Chart: Attack Types */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col justify-between h-[340px]">
          <div className="flex items-center gap-2 border-b border-cyber-gray/50 pb-3 mb-2">
            <AlertOctagon className="w-4 h-4 text-cyber-orange" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Threat Category Distribution</h3>
          </div>
          <div className="flex-1 relative min-h-0">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>

      </div>

      {/* Map and Activity Feed */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Geo IP Attack Visualizer */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl h-[420px] flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-cyber-gray/50 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyber-cyan animate-bounce" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Geo-IP Intrusion Target Map</h3>
            </div>
            <span className="text-[10px] font-mono text-cyber-red animate-pulse uppercase">LIVE ATTACK VECTORS</span>
          </div>

          {/* SVG Map Canvas */}
          <div className="flex-1 relative bg-[#090f1a] border border-cyber-gray/50 rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-2">
            {/* Dark Tech-styled background world representation */}
            <svg 
              className="w-full h-full opacity-35" 
              viewBox="0 0 1000 500" 
              fill="none" 
              stroke="#1f2937" 
              strokeWidth="1.2"
            >
              {/* Very simplified geometric world outline for cyberpunk style */}
              {/* North America */}
              <path d="M 50 100 L 250 80 L 300 120 L 220 250 L 150 250 L 120 300 L 100 240 Z" />
              {/* South America */}
              <path d="M 220 260 L 260 280 L 310 320 L 270 450 L 240 460 L 210 330 Z" />
              {/* Africa */}
              <path d="M 440 220 L 520 200 L 580 250 L 590 320 L 520 400 L 460 380 L 430 260 Z" />
              {/* Eurasia */}
              <path d="M 400 80 L 550 50 L 800 60 L 900 110 L 920 200 L 800 280 L 710 320 L 610 200 L 500 120 Z" />
              {/* Australia */}
              <path d="M 780 340 L 880 360 L 870 410 L 790 400 Z" />
              
              {/* Radial radar grid overlays */}
              <circle cx="500" cy="250" r="120" stroke="#00D4FF" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.3" />
              <circle cx="500" cy="250" r="220" stroke="#00D4FF" strokeWidth="0.5" strokeDasharray="5,5" opacity="0.15" />
            </svg>

            {/* Dotted Geo plots */}
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
                  {/* Ripple pulse element */}
                  <span className={`absolute -left-1.5 -top-1.5 w-4 h-4 rounded-full ${evt.type === 'SQL Injection' ? 'bg-cyber-red/40 animate-ping' : 'bg-cyber-orange/40 animate-ping'}`}></span>
                  {/* Core plotting point */}
                  <div 
                    className={`w-1.5 h-1.5 rounded-full ${colorClass} group cursor-pointer relative`}
                    title={`${evt.type} from ${evt.source_ip} (${evt.city}, ${evt.country})`}
                  >
                    {/* Tooltip bubble on hover */}
                    <div className="absolute hidden group-hover:block bottom-3 left-1/2 -translate-x-1/2 bg-cyber-card border border-cyber-gray p-2.5 rounded-lg w-48 text-[10px] leading-tight z-30 font-mono shadow-2xl">
                      <p className="text-cyber-cyan font-bold">{evt.type}</p>
                      <p className="text-white mt-0.5">IP: {evt.source_ip}</p>
                      <p className="text-cyber-muted mt-0.5">Loc: {evt.city}, {evt.country}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Security Event Stream */}
        <div className="lg:col-span-5 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl h-[420px] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-cyber-gray/50 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyber-cyan animate-spin" style={{ animationDuration: '6s' }} />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Attack Stream</h3>
            </div>
            <span className="text-[10px] font-mono bg-cyber-red/10 text-cyber-red px-2 py-0.5 rounded font-bold animate-pulse">CORRELATED FEED</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1.5">
            {timeline.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center text-cyber-muted py-10">
                <span className="text-xs font-mono">No recent security events detected.</span>
              </div>
            ) : (
              timeline.map((evt, idx) => {
                const isCrit = evt.severity === 'Critical';
                const isHigh = evt.severity === 'High';
                const sevColor = isCrit ? 'border-cyber-red/40 bg-cyber-red/5' : isHigh ? 'border-cyber-orange/40 bg-cyber-orange/5' : 'border-cyber-gray bg-cyber-bg/40';
                
                return (
                  <div 
                    key={evt.type + evt.id + idx}
                    className={`p-3 border rounded-xl flex flex-col gap-1 transition-all ${sevColor}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">{evt.title}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        isCrit ? 'bg-cyber-red text-white' : isHigh ? 'bg-cyber-orange text-cyber-bg' : 'bg-cyber-cyan text-cyber-bg'
                      }`}>
                        {evt.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-cyber-muted leading-tight">{evt.message}</p>
                    <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-cyber-muted">
                      <span>TYPE: {evt.type.toUpperCase()}</span>
                      <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
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
