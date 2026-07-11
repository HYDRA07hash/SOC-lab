import { API_URL } from './config';
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import AlertManagement from './components/AlertManagement';
import IncidentResponse from './components/IncidentResponse';
import AttackMapTimeline from './components/AttackMapTimeline';
import MitreMatrix from './components/MitreMatrix';
import AnalystDashboard from './components/AnalystDashboard';
import ThreatIntel from './components/ThreatIntel';
import LogExplorer from './components/LogExplorer';
import Settings from './components/Settings';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('sentinel_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('sentinel_user') || 'null'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);

  // Fetch unread notifications for badge count
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const response = await fetch(API_URL + '/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to sync notifications feed", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('sentinel_token', newToken);
    localStorage.setItem('sentinel_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_user');
    setToken('');
    setUser(null);
  };

  const handleClearNotifications = async () => {
    try {
      const response = await fetch(API_URL + '/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  // Cohesive Escalation: Raise Incident from Alert
  const handleRaiseIncidentFromAlert = async (alert) => {
    try {
      const response = await fetch(API_URL + '/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `Escalated: ${alert.category} from ${alert.source_ip}`,
          description: `Telemetry: ${alert.description}\nSource Host IP: ${alert.source_ip}\nIncident escalated from Alarm ID #${alert.id}`,
          severity: alert.severity === 'Informational' ? 'Low' : alert.severity,
          alert_ids: [alert.id]
        })
      });
      
      if (response.ok) {
        // Automatically switch view to Incident tickets center
        setActiveTab('incidents');
      }
    } catch (err) {
      console.error("Escalation sequence failed", err);
    }
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Router layout
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ExecutiveDashboard token={token} />;
      case 'alerts':
        return <AlertManagement token={token} onRaiseIncident={handleRaiseIncidentFromAlert} />;
      case 'incidents':
        return <IncidentResponse token={token} user={user} />;
      case 'map':
        return <AttackMapTimeline token={token} />;
      case 'mitre':
        return <MitreMatrix token={token} />;
      case 'analyst':
        return <AnalystDashboard token={token} />;
      case 'intel':
        return <ThreatIntel token={token} user={user} />;
      case 'logs':
        return <LogExplorer token={token} />;
      case 'settings':
        return <Settings token={token} user={user} />;
      default:
        return <ExecutiveDashboard token={token} />;
    }
  };

  return (
    <div className="flex bg-cyber-bg min-h-screen text-cyber-text">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user}
        onLogout={handleLogout}
        notificationsCount={notifications.length}
        onClearNotifications={handleClearNotifications}
      />

      {/* Main Operations Console */}
      <main className="flex-1 p-8 h-screen overflow-y-auto relative">
        <div className="max-w-7xl mx-auto space-y-6">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
