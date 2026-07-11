import os
import sys
import uuid
import random
import re
import html
import ipaddress
import tempfile
import collections
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded
from werkzeug.exceptions import HTTPException

from database import db
from config import Config
from models import User, Alert, Incident, LogEntry, ThreatIntel, Notification, Report, AttackEvent, SystemSetting, BlockedIP, InvalidatedToken
from auth import token_required, role_required, generate_token, seed_default_users
from threat_intel import threat_intel_bp, seed_threat_intel
from rules import analyze_and_detect, GEO_MOCK_POOL, mask_ip_address

app = Flask(__name__)
app.config.from_object(Config)

# ==========================================
# RATE LIMITING & SECURITY DEFINITIONS
# ==========================================

# Custom key generator to rate limit per user if authenticated, else per IP
def get_user_or_ip():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        try:
            import jwt
            data = jwt.decode(token, app.config['JWT_SECRET'], algorithms=['HS256'])
            return f"user_{data.get('sub')}"
        except Exception:
            pass
    return get_remote_address()

limiter = Limiter(
    key_func=get_user_or_ip,
    default_limits=["60 per minute"]
)
limiter.init_app(app)

# Restrict CORS to explicitly allowed origins (No wildcards).
# Set CORS_ORIGINS as a comma-separated list in production (e.g. your deployed frontend URL).
# Falls back to local dev defaults if not set.
_cors_origins_env = os.environ.get('CORS_ORIGINS')
if _cors_origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
else:
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:80"]

CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
     methods=["GET", "POST", "PUT", "DELETE"],
     allow_headers=["Content-Type", "Authorization"])

# Initialize Database
db.init_app(app)

# Global simulator reference
simulator = None

# Create folders needed for reports
os.makedirs(os.path.join(app.root_path, 'reports_store'), exist_ok=True)

# Helper function to mask IP addresses in dicts for non-admin API views
def mask_ip_string(ip):
    if not ip:
        return ip
    parts = ip.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.x.x"
    if ':' in ip:
        parts = ip.split(':')
        if len(parts) >= 2:
            return f"{parts[0]}:{parts[1]}:x:x::"
    return "xxx.xxx.x.x"

def mask_alert_response(alert_dict, role):
    if role != 'Administrator':
        if 'source_ip' in alert_dict:
            alert_dict['source_ip'] = mask_ip_string(alert_dict['source_ip'])
        if 'destination_ip' in alert_dict:
            alert_dict['destination_ip'] = mask_ip_string(alert_dict['destination_ip'])
        if 'description' in alert_dict and alert_dict['description']:
            alert_dict['description'] = re.sub(
                r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
                lambda m: mask_ip_string(m.group(0)),
                alert_dict['description']
            )
    return alert_dict

def mask_blocked_ip_response(blocked_dict, role):
    if role != 'Administrator':
        if 'ip_address' in blocked_dict:
            blocked_dict['ip_address'] = mask_ip_string(blocked_dict['ip_address'])
    return blocked_dict

def mask_log_entry_response(log_dict, role):
    if role != 'Administrator':
        if 'message' in log_dict and log_dict['message']:
            log_dict['message'] = re.sub(
                r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
                lambda m: mask_ip_string(m.group(0)),
                log_dict['message']
            )
        if 'raw_data' in log_dict and log_dict['raw_data']:
            log_dict['raw_data'] = re.sub(
                r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
                lambda m: mask_ip_string(m.group(0)),
                log_dict['raw_data']
            )
    return log_dict

def mask_attack_event_response(event_dict, role):
    if role != 'Administrator':
        if 'source_ip' in event_dict:
            event_dict['source_ip'] = mask_ip_string(event_dict['source_ip'])
    return event_dict

# Register Threat Intel Blueprint
app.register_blueprint(threat_intel_bp)


# ==========================================
# GLOBAL ERROR HANDLERS (No tracebacks exposed)
# ==========================================
@app.errorhandler(HTTPException)
def handle_http_exception(e):
    response = jsonify({
        "error": e.name,
        "message": e.description
    })
    response.status_code = e.code
    response.headers['Content-Type'] = 'application/json'
    return response

@app.errorhandler(RateLimitExceeded)
def handle_rate_limit_exceeded(e):
    response = jsonify({
        "error": "Too Many Requests",
        "message": "Rate limit exceeded. Please try again later."
    })
    response.status_code = 429
    response.headers['Content-Type'] = 'application/json'
    return response

@app.errorhandler(Exception)
def handle_generic_exception(e):
    # Log internal trace only server-side
    app.logger.error(f"Unhandled Exception: {str(e)}", exc_info=True)
    response = jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred."
    })
    response.status_code = 500
    response.headers['Content-Type'] = 'application/json'
    return response


# ==========================================
# SECURITY HEADERS MIDDLEWARE
# ==========================================
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if response.headers.get('Content-Type') == 'application/json':
        response.headers['Cache-Control'] = 'no-store'
    # Pop Server header to hide server implementation
    response.headers.pop('Server', None)
    return response


