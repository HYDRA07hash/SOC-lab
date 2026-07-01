from datetime import datetime
from database import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default='SOC Analyst') # SOC Analyst, Security Engineer, Incident Responder, Administrator
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    incidents = db.relationship('Incident', backref='assignee', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

class Incident(db.Model):
    __tablename__ = 'incidents'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default='Open') # Open, Under Investigation, Contained, Resolved, Closed
    severity = db.Column(db.String(20), default='Medium') # Critical, High, Medium, Low
    assignee_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    containment_strategy = db.Column(db.Text, nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)
    
    # Relationships
    alerts = db.relationship('Alert', backref='incident', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'severity': self.severity,
            'assignee_id': self.assignee_id,
            'assignee_username': self.assignee.username if self.assignee else 'Unassigned',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'containment_strategy': self.containment_strategy,
            'resolution_notes': self.resolution_notes
        }

class Alert(db.Model):
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    severity = db.Column(db.String(20), nullable=False) # Critical, High, Medium, Low, Informational
    category = db.Column(db.String(50), nullable=False) # Brute Force, SQL Injection, XSS, Port Scan, Directory Traversal, Command Injection, Malicious IP
    source_ip = db.Column(db.String(45), nullable=False)
    destination_ip = db.Column(db.String(45), nullable=False)
    status = db.Column(db.String(30), default='Active') # Active, Acknowledged, Suppressed
    mitre_technique = db.Column(db.String(50), nullable=True) # e.g. T1110 (Brute Force), T1190 (Exploit Public-Facing Application)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    incident_id = db.Column(db.Integer, db.ForeignKey('incidents.id'), nullable=True)
    
    # Added for Enhancement 2 & 4 (All new columns must be nullable=True to prevent DB crash)
    risk_score = db.Column(db.Integer, nullable=True, default=0)
    is_confirmed_threat = db.Column(db.Boolean, nullable=True, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'severity': self.severity,
            'category': self.category,
            'source_ip': self.source_ip,
            'destination_ip': self.destination_ip,
            'status': self.status,
            'mitre_technique': self.mitre_technique,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'incident_id': self.incident_id,
            'risk_score': self.risk_score,
            'is_confirmed_threat': self.is_confirmed_threat
        }

class ThreatIntel(db.Model):
    __tablename__ = 'threat_intelligence'
    
    id = db.Column(db.Integer, primary_key=True)
    indicator_type = db.Column(db.String(20), nullable=False) # IP, Domain, Hash
    value = db.Column(db.String(255), unique=True, nullable=False)
    reputation_score = db.Column(db.Integer, default=50) # 0-100 (high score means high threat)
    source_feed = db.Column(db.String(100), default='SentinelShield Global Threat Feed')
    threat_category = db.Column(db.String(50), default='Malware C2') # Botnet, Phishing, Malware C2, Scanner, Tor Exit Node
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'indicator_type': self.indicator_type,
            'value': self.value,
            'reputation_score': self.reputation_score,
            'source_feed': self.source_feed,
            'threat_category': self.threat_category,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class LogEntry(db.Model):
    __tablename__ = 'log_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    log_source = db.Column(db.String(30), nullable=False) # Auth, Web Server, System, Security, Application
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default='Info') # Info, Warning, Error, Critical
    raw_data = db.Column(db.Text, nullable=True)
    is_malicious = db.Column(db.Boolean, default=False)
    correlation_id = db.Column(db.String(50), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'log_source': self.log_source,
            'message': self.message,
            'severity': self.severity,
            'raw_data': self.raw_data,
            'is_malicious': self.is_malicious,
            'correlation_id': self.correlation_id
        }

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.String(255), nullable=False)
    notification_type = db.Column(db.String(20), default='Dashboard') # Dashboard, Email, SMS
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'notification_type': self.notification_type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Report(db.Model):
    __tablename__ = 'reports'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    report_type = db.Column(db.String(30), nullable=False) # Daily, Weekly, Monthly, Threat Intel, Incident
    generated_by = db.Column(db.String(50), default='System')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    file_path = db.Column(db.String(255), nullable=False)
    file_format = db.Column(db.String(10), nullable=False) # PDF, CSV, Excel
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'report_type': self.report_type,
            'generated_by': self.generated_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'file_path': self.file_path,
            'file_format': self.file_format
        }

class AttackEvent(db.Model):
    __tablename__ = 'attack_events'
    
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False) # SQL Injection, Brute Force, etc.
    source_ip = db.Column(db.String(45), nullable=False)
    country = db.Column(db.String(50), default='Unknown')
    city = db.Column(db.String(50), default='Unknown')
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    payload = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'source_ip': self.source_ip,
            'country': self.country,
            'city': self.city,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'payload': self.payload,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

class SystemSetting(db.Model):
    __tablename__ = 'system_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.String(255), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Added for Enhancement 1
class BlockedIP(db.Model):
    __tablename__ = 'blocked_ips'
    
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(45), unique=True, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    blocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    auto_blocked = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'ip_address': self.ip_address,
            'reason': self.reason,
            'blocked_at': self.blocked_at.isoformat() if self.blocked_at else None,
            'auto_blocked': self.auto_blocked
        }

# Added for Token invalidation on logout
class InvalidatedToken(db.Model):
    __tablename__ = 'invalidated_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(500), unique=True, nullable=False)
    invalidated_at = db.Column(db.DateTime, default=datetime.utcnow)
