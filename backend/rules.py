import re
import os
import requests
import threading
import ipaddress
import time
import smtplib
import logging
import html
import random
from datetime import datetime, timedelta
from database import db
from models import LogEntry, Alert, Notification, AttackEvent, BlockedIP

# Setup logger
logger = logging.getLogger(__name__)

# Common web attack regex patterns
SQLI_PATTERN = re.compile(
    r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|WHERE|OR|AND)\b)|(['\"].*?\b(OR|AND)\b.*?['\"]?\s*=\s*['\"]?)|(--)|(/\*)|(;\s*SHUTDOWN)", 
    re.IGNORECASE
)
XSS_PATTERN = re.compile(
    r"(<script.*?>.*?</script>)|(javascript:)|(onerror\s*=)|(onload\s*=)|(eval\(.*?[\'\"])|(<iframe.*?>)", 
    re.IGNORECASE
)
TRAVERSAL_PATTERN = re.compile(
    r"(\.\./)|(\.\.\\)|(/etc/passwd)|(boot\.ini)|(win\.ini)|(system\.ini)", 
    re.IGNORECASE
)
CMD_INJECTION_PATTERN = re.compile(
    r"(;\s*whoami)|(\|\s*whoami)|(&\s*whoami)|(;\s*cat\s+)|(;\s*dir\b)|(\bcmd\.exe\b)|(\b/bin/sh\b)|(\b/bin/bash\b)|(;\s*rm\s+-rf)", 
    re.IGNORECASE
)
SUSPICIOUS_UA_PATTERN = re.compile(
    r"(sqlmap|nmap|nikto|hydra|dirbuster|acunetix|nessus|gobuster|w3af|openvas)", 
    re.IGNORECASE
)

# Email address format validation pattern
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

# Thread-safe cache structure for AbuseIPDB check results
abuse_cache = {}
cache_lock = threading.Lock()

# Mock GEO-IP Data
GEO_MOCK_POOL = [
    {"country": "United States", "city": "Washington D.C.", "lat": 38.9072, "lon": -77.0369},
    {"country": "China", "city": "Beijing", "lat": 39.9042, "lon": 116.4074},
    {"country": "Russia", "city": "Moscow", "lat": 55.7558, "lon": 37.6173},
    {"country": "Germany", "city": "Frankfurt", "lat": 50.1109, "lon": 8.6821},
    {"country": "Brazil", "city": "Sao Paulo", "lat": -23.5505, "lon": -46.6333},
    {"country": "India", "city": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"country": "United Kingdom", "city": "London", "lat": 51.5074, "lon": -0.1278},
    {"country": "Netherlands", "city": "Amsterdam", "lat": 52.3676, "lon": 4.9041},
    {"country": "Ukraine", "city": "Kyiv", "lat": 50.4501, "lon": 30.5234},
    {"country": "Canada", "city": "Toronto", "lat": 43.6532, "lon": -79.3832}
]

def mask_ip_address(ip):
    """
    Mask last two octets of IP (e.g. 192.168.x.x) for non-admin/logged feeds.
    """
    parts = ip.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.x.x"
    return "xxx.xxx.x.x"

def check_ip_blocked(ip):
    """
    Check if IP exists in BlockedIP list.
    """
    try:
        blocked = BlockedIP.query.filter_by(ip_address=ip).first()
        return blocked is not None
    except Exception as e:
        logger.error(f"Error querying blocked IPs database: {e}")
        return False

def check_abuseipdb(ip_address):
    """
    Query AbuseIPDB API with strict input verification, timeouts, and caches.
    """
    try:
        ip_obj = ipaddress.ip_address(ip_address)
    except ValueError:
        return 0

    # Reject private or loopback IP range checks
    if ip_obj.is_private or ip_obj.is_loopback:
        return 0

    api_key = os.environ.get('ABUSEIPDB_API_KEY')
    if not api_key:
        logger.warning("ABUSEIPDB_API_KEY missing from environment variables, check skipped.")
        return 0

    # Thread-safe memory cache lookups
    now = time.time()
    with cache_lock:
        if ip_address in abuse_cache:
            score, expiry = abuse_cache[ip_address]
            if now < expiry:
                return score
            else:
                del abuse_cache[ip_address]

    # API Request check
    try:
        url = 'https://api.abuseipdb.com/api/v2/check'
        headers = {
            'Accept': 'application/json',
            'Key': api_key
        }
        params = {
            'ipAddress': ip_address,
            'maxAgeInDays': '90'
        }
        # Timeout restricted to 5 seconds
        response = requests.get(url, headers=headers, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            score = data.get('data', {}).get('abuseConfidenceScore', 0)
        else:
            score = 0
    except Exception as e:
        logger.error("Error communicating with AbuseIPDB endpoint.")
        score = 0

    # Cache response
    with cache_lock:
        if len(abuse_cache) >= 1000:
            # Evict oldest entry
            oldest_key = next(iter(abuse_cache))
            del abuse_cache[oldest_key]
        abuse_cache[ip_address] = (score, now + 3600) # Cache for 1 hour

    return score

def calculate_risk(category, src_ip, abuse_score=0):
    """
    Calculate risk scoring (0-100) dynamically.
    """
    base_scores = {
        'SQL Injection': 70,
        'Brute Force': 65,
        'Command Injection': 80,
        'XSS': 55,
        'Directory Traversal': 60,
        'Port Scan': 40
    }
    score = base_scores.get(category, 50)

    # +15 if same IP triggered 3+ alerts in last 5 minutes
    try:
        time_threshold = datetime.utcnow() - timedelta(minutes=5)
        recent_alerts_count = Alert.query.filter(
            Alert.source_ip == src_ip,
            Alert.created_at >= time_threshold
        ).count()
        if recent_alerts_count >= 3:
            score += 15
    except Exception as e:
        logger.error(f"Error querying alert count for risk calculation: {e}")

    # +10 if alert timestamp is between 00:00 and 06:00 UTC
    now_hour = datetime.utcnow().hour
    if 0 <= now_hour < 6:
        score += 10

    # +20 if AbuseIPDB confirms threat (score > 50)
    if abuse_score > 50:
        score += 20

    return min(score, 100)

def send_alert_email_async(attack_type, ip, timestamp, risk_score, severity):
    """
    Asynchronously dispatches emails for critical vulnerabilities (risk >= 85) without blocking execution threads.
    """
    sender = os.environ.get('ALERT_EMAIL_SENDER')
    password = os.environ.get('ALERT_EMAIL_PASSWORD')
    receiver = os.environ.get('ALERT_EMAIL_RECEIVER')

    if not sender or not password or not receiver:
        logger.warning("SMTP credentials missing from environment, email alert skipped.")
        return

    if not EMAIL_REGEX.match(receiver):
        logger.warning(f"Invalid alert receiver address format: {receiver}")
        return

    # Mask IP for safety (no raw IP in subject to prevent header injection)
    masked_ip = mask_ip_address(ip)

    body = (
        f"SentinelShield Security Alert - [CRITICAL THREAT]\n"
        f"===============================================\n"
        f"Attack Type: {attack_type}\n"
        f"Source IP: {masked_ip}\n"
        f"Timestamp: {timestamp} (UTC)\n"
        f"Risk Score: {risk_score}/100\n"
        f"Severity: {severity}\n"
    )

    from email.mime.text import MIMEText
    msg = MIMEText(body, 'plain')
    msg['From'] = sender
    msg['To'] = receiver
    msg['Subject'] = f"[CRITICAL] SentinelShield Alert - {attack_type}"

    def send_thread():
        try:
            with smtplib.SMTP('smtp.gmail.com', 587, timeout=10) as server:
                server.starttls()
                server.login(sender, password)
                server.sendmail(sender, [receiver], msg.as_string())
            logger.info("Critical alert email successfully dispatched.")
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")

    thread = threading.Thread(target=send_thread)
    thread.daemon = True
    thread.start()

def get_mock_geo(ip):
    try:
        parts = ip.split('.')
        idx = int(parts[-1]) % len(GEO_MOCK_POOL)
        return GEO_MOCK_POOL[idx]
    except Exception:
        return random.choice(GEO_MOCK_POOL)

def analyze_and_detect(log_entry):
    """
    Scans a log entry to run rule-based intrusion and web protection checks.
    """
    message = log_entry.message
    source = log_entry.log_source
    ip_match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", message)
    src_ip = ip_match.group(1) if ip_match else "192.168.1." + str(random.randint(2, 254))
    dest_ip = "10.0.0.15"

    # Validate IP address format
    try:
        ipaddress.ip_address(src_ip)
    except ValueError:
        logger.warning(f"Skipping log analysis due to invalid IP format: {src_ip}")
        return

    alert_created = False

    # 1. WEB SECURITY RULES
    if source == "Web Server":
        payload = log_entry.raw_data or message
        if SQLI_PATTERN.search(payload):
            create_security_alert(
                title="SQL Injection Attack Attempt",
                description=f"SQLi payload detected in web request from {src_ip}. Payload: {payload[:200]}",
                severity="Critical",
                category="SQL Injection",
                src_ip=src_ip,
                dest_ip=dest_ip,
                mitre="T1190",
                payload=payload
            )
            alert_created = True
        elif XSS_PATTERN.search(payload):
            create_security_alert(
                title="Cross-Site Scripting (XSS) Attempt",
                description=f"Malicious XSS script injection detected from {src_ip}. Payload: {payload[:200]}",
                severity="High",
                category="XSS",
                src_ip=src_ip,
                dest_ip=dest_ip,
                mitre="T1189",
                payload=payload
            )
            alert_created = True
        elif TRAVERSAL_PATTERN.search(payload):
            create_security_alert(
                title="Directory Traversal Attempt",
                description=f"Directory traversal attack path detected from {src_ip}. File requested: {payload[:200]}",
                severity="High",
                category="Directory Traversal",
                src_ip=src_ip,
                dest_ip=dest_ip,
                mitre="T1083",
                payload=payload
            )
            alert_created = True
        elif CMD_INJECTION_PATTERN.search(payload):
            create_security_alert(
                title="Command Injection Attempt",
                description=f"Remote OS command execution pattern detected from {src_ip}.",
                severity="Critical",
                category="Command Injection",
                src_ip=src_ip,
                dest_ip=dest_ip,
                mitre="T1203",
                payload=payload
            )
            alert_created = True
        elif SUSPICIOUS_UA_PATTERN.search(payload):
            ua = re.search(r"User-Agent: ([^\n\r]+)", payload)
            ua_str = ua.group(1) if ua else "Scanner Tool"
            create_security_alert(
                title="Automated Vulnerability Scan Detected",
                description=f"Security scanning tool detected via User-Agent from {src_ip}. User-Agent: {ua_str}",
                severity="Medium",
                category="Suspicious User-Agent",
                src_ip=src_ip,
                dest_ip=dest_ip,
                mitre="T1595.002",
                payload=ua_str
            )
            alert_created = True

    # 2. INTRUSION DETECTION RULES (Brute Force / Port Scan)
    elif source == "Auth":
        if "Failed password" in message or "Failed login" in message or "Authentication failure" in message:
            time_threshold = datetime.utcnow() - timedelta(minutes=1)
            recent_failures = LogEntry.query.filter(
                LogEntry.log_source == 'Auth',
                LogEntry.timestamp >= time_threshold,
                LogEntry.message.like(f"%{src_ip}%"),
                (LogEntry.message.like("%Failed%") | LogEntry.message.like("%failure%"))
            ).count()

            if recent_failures >= 5:
                recent_alert = Alert.query.filter(
                    Alert.category == 'Brute Force',
                    Alert.source_ip == src_ip,
                    Alert.created_at >= time_threshold
                ).first()

                if not recent_alert:
                    create_security_alert(
                        title="SSH/Auth Brute Force Attack",
                        description=f"Multiple failed authentications ({recent_failures}) from {src_ip} in under 1 minute.",
                        severity="High",
                        category="Brute Force",
                        src_ip=src_ip,
                        dest_ip=dest_ip,
                        mitre="T1110.001",
                        payload=message
                    )
                    alert_created = True

    elif source == "Security" or source == "System":
        if "Port Scan" in message or "scan" in message.lower() or "connection sweep" in message.lower():
            create_security_alert(
                title="Reconnaissance Port Scan Detected",
                description=f"Host scanning multiple destination ports detected from {src_ip}.",
                severity="Medium",
                category="Port Scan",
                src_ip=src_ip,
                dest_ip=dest_ip,
                mitre="T1046",
                payload=message
            )
            alert_created = True

    if alert_created:
        log_entry.is_malicious = True
        db.session.commit()

def create_security_alert(title, description, severity, category, src_ip, dest_ip, mitre, payload):
    # Escape user-controlled string inputs before storing
    title = html.escape(title)
    description = html.escape(description)
    category = html.escape(category)
    mitre = html.escape(mitre) if mitre else None
    payload = html.escape(payload) if payload else None

    # Check if IP address is currently blocked
    is_blocked = check_ip_blocked(src_ip)
    status = 'blocked' if is_blocked else 'Active'

    # 1. Query AbuseIPDB for IP reputation score
    abuse_score = check_abuseipdb(src_ip)
    is_confirmed = (abuse_score > 50)

    # 2. Compute dynamic Risk Score
    risk = calculate_risk(category, src_ip, abuse_score)

    # Save the Alert
    alert = Alert(
        title=title,
        description=description,
        severity=severity,
        category=category,
        source_ip=src_ip,
        destination_ip=dest_ip,
        mitre_technique=mitre,
        status=status,
        risk_score=risk,
        is_confirmed_threat=is_confirmed
    )
    db.session.add(alert)
    db.session.commit()

    # Save a Notification (Mask IP for safety)
    notif = Notification(
        message=f"[{severity.upper()}] SentinelShield detected {title} from {mask_ip_address(src_ip)}",
        notification_type="Dashboard",
        is_read=False
    )
    db.session.add(notif)
    db.session.commit()

    # Save an Attack Event (Geo Map)
    geo = get_mock_geo(src_ip)
    evt = AttackEvent(
        type=category,
        source_ip=src_ip,
        country=geo["country"],
        city=geo["city"],
        latitude=geo["lat"],
        longitude=geo["lon"],
        payload=payload
    )
    db.session.add(evt)
    db.session.commit()

    # 3. Trigger Email Alert if risk score >= 85
    if risk >= 85:
        send_alert_email_async(category, src_ip, alert.created_at.strftime('%Y-%m-%d %H:%M:%S'), risk, severity)

    # 4. Check auto block threshold (if IP generated > 5 alerts in the last 60 seconds)
    try:
        time_threshold = datetime.utcnow() - timedelta(seconds=60)
        recent_alert_count = Alert.query.filter(
            Alert.source_ip == src_ip,
            Alert.created_at >= time_threshold
        ).count()
        if recent_alert_count >= 5:
            # Check if not already blocked
            existing = BlockedIP.query.filter_by(ip_address=src_ip).first()
            if not existing:
                new_block = BlockedIP(
                    ip_address=src_ip,
                    reason="Auto-blocked: Exceeded 5 alerts in 60 seconds",
                    auto_blocked=True
                )
                db.session.add(new_block)
                db.session.commit()
                logger.warning(f"Auto-blocked IP address: {src_ip}")
    except Exception as e:
        logger.error(f"Error checking or creating auto-block: {e}")