# ==========================================
# SEEDING & DATABASE CREATION SETUP
# ==========================================
def initial_setup():
    with app.app_context():
        db.create_all()
        # Seed default data
        seed_default_users()
        seed_threat_intel()
        
        # Seed initial system settings
        if SystemSetting.query.filter_by(key='simulator_enabled').first() is None:
            db.session.add(SystemSetting(key='simulator_enabled', value='true'))
        if SystemSetting.query.filter_by(key='simulator_interval').first() is None:
            db.session.add(SystemSetting(key='simulator_interval', value='5'))
        db.session.commit()
        
        # Seed initial alerts, logs, incidents, and historical analyst data
        if Alert.query.first() is None:
            print("Seeding initial mock alert and historical incident data...")
            
            # Fetch users for assignments
            usr_analyst = User.query.filter_by(username='analyst').first()
            usr_responder = User.query.filter_by(username='responder').first()
            usr_admin = User.query.filter_by(username='admin').first()
            usr_engineer = User.query.filter_by(username='engineer').first()
            
            # Seed historical resolved/closed incidents (for MTTR and Analyst Leaderboard)
            historical_incidents = [
                {
                    'title': 'SQL Injection Containment Drill',
                    'desc': 'SQLi payload UNION SELECT detected targeting customer datastore from IP 185.220.101.5.',
                    'severity': 'Critical',
                    'status': 'Resolved',
                    'user': usr_responder,
                    'age_days': 4,
                    'duration_mins': 22,
                    'containment': 'External IP address blocked at Edge WAF. Input sanitization patch deployed.',
                    'notes': 'Database audit confirmed no unauthorized data was exposed during the scan.'
                },
                {
                    'title': 'SSH Auth Brute Force Block',
                    'desc': 'Multiple failed SSH login attempts (85 requests) from scanner IP 45.143.203.48.',
                    'severity': 'High',
                    'status': 'Closed',
                    'user': usr_analyst,
                    'age_days': 3,
                    'duration_mins': 12,
                    'containment': 'Source IP blacklisted via local iptables and fail2ban trigger.',
                    'notes': 'No successful logins detected during brute force interval.'
                },
                {
                    'title': 'Reconnaissance Scan Mitigation',
                    'desc': 'Host port scanning multiple open destination services from Tor Exit IP 185.220.101.5.',
                    'severity': 'Medium',
                    'status': 'Resolved',
                    'user': usr_responder,
                    'age_days': 5,
                    'duration_mins': 45,
                    'containment': 'Blocked inbound traffic from Tor exit node feed.',
                    'notes': 'Gateway rate limiter policies tightened.'
                },
                {
                    'title': 'Directory Traversal Exposure containment',
                    'desc': 'File traversal attempts /etc/passwd detected from IP 103.224.182.250.',
                    'severity': 'High',
                    'status': 'Resolved',
                    'user': usr_engineer,
                    'age_days': 2,
                    'duration_mins': 32,
                    'containment': 'Patched node web controller to sanitize path arguments.',
                    'notes': 'Code audits confirmed secure file download pathways.'
                },
                {
                    'title': 'Malicious C2 Domain Connection',
                    'desc': 'Endpoint resolved known malware control domain windows-updates-system.net.',
                    'severity': 'Critical',
                    'status': 'Closed',
                    'user': usr_responder,
                    'age_days': 6,
                    'duration_mins': 75,
                    'containment': 'Host isolated from corporate subnet. Active agent run quarantined payload.',
                    'notes': 'Target host re-imaged and credentials rotated.'
                },
                {
                    'title': 'XSS Attempt on Support Portal',
                    'desc': 'Script payload injected into public-facing feedback form from IP 91.240.118.22.',
                    'severity': 'Medium',
                    'status': 'Resolved',
                    'user': usr_analyst,
                    'age_days': 1,
                    'duration_mins': 18,
                    'containment': 'Sanitized database form records. Implemented CSP filters.',
                    'notes': 'Feedback forms now sanitize HTML tags before write.'
                }
            ]
            
            for item in historical_incidents:
                created = datetime.utcnow() - timedelta(days=item['age_days'])
                resolved = created + timedelta(minutes=item['duration_mins'])
                
                inc = Incident(
                    title=item['title'],
                    description=item['desc'],
                    severity=item['severity'],
                    status=item['status'],
                    assignee_id=item['user'].id if item['user'] else None,
                    created_at=created,
                    updated_at=resolved,
                    containment_strategy=item['containment'],
                    resolution_notes=item['notes']
                )
                db.session.add(inc)
                db.session.commit()
                
                # Seed matching alerts
                alert = Alert(
                    title=item['title'] + " Alert",
                    description=item['desc'],
                    severity=item['severity'],
                    category='SQL Injection' if 'SQL' in item['title'] else 'Brute Force' if 'Brute' in item['title'] else 'Port Scan' if 'Scan' in item['title'] else 'Directory Traversal' if 'Traversal' in item['title'] else 'XSS' if 'XSS' in item['title'] else 'Malicious IP',
                    source_ip='185.220.101.5' if '185' in item['desc'] else '45.143.203.48' if '45' in item['desc'] else '103.224.182.250' if '103' in item['desc'] else '91.240.118.22',
                    destination_ip='10.0.0.15',
                    status='Acknowledged',
                    mitre_technique='T1190' if 'SQL' in item['title'] else 'T1110.001' if 'Brute' in item['title'] else 'T1046' if 'Scan' in item['title'] else 'T1083' if 'Traversal' in item['title'] else 'T1203',
                    created_at=created,
                    incident_id=inc.id,
                    risk_score=75,
                    is_confirmed_threat=False
                )
                db.session.add(alert)
                db.session.commit()

            # Seed some active unresolved alerts and open incidents
            inc_open1 = Incident(
                title="Command Injection Vulnerability Active Exploit",
                description="Repeated command injections detected from threat intel IP 91.240.118.22.",
                severity="Critical",
                status="Under Investigation",
                assignee_id=usr_analyst.id,
                created_at=datetime.utcnow() - timedelta(hours=2),
                updated_at=datetime.utcnow()
            )
            inc_open2 = Incident(
                title="Endpoint Scan Activity detected",
                description="TCP sweep block from IP 45.143.203.48 targeting web subnets.",
                severity="Medium",
                status="Open",
                assignee_id=None,
                created_at=datetime.utcnow() - timedelta(hours=5),
                updated_at=datetime.utcnow()
            )
            db.session.add_all([inc_open1, inc_open2])
            db.session.commit()

            # Alerts linked to active incidents
            a1 = Alert(
                title="OS Command Injection Exploit Attempt",
                description="Command injection payload (; whoami) detected in parameter from IP 91.240.118.22.",
                severity="Critical",
                category="Command Injection",
                source_ip="91.240.118.22",
                destination_ip="10.0.0.15",
                mitre_technique="T1203",
                status="Active",
                created_at=datetime.utcnow() - timedelta(hours=2),
                incident_id=inc_open1.id,
                risk_score=90,
                is_confirmed_threat=True
            )
            a2 = Alert(
                title="Reconnaissance Port Scan",
                description="Port scan detected from 45.143.203.48 scanning ports 20-500.",
                severity="Medium",
                category="Port Scan",
                source_ip="45.143.203.48",
                destination_ip="10.0.0.15",
                mitre_technique="T1046",
                status="Active",
                created_at=datetime.utcnow() - timedelta(hours=5),
                incident_id=inc_open2.id,
                risk_score=50,
                is_confirmed_threat=False
            )
            # Add one unassigned active alert
            a3 = Alert(
                title="SQL Injection Exploit",
                description="SQLi pattern detected in query search parameter from Tor node 185.220.101.5.",
                severity="Critical",
                category="SQL Injection",
                source_ip="185.220.101.5",
                destination_ip="10.0.0.15",
                mitre_technique="T1190",
                status="Active",
                created_at=datetime.utcnow() - timedelta(minutes=45),
                risk_score=85,
                is_confirmed_threat=True
            )
            db.session.add_all([a1, a2, a3])
            db.session.commit()

            # Seed rich AttackEvents geographically
            countries_events = [
                ('United States', 'Washington D.C.', 38.9072, -77.0369, '103.224.182.250', 'SQL Injection'),
                ('United States', 'New York', 40.7128, -74.0060, '103.224.182.250', 'Brute Force'),
                ('China', 'Beijing', 39.9042, 116.4074, '185.220.101.5', 'SQL Injection'),
                ('Russia', 'Moscow', 55.7558, 37.6173, '91.240.118.22', 'Command Injection'),
                ('Russia', 'St. Petersburg', 59.9343, 30.3351, '91.240.118.22', 'Brute Force'),
                ('Germany', 'Frankfurt', 50.1109, 8.6821, '45.143.203.48', 'Port Scan'),
                ('Germany', 'Berlin', 52.5200, 13.4050, '45.143.203.48', 'Port Scan'),
                ('India', 'Mumbai', 19.0760, 72.8777, '82.102.23.41', 'Brute Force'),
                ('India', 'Bangalore', 12.9716, 77.5946, '82.102.23.41', 'XSS'),
                ('Brazil', 'Sao Paulo', -23.5505, -46.6333, '103.224.182.250', 'XSS'),
                ('Netherlands', 'Amsterdam', 52.3676, 4.9041, '185.220.101.5', 'SQL Injection'),
                ('Ukraine', 'Kyiv', 50.4501, 30.5234, '91.240.118.22', 'Command Injection'),
                ('United Kingdom', 'London', 51.5074, -0.1278, '82.102.23.41', 'Port Scan'),
                ('Canada', 'Toronto', 43.6532, -79.3832, '185.220.101.5', 'Directory Traversal')
            ]
            
            for i, item in enumerate(countries_events):
                country, city, lat, lon, ip, cat = item
                for j in range(random.randint(1, 6)):
                    db.session.add(AttackEvent(
                        type=cat,
                        source_ip=ip,
                        country=country,
                        city=city,
                        latitude=lat + random.uniform(-0.5, 0.5),
                        longitude=lon + random.uniform(-0.5, 0.5),
                        payload=f"Simulated {cat} traffic",
                        timestamp=datetime.utcnow() - timedelta(hours=random.randint(1, 48))
                    ))
            db.session.commit()

            # Seed initial raw logs
            l1 = LogEntry(log_source="Auth", message="Failed password for invalid user admin from 45.143.203.48 port 52344 ssh2", severity="Error", is_malicious=True)
            l2 = LogEntry(log_source="Web Server", message="GET /api/v1/users?search=admin'%20OR%20'1'='1 200 OK", severity="Warning", is_malicious=True)
            l3 = LogEntry(log_source="System", message="Service 'sentinel-agent' status running normally.", severity="Info", is_malicious=False)
            db.session.add_all([l1, l2, l3])
            db.session.commit()


