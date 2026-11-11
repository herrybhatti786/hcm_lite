# HCM Lite — AI-Assisted Human Capital Management

**Saylani Hackathon · Challenge Brief Solution**  
*Built for Admin, HR Executive, and Employees*

---

## 🌟 Executive Summary

**HCM Lite** is a production-grade, full-stack Human Capital Management web application engineered for the daily operations of modern organizations. Following the hackathon challenge specifications:
- **Starts Empty:** No dummy or hardcoded seed data. The database initializes completely blank.
- **Admin Setup:** The Admin creates the company, office rules, departments, leave quotas, holidays, geofence, and provisions the HR Executive account.
- **HR Operations:** The HR Executive registers employees (auto-creating their logins with temporary passwords), manages the daily attendance board, approves/rejects leave requests, and generates monthly payroll drafts.
- **Employee Self-Service:** Employees log in, change their temporary password, punch check-in/out (web or camera with face detection + GPS geofence), request attendance corrections, check leave balances, use Smart Leave, and download payslips.
- **AI Assistant:** Grounded directly in live database records using tool calling (`get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`). Features dashboard KPI summaries, natural language Smart Leave form pre-filling, company policy Q&A, and full support for both English and Roman Urdu.
- **Dynamic View (GSAP):** Built with **GSAP (GreenSock)** for smooth entrance animations, real-time KPI number rollups, animated modals, card staggering, and micro-interactions.

---

## 🛠️ Technology Stack & Libraries

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, **GSAP (GreenSock)**, Lucide React, jsPDF, Canvas Confetti |
| **Backend** | Node.js, Express, `sql.js` (Embedded WebAssembly SQLite), `jsonwebtoken`, `bcryptjs`, `geolib` |
| **Biometrics & Geofence** | HTML5 Camera stream, Face bounding box mesh, Geolocation API, Haversine formula |
| **AI Assistant** | Backend Tool Execution Engine, Natural Language Smart Leave Parser, Roman Urdu NLP |
| **Database** | Embedded SQLite (`hcm_lite.sqlite`) with ACID transactions and automatic persistence |

---

## 🚀 Quick Start (Judge Guide: Run in Under 2 Minutes)

### Prerequisites
- Node.js (v18+ or v20+ or v24+)
- npm

### 1. Start the Unified Server
```bash
cd "d:\My Work\antigravity project\hcm-lite"
npm start
```
The server will start at **http://localhost:5000** and automatically serve the GSAP-animated frontend and API.

*(Alternatively, to run the Vite dev server with hot reload:)*
```bash
npm run dev:frontend   # Runs on http://localhost:3000 (proxies /api to 5000)
```

---

## 📋 The 5-Minute Live Demo Script (Step-by-Step)

Judges can execute the exact 5-minute evaluation flow described in Section 9:

### Step 1: Fresh Install Setup (Admin)
1. Open `http://localhost:5000` in your browser.
2. The **First-Run Setup Wizard** will appear automatically.
3. Keep the pre-filled defaults or enter:
   - **Company Name:** `Saylani Tech Ventures`
   - **Admin Email:** `admin@company.com`
   - **Admin Password:** `AdminPassword123!`
   - **Office Start:** `09:00`, **Grace:** `15 min`, **Half Day:** `< 5h`, **Weekend:** `Saturday,Sunday`
   - **Office Lat/Lng:** `24.8607, 67.0011` (Zaitoon Ashraf IT Park), **Radius:** `150m`
4. Click **Complete First-Run Setup**. You will be logged in immediately to the **Admin Dashboard**.

### Step 2: Admin Creates Departments & HR Login
1. Go to **Organization Setup**:
   - In **Departments**, click **Add Department** (e.g. `Engineering`, Code: `ENG`).
   - In **HR Logins**, click **Create HR Executive**:
     - Email: `hr@company.com`
     - Password: `HrPassword123!`
2. Click **Logout** in the top right.

### Step 3: HR Registers Employees
1. Sign in as **HR**: `hr@company.com` / `HrPassword123!`.
2. Go to **Employees & Register** and click **Register Employee**:
   - First Name: `John`, Last Name: `Doe`
   - Email: `john.doe@company.com`
   - Department: `Engineering`
   - Basic Salary: `80000` *(Gross is auto-calculated as 1.5 × Basic = Rs. 120,000)*
   - Temporary Password: `Welcome@123`
3. Click **Register & Provision**. John Doe's profile and user login are generated.
4. Click **Logout**.

### Step 4: Employee Sign-In & Attendance Punch
1. Sign in as **Employee**: `john.doe@company.com` / `Welcome@123`.
2. You will be prompted with the **Password Change Required** modal.
3. Enter new password: `MyPassword123!` and confirm.
4. On **My Dashboard**, click **Web Punch** or the **Camera** icon.
   - The status changes to **Present (09:00 - On Time)**.
   - Trying to punch again immediately returns **409 Conflict** (duplicate check-in rejected).

### Step 5: Smart Leave in Natural Language & Roman Urdu
1. In the Smart Leave box on the Employee Dashboard, type:  
   `"Need next Monday and Tuesday off for my sister's wedding"`  
   *(or in Roman Urdu: `"Agli somwar aur mangal ko chutti chahiye behen ki shadi ke liye"`)*.
2. Click **Pre-Fill Leave**. The leave form opens with the dates, category (`Casual`), and reason pre-filled!
3. Click **Submit Application**. Notice working days are calculated skipping weekends & holidays.
4. Click **Logout**.

