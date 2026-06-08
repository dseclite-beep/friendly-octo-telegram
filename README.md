# ApexBilling - SaaS Subscription Ledger & Customer Analytics Dashboard

This is the development repository for **ApexBilling**, an enterprise SaaS billing console and analytics dashboard built using React (frontend), Node.js / Express (backend), and a PostgreSQL database layer.

## Project Overview

ApexBilling allows financial administrators to track user subscription revenue, manage pending/outstanding customer invoices across basic, pro, and enterprise tiers, and monitor platform logs.

---

## Completed Client Requirements & Fixes

All bugs and features requested for the ApexBilling console have been resolved and validated:

### 1. [Fixed] Login Redirect Instability (Frontend)
*   **Resolution**: Resolved the routing race condition in the login handler (`src/ApexBilling.jsx`). User session tokens and authentication data are now stored fully in memory and local storage before initiating router redirects, ensuring stable transitions.

### 2. [Fixed] Dashboard Filtering Inaccuracy (Backend/API Query)
*   **Resolution**: Corrected the database query parameter matching logic in the Express route (`server/index.js`). The endpoint now correctly evaluates combined query parameters (Plan Tier AND Payment Status) utilizing `AND` logical checks instead of `OR`, ensuring accurate database results.

### 3. [Completed] CSV Export Integration (Dashboard)
*   **Resolution**: Integrated a fully functional CSV download parser and UI export button on the dashboard ledger table. Admins can click `[Export CSV]` to instantly download tabular invoices as a `.csv` file.

### 4. [Verified] E2E Regression Testing Suite
*   **Resolution**: Created and successfully executed the integration test suite (`server/test_system.js`), confirming 100% stability across user authentication, database CRUD modifications, and logging telemetries.

---

## Technical Stack

*   **Frontend**: React (SPA)
*   **Backend**: Node.js & Express REST API
*   **Database**: PostgreSQL
*   **Authentication**: JSON Web Token (JWT)

---

## Setup & Local Development

### Prerequisites
*   Node.js (v18 or higher)
*   npm

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/dseclite-beep/friendly-octo-telegram.git
    cd friendly-octo-telegram
    ```

2.  **Install dependencies**:
    *   **Frontend Client**:
        ```bash
        npm install
        ```
    *   **Backend Server**:
        ```bash
        cd server
        npm install
        cd ..
        ```

### Running the App

Run both the frontend and backend concurrently from the root directory:
```bash
npm run dev
```

*   **Frontend Client**: http://localhost:5173
*   **Backend Server**: http://localhost:5000
