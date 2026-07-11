import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Clock, 
  Zap, 
  Award, 
  ShieldCheck, 
  Users,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalystDashboard({ token }) {
  const [analystStats, setAnalystStats] = useState({
    total_incidents: 0,
    resolved_count: 0,
    mttd_seconds: 12.4,
    mttr_minutes: 25.0,
    sla_compliance_rate: 100.0,
    leaderboard: [],
    workload: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalystData = async () => {
      try {
        const response = await fetch(API_URL + '/api/analyst/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setAnalystStats(data);
      } catch (err) {
        console.error("Failed to load analyst stats dashboard", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalystData();
    const interval = setInterval(fetchAnalystData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Chart configs
  const workloadChartData = {
    labels: analystStats.workload.map(w => w.username),
    datasets: [{
      data: analystStats.workload.map(w => w.active_count),
      backgroundColor: [
        'rgba(0, 212, 255, 0.8)',   // Analyst Cyan
        'rgba(0, 255, 153, 0.8)',   // Responder Green
        'rgba(255, 165, 0, 0.8)',   // Admin Orange
        'rgba(156, 163, 175, 0.8)'  // Engineer Gray
      ],
      borderColor: 'rgba(11, 18, 32, 0.8)',
      borderWidth: 2
    }]
  };

  const workloadChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { color: '#9CA3AF', font: { size: 10 } }
      }
    }
  };

  const performanceChartData = {
    labels: analystStats.leaderboard.map(l => l.username),
    datasets: [
      {
        label: 'Resolved Incidents',
        data: analystStats.leaderboard.map(l => l.resolved_count),
        backgroundColor: 'rgba(0, 255, 153, 0.7)',
        borderRadius: 4
      },
      {
        label: 'Average MTTR (Mins)',
        data: analystStats.leaderboard.map(l => l.avg_response_mins),
        backgroundColor: 'rgba(0, 212, 255, 0.7)',
        borderRadius: 4
      }
    ]
  };

  const performanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#9CA3AF', font: { size: 10 } }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 10 } } },
      y: { grid: { color: 'rgba(31, 41, 55, 0.4)' }, ticks: { color: '#9CA3AF', font: { size: 10 } } }
    }
  };

  if (loading && analystStats.leaderboard.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-mono text-cyber-cyan animate-pulse">CALCULATING ANALYST PERFORMANCE INDEX...</span>
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
            <Users className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Analyst Performance & SLA Tracking</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              Audit mean response speeds, operator ticket distribution, and SLA resolution compliance rates.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* MTTR */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-cyan"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Avg Response Time</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-cyan mt-1">{analystStats.mttr_minutes}m</h3>
          </div>
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan">
            <Clock className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
        </div>

        {/* MTTD */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-orange"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Avg Detection Time</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-orange mt-1">{analystStats.mttd_seconds}s</h3>
          </div>
          <div className="p-3 bg-cyber-orange/10 rounded-xl text-cyber-orange">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* SLA compliance */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-green"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">SLA compliance</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-green mt-1">{analystStats.sla_compliance_rate}%</h3>
          </div>
          <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Resolved Count */}
        <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl flex items-center justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-cyber-green"></div>
          <div>
            <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Resolved Tickets</span>
            <h3 className="text-2xl font-bold font-mono text-cyber-green mt-1">{analystStats.resolved_count}</h3>
          </div>
          <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green animate-bounce">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analyst Leaderboard Table */}
      <div className="bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
          <Award className="w-4 h-4 text-cyber-cyan animate-pulse" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Operator Leaderboard</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-cyber-gray text-cyber-muted text-[10px] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-4">Operator</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Incidents Resolved</th>
                <th className="py-2.5 px-4">Average MTTR</th>
                <th className="py-2.5 px-4">SLA Compliance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-gray/40">
              {analystStats.leaderboard.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#111c2e]/10 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">{item.username}</td>
                  <td className="py-3 px-4 text-cyber-cyan font-mono">{item.role}</td>
                  <td className="py-3 px-4 font-bold font-mono">{item.resolved_count}</td>
                  <td className="py-3 px-4 font-mono">{item.avg_response_mins}m</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      item.sla_rate >= 90 ? 'bg-cyber-green/10 text-cyber-green' : 'bg-cyber-orange/10 text-cyber-orange'
                    }`}>
                      {item.sla_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Charts Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Comparison chart */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl h-[320px] flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
            <Activity className="w-4 h-4 text-cyber-cyan animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Resolutions Volume vs Response Times</h3>
          </div>
          <div className="flex-1 relative min-h-0">
            <Bar data={performanceChartData} options={performanceChartOptions} />
          </div>
        </div>

        {/* Workload Distribution Chart */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray p-5 rounded-2xl shadow-xl h-[320px] flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-cyber-gray pb-3 mb-2">
            <Users className="w-4 h-4 text-cyber-cyan" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Workload Distribution</h3>
          </div>
          <div className="flex-1 relative min-h-0">
            <Doughnut data={workloadChartData} options={workloadChartOptions} />
          </div>
        </div>

      </div>
    </div>
  );
}
