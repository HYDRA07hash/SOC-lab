# SentinelShield API Documentation

This document describes the REST API endpoints exposed by the SentinelShield Python Flask backend.

All requests should be sent to the base URL: `http://localhost:5000`.

---

## Authentication Endpoints

### 1. User Registration
* **Endpoint**: `/api/auth/register`
* **Method**: `POST`
* **Request Payload**:
  ```json
  {
    "username": "operator1",
    "email": "operator1@sentinelshield.local",
    "password": "strongpassword123",
    "role": "SOC Analyst"
  }
  ```
  *(Allowed roles: `SOC Analyst`, `Security Engineer`, `Incident Responder`, `Administrator`)*
* **Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully!",
    "user": {
      "id": 5,
      "username": "operator1",
      "email": "operator1@sentinelshield.local",
      "role": "SOC Analyst",
      "created_at": "2026-06-20T23:55:00",
      "last_login": null
    }
  }
  ```

### 2. Operator Login
* **Endpoint**: `/api/auth/login`
* **Method**: `POST`
* **Request Payload**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@sentinelshield.local",
      "role": "Administrator",
      "created_at": "2026-06-20T18:00:00",
      "last_login": "2026-06-20T23:50:00"
    }
  }
  ```

---

## Security Dashboard Endpoints

*(All subsequent endpoints require a valid JWT passed in the HTTP Authorization header: `Authorization: Bearer <TOKEN>`)*

### 1. Fetch SOC Summary Metrics
* **Endpoint**: `/api/dashboard/stats`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  {
    "alerts": {
      "total": 35,
      "critical": 3,
      "high": 8,
      "medium": 12,
      "low": 10,
      "informational": 2
    },
    "active_incidents": 2,
    "security_score": 85
  }
  ```

### 2. Fetch Geo-IP Active Attacks Map Coordinates
* **Endpoint**: `/api/dashboard/attack-map`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "type": "SQL Injection",
      "source_ip": "185.220.101.5",
      "country": "Germany",
      "city": "Frankfurt",
      "latitude": 50.1109,
      "longitude": 8.6821,
      "payload": "UNION SELECT username, password",
      "timestamp": "2026-06-20T23:50:12"
    }
  ]
  ```

---

## Alert & Incident Management

### 1. Fetch Alarms Feed
* **Endpoint**: `/api/alerts`
* **Method**: `GET`
* **Query Parameters**:
  * `severity` (optional): `Critical`, `High`, `Medium`, `Low`
  * `status` (optional): `Active`, `Acknowledged`, `Suppressed`
  * `category` (optional): Filter by attack category.

### 2. Acknowledge Alarm
* **Endpoint**: `/api/alerts/<id>/acknowledge`
* **Method**: `POST`

### 3. Raise Incident Ticket
* **Endpoint**: `/api/incidents`
* **Method**: `POST`
* **Request Payload**:
  ```json
  {
    "title": "SQL Injection Containment",
    "description": "SQL Injection payload blocked from external IP 185.220.101.5 targeting customer datastore.",
    "severity": "Critical",
    "assignee_id": 2,
    "alert_ids": [12]
  }
  ```

---

## Threat Intelligence & Logs

### 1. IOC Blocklist Lookup
* **Endpoint**: `/api/threat-intel/lookup`
* **Method**: `GET`
* **Query Parameters**:
  * `value` (required): DNS Domain name, IPv4 Address, or File SHA256 Hash.
* **Response (200 OK)**:
  ```json
  {
    "found": true,
    "data": {
      "value": "185.220.101.5",
      "indicator_type": "IP",
      "reputation_score": 95,
      "threat_category": "Tor Exit Node",
      "description": "Tor Project exit node associated with automated SQL injection payloads."
    }
  }
  ```

### 2. Fetch System Audit Logs
* **Endpoint**: `/api/logs`
* **Method**: `GET`
* **Query Parameters**:
  * `source`: `Auth`, `Web Server`, `System`, `Security`, `Application`
  * `severity`: `Info`, `Warning`, `Error`, `Critical`
  * `search`: String keywords query filter.

---

## Advanced SOC Dashboard Endpoints

### 1. Fetch Heatmap Country Statistics
* **Endpoint**: `/api/dashboard/countries-stats`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  [
    {
      "country": "Germany",
      "count": 12,
      "latitude": 50.1109,
      "longitude": 8.6821,
      "intensity": "High"
    }
  ]
  ```

### 2. Fetch Posture Score History
* **Endpoint**: `/api/dashboard/posture-history`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  [
    { "day": "Mon", "score": 85 },
    { "day": "Tue", "score": 82 },
    { "day": "Wed", "score": 88 },
    { "day": "Thu", "score": 86 },
    { "day": "Fri", "score": 91 },
    { "day": "Sat", "score": 89 },
    { "day": "Sun", "score": 94 }
  ]
  ```

### 3. Fetch MITRE ATT&CK Matrix Statistics
* **Endpoint**: `/api/dashboard/mitre-stats`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  [
    {
      "id": "T1110.001",
      "technique": "Brute Force",
      "tactic": "Credential Access",
      "count": 15,
      "severity": "High",
      "alerts": [...]
    }
  ]
  ```

### 4. Fetch Analyst Performance Metrics
* **Endpoint**: `/api/analyst/stats`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  {
    "total_incidents": 24,
    "resolved_count": 18,
    "mttd_seconds": 12.4,
    "mttr_minutes": 22.5,
    "sla_compliance_rate": 94.4,
    "leaderboard": [
      { "username": "responder", "role": "Incident Responder", "resolved_count": 10, "avg_response_mins": 15.2, "sla_rate": 100.0 }
    ],
    "workload": [
      { "username": "analyst", "active_count": 3 }
    ]
  }
  ```

### 5. Fetch Chronological Timeline Events
* **Endpoint**: `/api/dashboard/timeline-events`
* **Method**: `GET`
* **Query Parameters**:
  * `category` (optional): Filter by attack type category.
  * `severity` (optional): Filter by severity.
  * `start_date` (optional): ISO format date filter (YYYY-MM-DD).
  * `end_date` (optional): ISO format date filter.