# ==========================================
# AUTH ENDPOINTS
# ==========================================
@app.route('/api/auth/register', methods=['POST'])
@token_required
@role_required(['Administrator']) # Administrator only can register new users
def register(current_user):
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'message': 'Username, email and password are required'}), 400
        
    if User.query.filter_by(username=data['username']).first() or User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'User already exists'}), 400
        
    role = data.get('role', 'SOC Analyst')
    if role not in ['SOC Analyst', 'Security Engineer', 'Incident Responder', 'Administrator']:
        role = 'SOC Analyst'
        
    user = User(username=data['username'], email=data['email'], role=role)
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully!', 'user': user.to_dict()}), 201

# Support both login API pathways
@app.route('/api/login', methods=['POST'])
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute", key_func=get_remote_address) # Authentications limited strictly to 5 per minute per IP
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Username and password are required'}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        app.logger.warning(f"Failed login attempt for user: {data['username']} from {get_remote_address()}")
        return jsonify({'message': 'Invalid username or password'}), 401
        
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    token = generate_token(user)
    return jsonify({
        'token': token,
        'user': user.to_dict()
    })

@app.route('/api/logout', methods=['POST'])
@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    token = None
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
    if token:
        # Save token to invalidated list (denylist)
        existing = InvalidatedToken.query.filter_by(token=token).first()
        if not existing:
            invalid_entry = InvalidatedToken(token=token)
            db.session.add(invalid_entry)
            db.session.commit()
            
    return jsonify({'message': 'Logged out successfully!'})

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify(current_user.to_dict())

@app.route('/api/auth/users', methods=['GET'])
@token_required
def get_users(current_user):
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])

@app.route('/api/health', methods=['GET'])
@limiter.exempt # Exclude health check from rate limiter policies
def health_check():
    return jsonify({'status': 'healthy'}), 200


