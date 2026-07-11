import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  Zap, 
  MapPin, 
  TrendingUp, 
  Activity, 
  Skull,
  CheckCircle,
  Briefcase
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

export default function ExecutiveDashboard({ token }) {
  const [stats, setStats] = useState({
    alerts: { total: 0, critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
    active_incidents: 0,
    security_score: 100,
    posture_trend: '',
    mttd_seconds: 12.4,
    mttr_minutes: 25.0
  });
  const [postureHistory, setPostureHistory] = useState([]);
  const [countryStats, setCountryStats] = useState([]);
  const [criticalIncidents, setCriticalIncidents] = useState([]);
  const [analystKPIs, setAnalystKPIs] = useState({ sla_compliance_rate: 92.5 });
  const [topIPs, setTopIPs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch stats
        const resStats = await fetch(API_URL + '/api/dashboard/stats', { headers });
        const dataStats = await resStats.json();
        setStats(dataStats);
        
        // Fetch posture history
        const resHistory = await fetch(API_URL + '/api/dashboard/posture-history', { headers });
        const dataHistory = await resHistory.json();
        setPostureHistory(dataHistory);
        
        // Fetch country stats
        const resCountries = await fetch(API_URL + '/api/dashboard/countries-stats', { headers });
        const dataCountries = await resCountries.json();
        setCountryStats(dataCountries);
        
        // Fetch incidents
        const resIncidents = await fetch(API_URL + '/api/incidents', { headers });
        const dataIncidents = await resIncidents.json();
        // filter critical/high active incidents
        setCriticalIncidents(dataIncidents.filter(i => i.severity === 'Critical' && i.status !== 'Closed').slice(0, 5));
        
        // Fetch analyst stats for SLA
        const resAnalyst = await fetch(API_URL + '/api/analyst/stats', { headers });
        const dataAnalyst = await resAnalyst.json();
        setAnalystKPIs(dataAnalyst);
        
        // Fetch top blocklist IPs
        const resIntel = await fetch(API_URL + '/api/threat-intel/indicators', { headers });
        const dataIntel = await resIntel.json();
        setTopIPs(dataIntel.filter(i => i.indicator_type === 'IP').slice(0, 5));
        
      } catch (err) {
        console.error("Failed to load Executive Dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Chart configs
  const postureChartData = {
    labels: postureHistory.map(h => h.day),
    datasets: [{
      label: 'Security Posture Score',
      data: postureHistory.map(h => h.score),
      borderColor: '#00D4FF',
      backgroundColor: 'rgba(0, 212, 255, 0.05)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#00D4FF'
    }]
  };

  const postureChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        titleColor: '#00D4FF',
        bodyColor: '#FFF',
        borderColor: '#1F2937',
        borderWidth: 1
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 10 } } },
      y: { grid: { color: 'rgba(31, 41, 55, 0.4)' }, ticks: { color: '#9CA3AF', font: { size: 10 } }, min: 50, max: 100 }
    }
  };

  const countryChartData = {
    labels: countryStats.slice(0, 5).map(c => c.country),
    datasets: [{
      label: 'Attacks Logged',
      data: countryStats.slice(0, 5).map(c => c.count),
      backgroundColor: 'rgba(255, 59, 48, 0.8)',
      borderColor: '#FF3B30',
      borderWidth: 1,
      borderRadius: 4
    }]
  };

  const countryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 10 } } },
      y: { grid: { color: 'rgba(31, 41, 55, 0.4)' }, ticks: { color: '#9CA3AF', font: { size: 10 }, stepSize: 5 } }
    }
  };

  if (loading && postureHistory.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-mono text-cyber-cyan animate-pulse">ESTABLISHING SECURE EXECUTIVE CONSOLE...</span>
        </div>
      </div>
    );
  }

  // Visual class calculations
  const score = stats.security_score;
  const isGood = score >= 80;
  const isMed = score >= 50 && score < 80;
  const dialColor = isGood ? '#00FF99' : isMed ? '#FFA500' : '#FF3B30';
  const scoreTextColor = isGood ? 'text-cyber-green' : isMed ? 'text-cyber-orange' : 'text-cyber-red';
  const postureCircumference = 2 * Math.PI * 50;
  const postureStrokeDashoffset = postureCircumference - (score / 100) * postureCircumference;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex justify-between items-center bg-cyber-card border border-cyber-gray p-6 rounded-2xl relative overflow-hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-wide">Executive SOC Operations Panel</h2>
          <p className="text-xs text-cyber-muted mt-1 font-mono">
            OVERVIEW OF SYSTEM-WIDE KEY PERFORMANCE INDICATORS & SECURITY POSTURE INDEX
          </p>
        </div>
        <div className="text-xs font-mono text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/30 px-3 py-2 rounded-lg animate-pulse">
          STATUS: COMPLIANT
        </div>
      </div>

      {/* Main Row: Posture Dial and Weekly Trend Chart */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Posture Score Dial */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-xl relative min-h-[320px]">
          <div className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-cyber-muted font-mono uppercase">
            <Activity className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>Posture Dial</span>
          </div>

          <div className="relative w-40 h-40 flex items-center justify-center mt-3">
            {/* SVG Circle Gauge */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="60"
                className="stroke-cyber-gray"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r="60"
                stroke={dialColor}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={postureCircumference}
                strokeDashoffset={postureStrokeDashoffset}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-4xl font-extrabold font-mono ${scoreTextColor}`}>{score}</span>
              <span className="text-[10px] text-cyber-muted font-mono tracking-wider uppercase mt-0.5">SCORE</span>
            </div>
          </div>

          <div className="mt-5 space-y-1">
            <span className="text-[11px] font-mono text-cyber-muted uppercase tracking-wider block">Security Risk Posture</span>
            <div className="flex items-center justify-center gap-1.5">
              <TrendingUp className={`w-4 h-4 ${isGood ? 'text-cyber-green' : 'text-cyber-red'}`} />
              <span className={`text-sm font-bold font-mono ${isGood ? 'text-cyber-green' : 'text-cyber-red'}`}>
                {stats.posture_trend || 'No trend telemetry'}
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Trend Line Chart */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex flex-col justify-between shadow-xl h-[320px]">
          <div className="flex justify-between items-center border-b border-cyber-gray pb-3 mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Posture Score Trend</h3>
            </div>
            <span className="text-[9px] bg-cyber-cyan/15 text-cyber-cyan px-2.5 py-0.5 rounded font-mono uppercase">7-Day Aggregation</span>
          </div>
          <div className="flex-1 relative min-h-0">
            <Line data={postureChartData} options={postureChartOptions} />
          </div>
        </div>

      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* MTTR */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-cyan"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Mean Time To Respond</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-cyan mt-1">{stats.mttr_minutes}m</h3>
          </div>
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* MTTD */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-orange"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Mean Time To Detect</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-orange mt-1">{stats.mttd_seconds}s</h3>
          </div>
          <div className="p-3 bg-cyber-orange/10 rounded-xl text-cyber-orange">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* SLA Compliance */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-green"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">SLA Compliance Rate</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-green mt-1">{analystKPIs.sla_compliance_rate}%</h3>
          </div>
          <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Active Incident volume */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-red"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Active Incidents</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-red mt-1">{stats.active_incidents}</h3>
          </div>
          <div className="p-3 bg-cyber-red/10 rounded-xl text-cyber-red">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Map Stats & Incidents Board Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Top Attacking Countries */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col justify-between h-[360px]">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
            <MapPin className="w-4 h-4 text-cyber-red animate-bounce" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Attack Origins</h3>
          </div>
          <div className="flex-1 relative min-h-0">
            <Bar data={countryChartData} options={countryChartOptions} />
          </div>
        </div>

        {/* Top Malicious IP Blocklist Table */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col justify-between h-[360px]">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
            <Skull className="w-4 h-4 text-cyber-orange" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">High Risk Attacking IPs</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2.5 mt-2 pr-1 scrollbar">
            {topIPs.length === 0 ? (
              <span className="text-xs font-mono text-cyber-muted">No high-risk IPs active.</span>
            ) : (
              topIPs.map(ip => (
                <div key={ip.id} className="p-2.5 border border-cyber-gray bg-cyber-bg/40 rounded-xl flex justify-between items-center text-xs">
                  <div className="font-mono">
                    <span className="font-bold text-white break-all">{ip.value}</span>
                    <p className="text-[10px] text-cyber-cyan mt-0.5">{ip.threat_category}</p>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-cyber-red text-white px-1.5 py-0.5 rounded">
                    SCORE: {ip.reputation_score}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Critical Incident Board */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl flex flex-col justify-between h-[360px]">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
            <ShieldAlert className="w-4 h-4 text-cyber-red animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Critical Escalations</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2.5 mt-2 pr-1 scrollbar">
            {criticalIncidents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-xs font-mono text-cyber-muted">No open critical incidents.</span>
              </div>
            ) : (
              criticalIncidents.map(inc => (
                <div key={inc.id} className="p-3 border border-cyber-red/20 bg-cyber-red/5 rounded-xl flex flex-col gap-1 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-white truncate max-w-[150px]">{inc.title}</span>
                    <span className="text-[8px] font-mono font-bold bg-cyber-red text-white px-1.5 py-0.2 rounded uppercase">
                      {inc.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-cyber-muted truncate">{inc.description}</p>
                  <div className="flex justify-between items-center text-[9px] font-mono text-cyber-muted mt-1 border-t border-cyber-gray/40 pt-1">
                    <span>Owner: {inc.assignee_username}</span>
                    <span>{new Date(inc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
