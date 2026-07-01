import React, { useEffect, useState } from 'react';
import { 
  Briefcase, 
  PlusCircle, 
  UserPlus, 
  CheckCircle, 
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

export default function IncidentResponse({ token, user }) {
  const [incidents, setIncidents] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedInc, setSelectedInc] = useState(null);
  
  // Incident Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSev, setNewSev] = useState('Medium');
  const [newAssignee, setNewAssignee] = useState('');
  
  // Update fields
  const [editStatus, setEditStatus] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editContainment, setEditContainment] = useState('');
  const [editResolution, setEditResolution] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchIncidents = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch('http://localhost:5000/api/incidents', { headers });
      const data = await res.json();
      setIncidents(data);
      if (data.length > 0) {
        // Keep the selection synced
        if (selectedInc) {
          const updated = data.find(i => i.id === selectedInc.id);
          setSelectedInc(updated || data[0]);
        } else {
          setSelectedInc(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load incidents list", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch('http://localhost:5000/api/auth/users', { headers });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch operators list", err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchUsers();
    
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Sync update fields when selected incident changes
  useEffect(() => {
    if (selectedInc) {
      setEditStatus(selectedInc.status);
      setEditAssignee(selectedInc.assignee_id || 'unassigned');
      setEditContainment(selectedInc.containment_strategy || '');
      setEditResolution(selectedInc.resolution_notes || '');
    }
  }, [selectedInc]);

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    if (!newTitle.strip()) return;

    try {
      const response = await fetch('http://localhost:5000/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc,
          severity: newSev,
          assignee_id: newAssignee === '' ? null : parseInt(newAssignee)
        })
      });
      
      if (response.ok) {
        setNewTitle('');
        setNewDesc('');
        setNewAssignee('');
        setShowAddForm(false);
        fetchIncidents();
      }
    } catch (err) {
      console.error("Failed to create incident", err);
    }
  };

  const handleUpdateIncident = async (e) => {
    e.preventDefault();
    if (!selectedInc) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`http://localhost:5000/api/incidents/${selectedInc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: editStatus,
          assignee_id: editAssignee === 'unassigned' ? null : parseInt(editAssignee),
          containment_strategy: editContainment,
          resolution_notes: editResolution
        })
      });
      
      if (response.ok) {
        fetchIncidents();
      }
    } catch (err) {
      console.error("Failed to update incident details", err);
    } finally {
      setIsUpdating(false);
    }
  };

  String.prototype.strip = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cyber-card border border-cyber-gray p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyber-cyan/10 rounded-xl text-cyber-cyan shadow-glow">
            <Briefcase className="w-6 h-6 text-cyber-cyan" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Incident Response Center</h2>
            <p className="text-xs text-cyber-muted mt-0.5">
              SOC ticketing, responder assignment, quarantine logging, and containment resolution notes.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 py-2 px-4 bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/90 font-bold rounded-xl text-xs shadow-glow transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Raise Incident Ticket</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Incidents List */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-cyber-gray flex justify-between items-center bg-[#0d1525]/30">
            <h3 className="text-xs font-bold font-mono text-cyber-cyan uppercase tracking-wider">
              Tickets Log ({incidents.length})
            </h3>
            <span className="text-[10px] text-cyber-muted font-mono animate-pulse">MONITORING</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar">
            {showAddForm ? (
              /* Inline Add Incident Form */
              <form onSubmit={handleCreateIncident} className="p-4 border border-cyber-cyan/20 bg-cyber-cyan/5 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-cyber-cyan uppercase tracking-wider font-mono">Create Incident Ticket</h4>
                
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono text-cyber-muted mb-1">Ticket Title</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Critical Brute Force Quarantine"
                      className="w-full px-2.5 py-1.5 bg-cyber-bg border border-cyber-gray rounded-lg text-white focus:outline-none focus:border-cyber-cyan"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-mono text-cyber-muted mb-1">Description</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows="2"
                      placeholder="Summary of threat vector..."
                      className="w-full px-2.5 py-1.5 bg-cyber-bg border border-cyber-gray rounded-lg text-white focus:outline-none resize-none focus:border-cyber-cyan"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-cyber-muted mb-1">Severity</label>
                      <select
                        value={newSev}
                        onChange={(e) => setNewSev(e.target.value)}
                        className="w-full px-2 py-1.5 bg-cyber-bg border border-cyber-gray rounded-lg text-white focus:outline-none"
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyber-muted mb-1">Assign Operator</label>
                      <select
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="w-full px-2 py-1.5 bg-cyber-bg border border-cyber-gray rounded-lg text-white focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-cyber-cyan text-cyber-bg font-bold rounded-lg cursor-pointer hover:bg-cyber-cyan/90 transition-colors text-center"
                    >
                      Save Ticket
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 bg-cyber-gray hover:bg-cyber-gray/80 text-white rounded-lg text-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : incidents.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center text-cyber-muted py-20">
                <CheckCircle className="w-12 h-12 mb-3 text-cyber-green opacity-40" />
                <span className="text-xs font-mono">No incident tickets logged.</span>
              </div>
            ) : (
              incidents.map((inc) => {
                const isActive = selectedInc?.id === inc.id;
                const isClosed = inc.status === 'Closed' || inc.status === 'Resolved';
                const isCrit = inc.severity === 'Critical';
                
                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedInc(inc)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all duration-200 border ${
                      isActive 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan/40 shadow-glow' 
                        : 'bg-cyber-card border-transparent hover:bg-cyber-gray/30'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isClosed ? 'text-cyber-green' : isCrit ? 'text-cyber-red' : 'text-cyber-cyan'}`} />
                        <span className="text-xs font-bold text-white truncate">{inc.title}</span>
                      </div>
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 uppercase ${
                        inc.status === 'Open' ? 'bg-cyber-red text-white' : inc.status === 'Under Investigation' ? 'bg-cyber-orange text-cyber-bg' : 'bg-cyber-green text-cyber-bg'
                      }`}>
                        {inc.status}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 text-[10px] font-mono text-cyber-muted">
                      <span>Assignee: <strong className="text-gray-300">{inc.assignee_username}</strong></span>
                      <span>Sev: <strong className={isCrit ? 'text-cyber-red' : 'text-cyber-cyan'}>{inc.severity}</strong></span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ticket Updates and Worklogs */}
        <div className="lg:col-span-8">
          {selectedInc ? (
            <div className="bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl p-6 h-[600px] overflow-y-auto space-y-5 scrollbar">
              {/* Card Header Info */}
              <div className="border-b border-cyber-gray pb-3 flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedInc.title}</h3>
                  <span className="text-[10px] text-cyber-muted font-mono block mt-1">
                    TICKET REF: INC-{selectedInc.id} · LOGGED: {new Date(selectedInc.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded uppercase ${
                    selectedInc.severity === 'Critical' ? 'bg-cyber-red text-white' : 'bg-cyber-orange text-cyber-bg'
                  }`}>
                    {selectedInc.severity} SEVERITY
                  </span>
                </div>
              </div>

              {/* Description box */}
              <div className="p-4 bg-cyber-bg/60 border border-cyber-gray rounded-xl">
                <span className="text-[10px] font-mono text-cyber-muted block uppercase">Incident Description</span>
                <p className="text-xs text-cyber-text mt-1.5 leading-relaxed">
                  {selectedInc.description || 'No detailed log summary was provided.'}
                </p>
              </div>

              {/* Update ticket form */}
              <form onSubmit={handleUpdateIncident} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-cyber-muted mb-1.5 uppercase">
                      Quarantine / Lifecycle Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-xs text-white focus:outline-none focus:border-cyber-cyan"
                    >
                      <option value="Open">Open</option>
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Contained">Contained (Quarantined)</option>
                      <option value="Resolved">Resolved (Cleared)</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-cyber-muted mb-1.5 uppercase">
                      Assign Responder
                    </label>
                    <select
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      className="w-full px-3 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-xs text-white focus:outline-none focus:border-cyber-cyan"
                    >
                      <option value="unassigned">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1.5 uppercase">
                    Containment & Isolation Strategy
                  </label>
                  <textarea
                    value={editContainment}
                    onChange={(e) => setEditContainment(e.target.value)}
                    rows="3"
                    placeholder="Describe quarantine actions (e.g. block IP at gateway firewall, restart container, run script...)"
                    className="w-full px-3 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-xs text-white placeholder-cyber-muted focus:outline-none focus:border-cyber-cyan resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-cyber-muted mb-1.5 uppercase">
                    Resolution Notes (Root Cause Analysis)
                  </label>
                  <textarea
                    value={editResolution}
                    onChange={(e) => setEditResolution(e.target.value)}
                    rows="3"
                    placeholder=" Rationale for clearing, root vulnerability patch status..."
                    className="w-full px-3 py-2 bg-cyber-bg border border-cyber-gray rounded-xl text-xs text-white placeholder-cyber-muted focus:outline-none focus:border-cyber-cyan resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="py-2.5 px-6 bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/95 font-bold rounded-xl text-xs shadow-glow transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isUpdating ? (
                      <span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Commit Incident Updates</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-cyber-card border border-cyber-gray rounded-2xl shadow-xl flex flex-col items-center justify-center h-[600px] text-cyber-muted">
              <HelpCircle className="w-12 h-12 mb-3 text-cyber-muted opacity-40 animate-bounce" />
              <span className="text-xs font-mono">Select an active ticket to view incident investigation logs</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