# ==========================================
# SECURITY DASHBOARD ENDPOINTS
# ==========================================
@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user):
    total_alerts = Alert.query.count()
    crit = Alert.query.filter_by(severity='Critical').count()
    high = Alert.query.filter_by(severity='High').count()
    med = Alert.query.filter_by(severity='Medium').count()
    low = Alert.query.filter_by(severity='Low').count()
    info = Alert.query.filter_by(severity='Informational').count()
    
    # Active incidents
    active_incidents = Incident.query.filter(Incident.status != 'Closed').count()
    
    # Advanced Security Posture Score Calculation
    open_crit_incidents = Incident.query.filter(Incident.status != 'Closed', Incident.severity == 'Critical').count()
    open_high_incidents = Incident.query.filter(Incident.status != 'Closed', Incident.severity == 'High').count()
    open_med_incidents = Incident.query.filter(Incident.status != 'Closed', Incident.severity == 'Medium').count()
    
    active_crit_alerts = Alert.query.filter_by(status='Active', severity='Critical').count()
    active_high_alerts = Alert.query.filter_by(status='Active', severity='High').count()
    active_med_alerts = Alert.query.filter_by(status='Active', severity='Medium').count()
    active_low_alerts = Alert.query.filter_by(status='Active', severity='Low').count()
    
    malicious_ips = [t.value for t in ThreatIntel.query.filter_by(indicator_type='IP').all()]
    active_threat_matches = Alert.query.filter(Alert.status == 'Active', Alert.source_ip.in_(malicious_ips)).count()
    
    deductions = (
        (open_crit_incidents * 15) + (open_high_incidents * 10) + (open_med_incidents * 4) +
        (active_crit_alerts * 5) + (active_high_alerts * 3) + (active_med_alerts * 1.5) + (active_low_alerts * 0.5) +
        (active_threat_matches * 2)
    )
    
    security_score = max(10, min(100, int(100 - deductions)))
    trend = "+2.4% (Improvement)" if security_score >= 80 else "-1.5% (Degradation)"
    
    # Calculate response stats
    resolved = Incident.query.filter(Incident.status.in_(['Resolved', 'Closed'])).all()
    response_times = [(r.updated_at - r.created_at).total_seconds() / 60.0 for r in resolved if r.updated_at]
    avg_mttr = sum(response_times) / len(response_times) if response_times else 25.0
    
    return jsonify({
        'alerts': {
            'total': total_alerts,
            'critical': crit,
            'high': high,
            'medium': med,
            'low': low,
            'informational': info
        },
        'active_incidents': active_incidents,
        'security_score': security_score,
        'posture_trend': trend,
        'mttd_seconds': 12.4,
        'mttr_minutes': round(avg_mttr, 1)
    })

@app.route('/api/dashboard/countries-stats', methods=['GET'])
@token_required
def get_countries_stats(current_user):
    results = db.session.query(
        AttackEvent.country,
        db.func.count(AttackEvent.id),
        db.func.avg(AttackEvent.latitude),
        db.func.avg(AttackEvent.longitude)
    ).group_by(AttackEvent.country).all()
    
    stats = []
    for row in results:
        country, count, lat, lon = row
        intensity = 'Critical' if count > 20 else 'High' if count > 8 else 'Medium'
        stats.append({
            'country': country,
            'count': count,
            'latitude': round(lat, 4) if lat else None,
            'longitude': round(lon, 4) if lon else None,
            'intensity': intensity
        })
        
    stats.sort(key=lambda x: x['count'], reverse=True)
    return jsonify(stats)

@app.route('/api/dashboard/posture-history', methods=['GET'])
@token_required
def get_posture_history(current_user):
    score_res = get_dashboard_stats.__wrapped__(current_user)
    current_score = score_res.get_json()['security_score']
    
    history = []
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    current_day_idx = datetime.utcnow().weekday()
    shifted_days = days[current_day_idx+1:] + days[:current_day_idx+1]
    
    base_scores = [85, 82, 88, 86, 91, 89, current_score]
    for i, d in enumerate(shifted_days):
        history.append({
            'day': d,
            'score': base_scores[i] if i < 6 else current_score
        })
    return jsonify(history)

@app.route('/api/dashboard/mitre-stats', methods=['GET'])
@token_required
def get_mitre_stats(current_user):
    mitre_techniques = {
        'T1190': {'tactic': 'Initial Access', 'technique': 'Exploit Public-Facing Application'},
        'T1595': {'tactic': 'Reconnaissance', 'technique': 'Active Scanning'},
        'T1046': {'tactic': 'Discovery', 'technique': 'Network Service Scanning'},
        'T1110.001': {'tactic': 'Credential Access', 'technique': 'Brute Force'},
        'T1203': {'tactic': 'Execution', 'technique': 'User Execution / XSS'},
        'T1083': {'tactic': 'Discovery', 'technique': 'File and Directory Discovery'}
    }
    
    stats = {}
    for tid, info in mitre_techniques.items():
        stats[tid] = {
            'id': tid,
            'technique': info['technique'],
            'tactic': info['tactic'],
            'count': 0,
            'severity': 'Info',
            'alerts': []
        }
        
    all_alerts = Alert.query.all()
    for a in all_alerts:
        tid = a.mitre_technique
        if tid in stats:
            stats[tid]['count'] += 1
            if a.status == 'Active':
                alert_dict = a.to_dict()
                mask_alert_response(alert_dict, current_user.role)
                stats[tid]['alerts'].append(alert_dict)
                if a.severity == 'Critical':
                    stats[tid]['severity'] = 'Critical'
                elif a.severity == 'High' and stats[tid]['severity'] != 'Critical':
                    stats[tid]['severity'] = 'High'
                elif a.severity == 'Medium' and stats[tid]['severity'] not in ['Critical', 'High']:
                    stats[tid]['severity'] = 'Medium'
                    
    return jsonify(list(stats.values()))

