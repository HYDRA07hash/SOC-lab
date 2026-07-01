# SentinelShield Test Cases & Scenarios

This document specifies the validation test cases for verifying SentinelShield capabilities.

---

## Test Suite 1: Authentication & RBAC Checks

### TC-1.1: Default Seeding Check
* **Objective**: Verify default role accounts are seeded and accessible.
* **Pre-conditions**: Clean database initialized.
* **Procedure**:
  1. Navigate to `http://localhost:80` (or local Vite server port).
  2. Click the quick-fill button for **Administrator** (`admin` / `admin123`).
  3. Click "Initialize Interface".
* **Expected Result**: Login succeeds; user session is initialized, and Sidebar indicates "Administrator" role.

### TC-1.2: RBAC Restriction Validation
* **Objective**: Confirm that non-engineers cannot access simulation triggers.
* **Pre-conditions**: Logged in as `analyst` (`analyst123`).
* **Procedure**:
  1. Switch to **System Settings** view.
  2. Attempt to toggle the Simulator switch or click manual attack triggers.
* **Expected Result**: Toggle controls are disabled or request returns a `403 Forbidden` API message.

---

## Test Suite 2: Intrusion Detection Rules (IDS)

### TC-2.1: SSH Brute Force Detection
* **Objective**: Verify brute force authentication triggers a High-severity alert.
* **Procedure**:
  1. Go to **System Settings**.
  2. Click the **Brute Force** manual injection trigger button.
  3. Go to **IDS Monitor** or **Alert Manager**.
* **Expected Result**: A new High-severity alert titled `SSH/Auth Brute Force Attack` appears with the source IP flagged.

### TC-2.2: Web Application Attacks Detections
* **Objective**: Verify regex patterns flag SQL Injection attempts.
* **Procedure**:
  1. In **System Settings**, click **SQL Injection** manual injection trigger button.
  2. Switch to **Web Protection** tab.
* **Expected Result**: A Critical alert for `SQL Injection Attack Attempt` is displayed. The threat mitigation card displays parameterized queries advice.

---

## Test Suite 3: Incident Lifecycle & Workflows

### TC-3.1: Raise & Contain Incident Escapes
* **Objective**: Verify full lifecycle ticket tracking of an alert.
* **Procedure**:
  1. Open **Alert Manager**. Find an active Critical alert.
  2. Click the **Briefcase** (Raise Incident) icon next to the alert actions.
  3. Validate that the UI redirects to the **Incident Center** with the ticket pre-populated.
  4. Change status from `Open` to `Under Investigation`, select an assignee (e.g. `responder`), add quarantine notes, and click "Commit Incident Updates".
* **Expected Result**: Incident is successfully updated in the DB and matches the new lifecycle state.
