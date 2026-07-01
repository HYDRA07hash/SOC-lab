import React from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  AlertTriangle, 
  Briefcase, 
  Globe, 
  Terminal, 
  Search, 
  Settings as SettingsIcon, 
  LogOut,
  User as UserIcon,
  Bell,
  Layers,
  Activity
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, user, onLogout, notificationsCount, onClearNotifications }) {
  const menuItems = [
    { id: 'dashboard', name: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'alerts', name: 'Alert Manager', icon: AlertTriangle, badge: notificationsCount },
    { id: 'incidents', name: 'Incident Center', icon: Briefcase },
    { id: 'map', name: 'Map & Timeline', icon: Globe },
    { id: 'mitre', name: 'MITRE Matrix', icon: Layers },
    { id: 'analyst', name: 'Analyst Performance', icon: Activity },
    { id: 'intel', name: 'Threat Intel', icon: Search },
    { id: 'logs', name: 'Log Explorer', icon: Terminal },
    { id: 'settings', name: 'System Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-cyber-card border-r border-cyber-gray flex flex-col justify-between h-screen sticky top-0 shrink-0">
      {/* Brand Logo */}
      <div>
        <div className="p-6 flex items-center gap-3 border-b border-cyber-gray bg-[#0d1525]">
          <div className="p-2 bg-cyber-cyan/10 rounded-lg text-cyber-cyan shadow-glow">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wider text-white">
              SENTINEL<span className="text-cyber-cyan">SHIELD</span>
            </h1>
            <span className="text-[10px] text-cyber-cyan tracking-widest font-mono">SOC COMMAND V1.1</span>
          </div>
        </div>

        {/* User Stats Card */}
        <div className="p-4 mx-3 my-4 bg-cyber-bg/50 border border-cyber-gray rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-cyber-gray rounded-lg text-cyber-muted">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold text-white truncate">{user?.username}</h4>
            <span className="text-[11px] font-mono text-cyber-cyan px-1.5 py-0.5 rounded bg-cyber-cyan/10 inline-block font-semibold mt-0.5">
              {user?.role}
            </span>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="px-3 space-y-1 overflow-y-auto max-h-[55vh] scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive 
                    ? 'bg-cyber-cyan/10 text-cyber-cyan border-l-2 border-cyber-cyan shadow-glow' 
                    : 'text-cyber-muted hover:bg-cyber-gray/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-cyber-cyan' : 'text-cyber-muted'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyber-red text-white animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-cyber-gray bg-[#0d1525]/30">
        {notificationsCount > 0 && (
          <button 
            onClick={onClearNotifications}
            className="w-full flex items-center justify-center gap-2 mb-3 py-2 px-4 bg-cyber-gray/50 hover:bg-cyber-gray text-xs rounded-lg transition-colors border border-cyber-gray text-cyber-cyan"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Clear alerts ({notificationsCount})</span>
          </button>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-cyber-red/10 hover:bg-cyber-red/20 text-cyber-red text-xs font-semibold rounded-lg transition-all border border-cyber-red/30"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit Command</span>
        </button>
      </div>
    </aside>
  );
}