@app.route('/api/analyst/stats', methods=['GET'])
@token_required
def get_analyst_stats(current_user):
    total_incidents = Incident.query.count()
    resolved_incidents = Incident.query.filter(Incident.status.in_(['Resolved', 'Closed'])).all()
    resolved_count = len(resolved_incidents)
    
    durations = []
    sla_compliant_count = 0
    for inc in resolved_incidents:
        diff_mins = (inc.updated_at - inc.created_at).total_seconds() / 60.0
        durations.append(diff_mins)
        if diff_mins <= 60.0:
            sla_compliant_count += 1
            
    avg_mttr = sum(durations) / resolved_count if resolved_count > 0 else 25.0
    sla_compliance_rate = round((sla_compliant_count / resolved_count) * 100, 1) if resolved_count > 0 else 100.0
    
    users = User.query.all()
    leaderboard = []
    workload = []
    
    for u in users:
        resolved_by_u = Incident.query.filter(
            Incident.assignee_id == u.id, 
            Incident.status.in_(['Resolved', 'Closed'])
        ).all()
        
        resolved_u_count = len(resolved_by_u)
        u_durations = [(r.updated_at - r.created_at).total_seconds() / 60.0 for r in resolved_by_u if r.updated_at]
        u_avg_mttr = sum(u_durations) / resolved_u_count if resolved_u_count > 0 else 0
        u_sla_compliant = sum(1 for d in u_durations if d <= 60.0)
        u_sla = round((u_sla_compliant / resolved_u_count) * 100, 1) if resolved_u_count > 0 else 100.0
        
        leaderboard.append({
            'id': u.id,
            'username': u.username,
            'role': u.role,
            'resolved_count': resolved_u_count,
            'avg_response_mins': round(u_avg_mttr, 1),
            'sla_rate': u_sla
        })
        
        active_by_u = Incident.query.filter(
            Incident.assignee_id == u.id, 
            Incident.status.notin_(['Resolved', 'Closed'])
        ).count()
        
        workload.append({
            'username': u.username,
            'active_count': active_by_u
        })
        
    leaderboard.sort(key=lambda x: x['resolved_count'], reverse=True)
    
    return jsonify({
        'total_incidents': total_incidents,
        'resolved_count': resolved_count,
        'mttd_seconds': 12.4,
        'mttr_minutes': round(avg_mttr, 1),
        'sla_compliance_rate': sla_compliance_rate,
        'leaderboard': leaderboard,
        'workload': workload
    })

@app.route('/api/dashboard/timeline-events', methods=['GET'])
@token_required
def get_timeline_events(current_user):
    category = request.args.get('category')
    severity = request.args.get('severity')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # Input validation length constraints
    if category and len(category) > 50:
        category = category[:50]
    if severity and len(severity) > 20:
        severity = severity[:20]

    query = Alert.query
    if category:
        query = query.filter_by(category=category)
    if severity:
        query = query.filter_by(severity=severity)
    if start_date:
        try:
            dt = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(Alert.created_at >= dt)
        except ValueError:
            pass
    if end_date:
        try:
            dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Alert.created_at < dt)
        except ValueError:
            pass
            
    alerts = query.order_by(Alert.created_at.desc()).all()
    
    events = []
    for a in alerts:
        src = a.source_ip
        dest = a.destination_ip
        desc = a.description
        if current_user.role != 'Administrator':
            src = mask_ip_string(src)
            dest = mask_ip_string(dest)
            if desc:
                desc = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', lambda m: mask_ip_string(m.group(0)), desc)

        events.append({
            'id': a.id,
            'type': a.category,
            'severity': a.severity,
            'timestamp': a.created_at.isoformat(),
            'source_ip': src,
            'destination_ip': dest,
            'message': desc,
            'mitre': a.mitre_technique or 'N/A',
            'status': a.status,
            'risk_score': a.risk_score
        })
    return jsonify(events)

@app.route('/api/dashboard/threat-trends', methods=['GET'])
@token_required
def get_threat_trends(current_user):
    now = datetime.utcnow()
    trends = []
    
    for i in range(23, -1, -1):
        target_time = now - timedelta(hours=i)
        start_hour = target_time.replace(minute=0, second=0, microsecond=0)
        end_hour = start_hour + timedelta(hours=1)
        
        count = Alert.query.filter(Alert.created_at >= start_hour, Alert.created_at < end_hour).count()
        if count == 0 and random.random() < 0.2:
            count = random.randint(0, 1)
            
        trends.append({
            'time': start_hour.strftime('%H:%M'),
            'count': count
        })
        
    return jsonify(trends)

@app.route('/api/dashboard/attack-types', methods=['GET'])
@token_required
def get_attack_types(current_user):
    categories = ['Brute Force', 'SQL Injection', 'XSS', 'Port Scan', 'Directory Traversal', 'Command Injection', 'Suspicious User-Agent']
    distribution = []
    
    for cat in categories:
        count = Alert.query.filter_by(category=cat).count()
        distribution.append({
            'category': cat,
            'count': count
        })
    return jsonify(distribution)

@app.route('/api/dashboard/attack-map', methods=['GET'])
@token_required
def get_attack_map(current_user):
    events = AttackEvent.query.order_by(AttackEvent.timestamp.desc()).limit(50).all()
    dicts = [e.to_dict() for e in events]
    for d in dicts:
        mask_attack_event_response(d, current_user.role)
    return jsonify(dicts)

@app.route('/api/dashboard/timeline', methods=['GET'])
@token_required
def get_timeline(current_user):
    alerts = Alert.query.order_by(Alert.created_at.desc()).limit(15).all()
    incidents = Incident.query.order_by(Incident.created_at.desc()).limit(10).all()
    
    events = []
    for a in alerts:
        src = mask_ip_string(a.source_ip) if current_user.role != 'Administrator' else a.source_ip
        events.append({
            'type': 'alert',
            'id': a.id,
            'title': a.title,
            'severity': a.severity,
            'timestamp': a.created_at.isoformat(),
            'message': f"Detection engine flagged {a.category} from {src}"
        })
    for i in incidents:
        events.append({
            'type': 'incident',
            'id': i.id,
            'title': i.title,
            'severity': i.severity,
            'timestamp': i.created_at.isoformat(),
            'message': f"Incident '{i.title}' state changed to {i.status}"
        })
        
    events.sort(key=lambda x: x['timestamp'], reverse=True)
    return jsonify(events[:20])


# ==========================================
# ALERTS ENDPOINTS
# ==========================================
@app.route('/api/alerts', methods=['GET'])
@token_required
def get_alerts(current_user):
    severity = request.args.get('severity')
    status = request.args.get('status')
    category = request.args.get('category')
    
    # Input validation lengths
    if severity and len(severity) > 20:
        severity = severity[:20]
    if status and len(status) > 20:
        status = status[:20]
    if category and len(category) > 50:
        category = category[:50]

    query = Alert.query
    if severity:
        query = query.filter_by(severity=severity)
    if status:
        query = query.filter_by(status=status)
    if category:
        query = query.filter_by(category=category)
        
    alerts = query.order_by(Alert.created_at.desc()).all()
    dicts = [a.to_dict() for a in alerts]
    for d in dicts:
        mask_alert_response(d, current_user.role)
    return jsonify(dicts)