### Step 6: HR Approves Leave & Runs Monthly Payroll
1. Sign in as **HR**: `hr@company.com` / `HrPassword123!`.
2. Go to **Leave Approvals** and click **Approve** on John Doe's request with a comment.
3. Go to **HR Dashboard** and click **AI Summary** to get 3-5 real-time bullets from live KPIs.
4. Go to **Monthly Payroll Draft** and click **Generate Monthly Draft** for `2026-10`.
   - View the calculated Gross (`Rs. 120,000`), Tax Slabs, Payable Days, and Net Salary.
5. Click **Logout**.

### Step 7: Admin Locks Payroll & Reviews Audit Trail
1. Sign in as **Admin**: `admin@company.com` / `AdminPassword123!`.
2. Go to **Payroll & Finalize** and select the `2026-10` draft.
3. Click **Finalize & Lock Payroll**. The payroll run is permanently locked and cannot be edited. In-app notifications are broadcast to employees.
4. Go to **Audit Trail**: View every logged action with timestamps, actors, and click **View Diff** to inspect before/after JSON states.
5. Click **Logout**.

### Step 8: Employee Downloads Payslip & Security Check
1. Sign in as **Employee**: `john.doe@company.com` / `MyPassword123!`.
2. Go to **My Payslips** and click **View & PDF** to inspect and download the official PDF salary slip.
3. Open the **AI Assistant** (floating pill or navigation) and ask:  
   - `"What is Alice's salary?"` → **Refused:** *"Access denied. Employees can only view their own payroll data."*
   - `"Meri leave balance kitni hai?"` → Returns live casual leave balance (8 remaining out of 10).

---

## 🎯 25 Functionality Checklist Mapping

| # | Functionality | Role Allowed | Status | Implementation Details |
| :---: | :--- | :---: | :---: | :--- |
| **01** | First-run setup: company profile and Admin account | Admin | ✅ Done | Zero dummy data startup; interactive wizard |
| **02** | Login, logout, change password; role-based dashboards | All | ✅ Done | JWT auth, bcrypt, forced first-login password reset |
| **03** | Company settings: office hours, grace, location & radius | Admin (Edit) / HR (View) | ✅ Done | Geofence, start time 09:00, grace 15 min |
| **04** | Departments, designations, leave types, holidays | Admin (Edit) / HR (View) | ✅ Done | Full CRUD, employee counts per dept |
| **05** | Create HR logins; deactivate or reset any login | Admin | ✅ Done | Provisioning table with status toggle |
| **06** | Register employee & edit details | HR (Manage) / Admin (View) | ✅ Done | Auto code `EMP-001`, temporary login credentials |
| **07** | Employee directory with search, filters & 360 profile | All (Scoped) | ✅ Done | Server-side filter, 360 drawer with leaves & salary |
| **08** | CSV import with dry-run error report; CSV export | HR | ✅ Done | Row-by-row validation, duplicate checks, export |
| **09** | Web check-in & check-out | Employee / HR | ✅ Done | Server timestamped, duplicate check-in = 409 |
| **10** | Attendance calendar & daily attendance board | All (Scoped) | ✅ Done | Daily board filterable by date and dept |
| **11** | Attendance correction: request & approve | Employee / HR | ✅ Done | Employee requests with reason, HR approves/rejects |
| **12** | Apply for or cancel leave; balance & history | Employee / HR | ✅ Done | Quotas (14 Annual, 8 Sick, 10 Casual), cancel |
| **13** | Approve or reject leave with a comment | HR | ✅ Done | Approval inbox with notification dispatch |
| **14** | Salary structure per employee | HR | ✅ Done | Gross = 1.5×Basic (HRA 40%, Medical 10%) |
| **15** | Monthly payroll: create and review draft | HR | ✅ Done | Deducts absent + unpaid + 0.5 half-days + lates |
| **16** | Finalize payroll (locks month) | Admin | ✅ Done | Locked runs cannot be edited or recalculated |
| **17** | Payslips with PDF download | All (Scoped) | ✅ Done | High fidelity PDF download with jsPDF |
| **18** | Dashboards, KPIs, trends, and insight lists | Company / HR / Personal | ✅ Done | Admin, HR, and Employee tailored views |
| **19** | AI assistant chat answering from real data | All (Scoped) | ✅ Done | 7 database tools, strictly scoped by role |
| **20** | AI dashboard summary | Admin / HR | ✅ Done | 'Summarize' button generates 3-5 grounded bullets |
| **21** | Smart leave: natural language sentence to form | Employee / HR | ✅ Done | Extracts type, start/end dates, reason |
| **22** | Policy Q&A on attendance, leave & tax rules | All | ✅ Done | Answers from Section 3 specifications |
| **23** | Announcements | Admin & HR (Post) / All (Read) | ✅ Done | Priority tags (Normal, Important, Urgent) |
| **24** | In-app notifications | All (Scoped) | ✅ Done | Real-time alerts for leaves, payroll, notices |
| **25** | Audit log of actions with before/after JSON | Admin | ✅ Done | Immutable security log with state diff inspector |

---

## 🏆 Bonus Features Implemented (+10 Points)

1. **Camera Attendance with Face Detection + GPS Location:** Interactive webcam preview, client-side face bounding box detection, and server-side Haversine geofence verification (`geolib`).
2. **Late Penalty Rule:** 3 late arrivals automatically calculate a 0.5-day salary deduction during the monthly payroll draft.
3. **AI Understands Roman Urdu:** Natural language queries in Roman Urdu (e.g., *"Meri leave balance kitni hai?"*, *"Aaj koun absent hai?"*) are natively resolved.
4. **Dark Mode / Light Mode:** Built-in theme switch with persistent preference.
5. **GSAP Micro-Interactions & Animated View:** Seamless card entrance animations, rolling number counters for statistics, and fluid modal transitions.

---

## 🧪 Automated Test Suite

To run the automated verification script that executes all core HR flows and checks security guards:
```bash
npm test
```
Outputs green checkmarks for all 18 end-to-end integration steps!
