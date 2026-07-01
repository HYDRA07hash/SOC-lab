# SentinelShield User Manual & Operator Guide

Welcome to the SentinelShield Security Operations Center (SOC) Console. This guide helps security analysts and engineers investigate incidents.

---

## 1. Operating the Dashboard

The dashboard provides real-time security posture scoring.

* **Security Score (Posture)**: Ranging from 15 to 100. Every active high/critical severity alert deducts points. Resolving/closing incident tickets restores the posture health score.
* **Intrusion Target Map**: Displays active geographic origins of attacks. Hovering over a dot reveals the attacker's simulated IP, city, country, and attack vector category.
* **Active Attack Stream**: Chronological audit feed displaying real-time events.

---

## 2. Escallating Alarms (Incidents Handling)

When an alert is flagged by the IDS or Web Protection modules:

1. Open **Alert Manager** to view raw logs.
2. If an alert warrants investigation (e.g. repeated SQL Injection attempts):
   * Click **Briefcase** next to the alert row to trigger an escalation.
   * This auto-generates a ticket containing the alert correlations.
3. Switch to **Incident Center**:
   * Assign the ticket to an investigator (e.g. `responder`).
   * Transition state to `Under Investigation` or `Contained`.
   * Add notes on firewall rules applied to block the IP.
4. Mark the incident as `Resolved` once threat mitigations are complete.

---

## 3. Threat Hunting & IOC Lookups

When looking up suspicious indicators (from firewall logs or emails):

1. Navigate to **Threat Intel**.
2. Type an IP, Domain, or File hash (SHA256) into the search box.
3. SentinelShield queries the threat intelligence feeds database.
4. Results show reputational scores (above 75 indicate highly dangerous assets) and category (e.g. Botnet, Malware C2).
5. If you confirm an IP is malicious, use the **Append Malicious IOC** form (requires Administrator/Security Engineer roles) to sync it to the global blocklist.