@app.route('/api/alerts/<int:alert_id>/acknowledge', methods=['POST'])
@token_required
def acknowledge_alert(current_user, alert_id):
    alert = Alert.query.get_or_404(alert_id)
    alert.status = 'Acknowledged'
    db.session.commit()
    d = alert.to_dict()
    mask_alert_response(d, current_user.role)
    return jsonify({'message': 'Alert acknowledged', 'alert': d})

@app.route('/api/alerts/<int:alert_id>/suppress', methods=['POST'])
@token_required
@role_required(['Security Engineer', 'Administrator'])
def suppress_alert(current_user, alert_id):
    alert = Alert.query.get_or_404(alert_id)
    alert.status = 'Suppressed'
    db.session.commit()
    d = alert.to_dict()
    mask_alert_response(d, current_user.role)
    return jsonify({'message': 'Alert suppressed', 'alert': d})

@app.route('/api/alerts/bulk-acknowledge', methods=['POST'])
@token_required
def bulk_acknowledge(current_user):
    Alert.query.filter_by(status='Active').update({Alert.status: 'Acknowledged'})
    db.session.commit()
    return jsonify({'message': 'All active alerts acknowledged.'})


# ==========================================
# INCIDENT RESPONSE ENDPOINTS
# ==========================================
@app.route('/api/incidents', methods=['GET'])
@token_required
def get_incidents(current_user):
    incidents = Incident.query.order_by(Incident.created_at.desc()).all()
    dicts = [i.to_dict() for i in incidents]
    
    # Mask Incident IP references
    for d in dicts:
        if current_user.role != 'Administrator' and d.get('description'):
            d['description'] = re.sub(
                r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
                lambda m: mask_ip_string(m.group(0)),
                d['description']
            )
    return jsonify(dicts)

@app.route('/api/incidents', methods=['POST'])
@token_required
def create_incident(current_user):
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'message': 'Incident title is required'}), 400
        
    title = html.escape(data['title'][:100])
    description = html.escape(data.get('description', '')[:500]) if data.get('description') else None
    
    incident = Incident(
        title=title,
        description=description,
        severity=data.get('severity', 'Medium'),
        status='Open',
        assignee_id=data.get('assignee_id')
    )
    db.session.add(incident)
    db.session.commit()
    
    alert_ids = data.get('alert_ids', [])
    if alert_ids:
        # Use parameterized parameters via list filtering
        Alert.query.filter(Alert.id.in_(alert_ids)).update({Alert.incident_id: incident.id}, synchronize_session=False)
        db.session.commit()
        
    return jsonify(incident.to_dict()), 201

@app.route('/api/incidents/<int:inc_id>', methods=['PUT'])
@token_required
def update_incident(current_user, inc_id):
    incident = Incident.query.get_or_404(inc_id)
    data = request.get_json()
    
    if 'status' in data:
        incident.status = data['status']
    if 'severity' in data:
        incident.severity = data['severity']
    if 'assignee_id' in data:
        uid = data['assignee_id']
        if uid == 'unassigned' or uid is None:
            incident.assignee_id = None
        else:
            usr = User.query.get(uid)
            if usr:
                incident.assignee_id = usr.id
    if 'description' in data:
        incident.description = html.escape(data['description'][:500])
    if 'containment_strategy' in data:
        incident.containment_strategy = html.escape(data['containment_strategy'][:500])
    if 'resolution_notes' in data:
        incident.resolution_notes = html.escape(data['resolution_notes'][:500])
        
    db.session.commit()
    return jsonify(incident.to_dict())


# ==========================================
# LOG EXPLORER ENDPOINTS
# ==========================================
@app.route('/api/logs', methods=['GET'])
@token_required
def get_logs(current_user):
    source = request.args.get('source')
    severity = request.args.get('severity')
    search = request.args.get('search')
    
    # Input validation length limits
    if source and len(source) > 30:
        source = source[:30]
    if severity and len(severity) > 20:
        severity = severity[:20]
    if search and len(search) > 100:
        search = search[:100]

    query = LogEntry.query
    if source:
        query = query.filter_by(log_source=source)
    if severity:
        query = query.filter_by(severity=severity)
    if search:
        # Use parameterized binds (safe from SQLi)
        query = query.filter(LogEntry.message.like(f"%{search}%") | LogEntry.raw_data.like(f"%{search}%"))
        
    logs = query.order_by(LogEntry.timestamp.desc()).limit(150).all()
    dicts = [l.to_dict() for l in logs]
    for d in dicts:
        mask_log_entry_response(d, current_user.role)
    return jsonify(dicts)


# ==========================================
# BLOCKLIST ENDPOINTS (Enhancement 1)
# ==========================================
@app.route('/api/blocklist', methods=['GET'])
@token_required
@role_required(['Administrator', 'Security Engineer'])
def get_blocklist(current_user):
    blocked_ips = BlockedIP.query.order_by(BlockedIP.blocked_at.desc()).all()
    dicts = [b.to_dict() for b in blocked_ips]
    for d in dicts:
        mask_blocked_ip_response(d, current_user.role)
    return jsonify(dicts)

@app.route('/api/blocklist', methods=['POST'])
@token_required
@role_required(['Administrator']) # Blocklist insertion restricted to Administrators
def add_to_blocklist(current_user):
    data = request.get_json()
    if not data or not data.get('ip_address'):
        return jsonify({'message': 'ip_address is required'}), 400
        
    ip = data['ip_address']
    # Validate IP address format using python ipaddress module
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        return jsonify({'message': 'Invalid IP address format'}), 400
        
    reason = data.get('reason', 'Manually blocked by administrator')
    if len(reason) > 255:
        reason = reason[:255]
        
    # Check if already exists
    existing = BlockedIP.query.filter_by(ip_address=ip).first()
    if existing:
        return jsonify({'message': 'IP address is already blocked'}), 400
        
    blocked_entry = BlockedIP(
        ip_address=ip,
        reason=html.escape(reason),
        auto_blocked=False
    )
    db.session.add(blocked_entry)
    db.session.commit()
    
    app.logger.warning(f"IP {ip} manually blocked by admin {current_user.username}")
    return jsonify({'message': 'IP successfully blocked', 'data': blocked_entry.to_dict()}), 201


