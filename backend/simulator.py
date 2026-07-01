import time
import random
import threading
from datetime import datetime
from database import db
from models import LogEntry, SystemSetting
from rules import analyze_and_detect

# Mocks
MALICIOUS_IPS = ['185.220.101.5', '45.143.203.48', '91.240.118.22', '103.224.182.250', '82.102.23.41']
BENIGN_IPS = ['192.168.1.15', '192.168.1.50', '192.168.1.102', '10.0.0.8', '172.16.5.4']

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
]

SCANNERS_UA = [
    'sqlmap/1.7.12#stable (https://sqlmap.org)',
    'Nmap Scripting Engine; https://nmap.org/book/nse.html',
    'Nikto/2.1.6',
    'Mozilla/5.0 (compatible; Nessus/10.4.1; +https://www.tenable.com)'
]

BENIGN_LOGS = [
    ("Web Server", "GET /index.html 200 OK", "Info", "User-Agent: {ua}"),
    ("Web Server", "GET /assets/logo.png 200 OK", "Info", "User-Agent: {ua}"),
    ("Web Server", "GET /api/v1/system/status 200 OK", "Info", "User-Agent: {ua}"),
    ("Auth", "Successful login for user 'analyst' from {ip} via SSH", "Info", "SSHv2 Connection"),
    ("Auth", "Successful login for user 'engineer' from {ip} via Web Dashboard", "Info", "HTTPS Session established"),
    ("System", "Service 'sentinel-agent' status running normally.", "Info", None),
    ("System", "Disk space utilization at 42%.", "Info", None),
    ("Application", "Background security reporting scheduler invoked.", "Info", None)
]

MALICIOUS_ATTACKS = [
    # SQLi
    ("Web Server", "GET /api/v1/users?search=admin'%20OR%20'1'='1 200 OK", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}\nCookie: session=active"),
    ("Web Server", "POST /api/auth/login username=admin&password=foo'%20UNION%20SELECT%201,username,password_hash%20FROM%20users%20-- 401 Unauthorized", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}\nContent-Length: 110"),
    
    # XSS
    ("Web Server", "POST /api/v1/tickets/comments body=<script>alert('xss')</script> 201 Created", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}\nContent-Type: application/json"),
    ("Web Server", "GET /dashboard?search=<iframe%20src=\"javascript:alert(1)\"> 200 OK", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}"),
    
    # Directory Traversal
    ("Web Server", "GET /api/files?download=../../../../etc/passwd 403 Forbidden", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}"),
    ("Web Server", "GET /static/../../win.ini 404 Not Found", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}"),
    
    # Command Injection
    ("Web Server", "GET /api/v1/tools/ping?host=8.8.8.8;%20whoami 200 OK", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}"),
    ("Web Server", "GET /api/v1/admin/shell?cmd=cat%20/etc/passwd%20|%20grep%20root 500 Error", "Warning", 
     "Host: sentinelshield.local\nUser-Agent: {ua}"),

    # Suspicious User Agents
    ("Web Server", "GET /login.php 200 OK", "Info", "User-Agent: {scanner_ua}"),
    ("Web Server", "GET /wp-admin/ 404 Not Found", "Info", "User-Agent: {scanner_ua}"),

    # Intrusion logs (System/IDS logs showing scans and login brute forces)
    ("Auth", "Failed password for invalid user admin from {ip} port 52344 ssh2", "Error", "Failed login"),
    ("Auth", "Failed login attempt from IP {ip} using username 'root'", "Error", "HTTP login fail"),
    ("Security", "Port Scan detected from {ip} scanning ports 21, 22, 23, 25, 80, 443, 8080", "Warning", "Nmap SYN scan"),
    ("System", "Unauthorized access attempt blocked on admin endpoint from IP {ip}", "Error", "IP Blocked")
]

class SecuritySimulator:
    def __init__(self, app):
        self.app = app
        self._thread = None
        self._stop_event = threading.Event()
        
    def start(self):
        # Seed initial status if missing
        with self.app.app_context():
            enabled_setting = SystemSetting.query.filter_by(key='simulator_enabled').first()
            if not enabled_setting:
                db.session.add(SystemSetting(key='simulator_enabled', value='true'))
                db.session.commit()
                
            interval_setting = SystemSetting.query.filter_by(key='simulator_interval').first()
            if not interval_setting:
                db.session.add(SystemSetting(key='simulator_interval', value='5'))
                db.session.commit()
                
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        print("Security simulator thread started.")
        
    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2)
            
    def _run(self):
        # We need to run inside application context for SQLAlchemy
        with self.app.app_context():
            while not self._stop_event.is_set():
                try:
                    # Read setting from database
                    enabled = SystemSetting.query.filter_by(key='simulator_enabled').first()
                    interval_val = SystemSetting.query.filter_by(key='simulator_interval').first()
                    
                    is_enabled = enabled.value.lower() == 'true' if enabled else True
                    sleep_interval = int(interval_val.value) if interval_val else 5
                    
                    if is_enabled:
                        # Decide: 70% chance of benign traffic, 30% chance of threat/attack
                        if random.random() < 0.7:
                            self._generate_benign()
                        else:
                            self._generate_attack()
                            
                    time.sleep(sleep_interval)
                except Exception as e:
                    print(f"Error in simulation cycle: {e}")
                    time.sleep(10) # wait before retrying on error

    def _generate_benign(self):
        source, msg, severity, raw_tpl = random.choice(BENIGN_LOGS)
        ip = random.choice(BENIGN_IPS)
        ua = random.choice(USER_AGENTS)
        
        formatted_msg = msg.replace("{ip}", ip)
        formatted_raw = raw_tpl.format(ua=ua) if raw_tpl else None
        
        log = LogEntry(
            log_source=source,
            message=formatted_msg,
            severity=severity,
            raw_data=formatted_raw,
            is_malicious=False
        )
        db.session.add(log)
        db.session.commit()

    def _generate_attack(self):
        source, msg, severity, raw_tpl = random.choice(MALICIOUS_ATTACKS)
        # Attacks mostly originate from threat intel list to showcase aggregator matches
        ip = random.choice(MALICIOUS_IPS)
        ua = random.choice(USER_AGENTS)
        scanner = random.choice(SCANNERS_UA)
        
        formatted_msg = msg.replace("{ip}", ip)
        formatted_raw = None
        if raw_tpl:
            formatted_raw = raw_tpl.replace("{ua}", ua).replace("{scanner_ua}", scanner).replace("{ip}", ip)
            
        log = LogEntry(
            log_source=source,
            message=formatted_msg,
            severity=severity,
            raw_data=formatted_raw,
            is_malicious=False  # rules engine will set this to True if it matches
        )
        db.session.add(log)
        db.session.commit()
        
        # Invoke Rule Detections
        analyze_and_detect(log)