# ==========================================
# LOG INGESTION ENDPOINT (Enhancement 5)
# ==========================================
APACHE_REGEX = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\S+)')
SQLI_INGEST_PATTERN = re.compile(r"(SELECT|UNION|DROP|INSERT|DELETE)", re.IGNORECASE)
TRAVERSAL_INGEST_PATTERN = re.compile(r"(\.\./|%2e%2e|%252e)", re.IGNORECASE)
XSS_INGEST_PATTERN = re.compile(r"(<script|alert\(|onerror=)", re.IGNORECASE)

@app.route('/api/ingest-logs', methods=['POST'])
@token_required
@limiter.limit("3 per minute", key_func=get_user_or_ip) # File uploads limited to 3 per minute per user
def ingest_logs(current_user):
    if 'file' not in request.files:
        return jsonify({'message': 'No file part in the request'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400
        
    # Path traversal prevention: strip directory components
    safe_filename = os.path.basename(file.filename)
    
    # Limit filename to alphanumeric + dash + underscore + dot only
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', safe_filename):
        return jsonify({'message': 'Invalid filename characters'}), 400
        
    # File extension validation (.log, .txt only)
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in ['.log', '.txt']:
        return jsonify({'message': 'Only .log and .txt files are allowed'}), 400
        
    try:
        # Check size before reading into memory (Limit: 5MB)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > 5 * 1024 * 1024:
            return jsonify({'message': 'File size exceeds maximum limit of 5MB'}), 400
            
        content_bytes = file.read()
        # Validate magic bytes: verify it decodes to valid UTF-8
        try:
            content_text = content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            return jsonify({'message': 'Invalid file format: Not a valid UTF-8 text file'}), 400
            
    except Exception:
        return jsonify({'message': 'Failed to parse file upload'}), 400
        
    # Write to a secure temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, mode='w+', encoding='utf-8')
    try:
        temp_file.write(content_text)
        temp_file.seek(0)
        
        total_lines = 0
        threats_detected = 0
        alerts_created = 0
        errors = []
        
        failed_logins = collections.defaultdict(int)
        
        for line in temp_file:
            total_lines += 1
            line = line.strip()
            if not line:
                continue
                
            match = APACHE_REGEX.match(line)
            if not match:
                continue
                
            ip = match.group(1)
            # IP validation
            try:
                ipaddress.ip_address(ip)
            except ValueError:
                continue
                
            path = match.group(4)
            status = int(match.group(5))
            
            # Threat parsing
            # 1. Failed Logins for Brute Force (401 or 403)
            if status in [401, 403]:
                failed_logins[ip] += 1
                
            # 2. SQL Injection
            if SQLI_INGEST_PATTERN.search(path):
                from rules import create_security_alert
                create_security_alert(
                    title="SQL Injection Exploit (Log Ingest)",
                    description=f"Ingested log matched SQLi payload targeting path {path} from IP {ip}",
                    severity="Critical",
                    category="SQL Injection",
                    src_ip=ip,
                    dest_ip="10.0.0.15",
                    mitre="T1190",
                    payload=line
                )
                threats_detected += 1
                alerts_created += 1
                
            # 3. Directory Traversal
            elif TRAVERSAL_INGEST_PATTERN.search(path):
                from rules import create_security_alert
                create_security_alert(
                    title="Directory Traversal Attempt (Log Ingest)",
                    description=f"Ingested log matched directory traversal targeting path {path} from IP {ip}",
                    severity="High",
                    category="Directory Traversal",
                    src_ip=ip,
                    dest_ip="10.0.0.15",
                    mitre="T1083",
                    payload=line
                )
                threats_detected += 1
                alerts_created += 1
                
            # 4. XSS
            elif XSS_INGEST_PATTERN.search(path):
                from rules import create_security_alert
                create_security_alert(
                    title="Cross-Site Scripting Exploit (Log Ingest)",
                    description=f"Ingested log matched XSS pattern targeting path {path} from IP {ip}",
                    severity="High",
                    category="XSS",
                    src_ip=ip,
                    dest_ip="10.0.0.15",
                    mitre="T1189",
                    payload=line
                )
                threats_detected += 1
                alerts_created += 1
                
        # Brute Force logic
        for ip, count in failed_logins.items():
            if count >= 5:
                from rules import create_security_alert
                create_security_alert(
                    title="SSH/Auth Brute Force Attack (Log Ingest)",
                    description=f"Log ingestion identified {count} failed auth requests from {ip}",
                    severity="High",
                    category="Brute Force",
                    src_ip=ip,
                    dest_ip="10.0.0.15",
                    mitre="T1110.001",
                    payload=f"Total failed requests: {count}"
                )
                threats_detected += 1
                alerts_created += 1
                
        return jsonify({
            'total_lines': total_lines,
            'threats_detected': threats_detected,
            'alerts_created': alerts_created,
            'errors': errors
        }), 201
        
    finally:
        # Secure deletion of the temporary file in all conditions
        temp_file.close()
        if os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass


# ==========================================
# NOTIFICATIONS ENDPOINTS
# ==========================================
@app.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications(current_user):
    notifs = Notification.query.filter_by(is_read=False).order_by(Notification.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifs])

@app.route('/api/notifications/read-all', methods=['POST'])
@token_required
def read_all_notifications(current_user):
    Notification.query.filter_by(is_read=False).update({Notification.is_read: True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'})


# ==========================================
# REPORTS ENDPOINTS
# ==========================================
@app.route('/api/reports', methods=['GET'])
@token_required
def get_reports(current_user):
    reports = Report.query.order_by(Report.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports])

@app.route('/api/reports/generate', methods=['POST'])
@token_required
def generate_report(current_user):
    data = request.get_json()
    if not data or not data.get('report_type') or not data.get('file_format'):
        return jsonify({'message': 'report_type and file_format are required'}), 400
        
    report_type = data['report_type']
    file_format = data['file_format']
    
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f"sentinelshield_{report_type.lower().replace(' ', '_')}_{timestamp}.{file_format.lower()}"
    filepath = os.path.join(app.root_path, 'reports_store', filename)
    
    # Call report generator
    from reporting import generate_csv_report, generate_excel_report, generate_pdf_report
    if file_format == 'CSV':
        generate_csv_report(report_type, filepath)
    elif file_format == 'Excel':
        generate_excel_report(report_type, filepath)
    elif file_format == 'PDF':
        generate_pdf_report(report_type, filepath)
    else:
        return jsonify({'message': 'Unsupported file format'}), 400
        
    report = Report(
        name=f"{report_type} Report - {datetime.utcnow().strftime('%Y-%m-%d')}",
        report_type=report_type,
        generated_by=current_user.username,
        file_path=filename,
        file_format=file_format
    )
    db.session.add(report)
    db.session.commit()
    
    return jsonify(report.to_dict()), 201

@app.route('/api/reports/download/<int:report_id>', methods=['GET'])
@token_required
def download_report(current_user, report_id):
    report = Report.query.get_or_404(report_id)
    filepath = os.path.join(app.root_path, 'reports_store', report.file_path)
    if not os.path.exists(filepath):
        return jsonify({'message': 'Report file not found'}), 404
        
    return send_file(filepath, as_attachment=True)


# ==========================================
# SYSTEM SETTINGS & SIMULATION TRIGGERS
# ==========================================
@app.route('/api/settings/simulator', methods=['GET', 'POST'])
@token_required
def get_set_simulator(current_user):
    if request.method == 'GET':
        enabled = SystemSetting.query.filter_by(key='simulator_enabled').first()
        interval = SystemSetting.query.filter_by(key='simulator_interval').first()
        
        return jsonify({
            'enabled': (enabled.value.lower() == 'true') if enabled else True,
            'interval': int(interval.value) if interval else 5
        })
    else:
        if current_user.role not in ['Security Engineer', 'Administrator']:
            return jsonify({'message': 'Admin or Engineer role required to change settings'}), 403
            
        data = request.get_json()
        if 'enabled' in data:
            val = 'true' if data['enabled'] else 'false'
            db.session.merge(SystemSetting(key='simulator_enabled', value=val))
        if 'interval' in data:
            db.session.merge(SystemSetting(key='simulator_interval', value=str(int(data['interval']))))
            
        db.session.commit()
        return jsonify({'message': 'Settings saved successfully'})

@app.route('/api/settings/simulator/trigger', methods=['POST'])
@token_required
@role_required(['Security Engineer', 'Administrator'])
def trigger_manual_attack(current_user):
    data = request.get_json()
    category = data.get('category', 'SQL Injection')
    
    attack_samples = {
        'SQL Injection': ("Web Server", "GET /api/v1/search?term=admin'+OR+1=1-- 200 OK", "Critical", 
                          "Host: sentinelshield.local\nUser-Agent: sqlmap/1.7.12\nCookie: auth=true"),
        'XSS': ("Web Server", "POST /api/v1/comments body=<script>alert(document.cookie)</script> 201 Created", "High", 
                "Host: sentinelshield.local\nUser-Agent: Chrome/120.0"),
        'Directory Traversal': ("Web Server", "GET /static/../../../../etc/passwd 403 Forbidden", "High", 
                               "Host: sentinelshield.local\nUser-Agent: Nikto/2.1.6"),
        'Command Injection': ("Web Server", "GET /api/ping?ip=8.8.8.8;whoami 200 OK", "Critical", 
                              "Host: sentinelshield.local\nUser-Agent: Chrome/120.0"),
        'Brute Force': ("Auth", "Failed password for root from 45.143.203.48 port 22 ssh2", "Error", "Brute force attack simulation"),
        'Port Scan': ("Security", "SYN scan detected: host 45.143.203.48 scanning ports 20-1000", "Warning", "Nmap SYN scan")
    }
    
    if category not in attack_samples:
        return jsonify({'message': 'Unknown attack type category'}), 400
        
    source, msg, severity, raw = attack_samples[category]
    ip = random.choice(MALICIOUS_IPS) if category != 'Brute Force' and category != 'Port Scan' else '45.143.203.48'
    formatted_msg = msg.replace("{ip}", ip)
    
    log = LogEntry(
        log_source=source,
        message=formatted_msg,
        severity=severity,
        raw_data=raw.replace("{ip}", ip) if raw else None,
        is_malicious=False
    )
    db.session.add(log)
    db.session.commit()
    
    # Process instantly
    analyze_and_detect(log)
    
    return jsonify({
        'message': f'Manual {category} simulated attack successfully triggered and logged!',
        'log': log.to_dict()
    })

@app.route('/api/settings/mitre', methods=['GET'])
@token_required
def get_mitre_mapping(current_user):
    mapping = [
        {'tactic': 'Initial Access', 'technique': 'Exploit Public-Facing Application', 'id': 'T1190', 'category': 'SQL Injection / Command Injection'},
        {'tactic': 'Reconnaissance', 'technique': 'Active Scanning', 'id': 'T1595', 'category': 'Suspicious User-Agent Scan'},
        {'tactic': 'Discovery', 'technique': 'Network Service Scanning', 'id': 'T1046', 'category': 'Port Scan'},
        {'tactic': 'Credential Access', 'technique': 'Brute Force', 'id': 'T1110', 'category': 'Auth Brute Force'},
        {'tactic': 'Execution', 'technique': 'User Execution / Scripting', 'id': 'T1203', 'category': 'XSS Execution'},
        {'tactic': 'Discovery', 'technique': 'File and Directory Discovery', 'id': 'T1083', 'category': 'Directory Traversal'}
    ]
    return jsonify(mapping)


# ==========================================
# ENTRY POINT
# ==========================================
MALICIOUS_IPS = ['185.220.101.5', '45.143.203.48', '91.240.118.22', '103.224.182.250', '82.102.23.41']

initial_setup()

if app.config['SIMULATOR_ENABLED']:
    from simulator import SecuritySimulator
    simulator = SecuritySimulator(app)
    simulator.start()

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5000, debug=False)
    finally:
        if simulator:
            simulator.stop()
