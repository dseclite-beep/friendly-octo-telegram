# ApexBilling - SaaS Subscription Ledger & Customer Analytics Dashboard

This is the development repository for **ApexBilling**, an enterprise SaaS billing console and analytics dashboard built using React (frontend), Node.js / Express (backend), and a PostgreSQL database layer.

## Project Overview

ApexBilling allows financial administrators to track user subscription revenue, manage pending/outstanding customer invoices across basic, pro, and enterprise tiers, and monitor platform logs.

---

## Active Issues & Requirements (To Be Resolved)

Before delivering this billing console to our client, several targeted bug fixes and feature additions must be carried out. The codebase is clean and structured. Please make clean changes without rewriting existing components.

### 1. [Bug] Login Redirect Instability (Frontend)
*   **Description**: After entering credentials and signing in, users are sometimes not redirected to the dashboard (occurring roughly 3 out of 10 times) and get bounced back or get stuck on the fallback route. This is a frontend-side timing/race condition issue.
*   **Scope**: Inspect the login verification routines and router transitions in `src/ApexBilling.jsx`.

### 2. [Bug] Dashboard Filtering Inaccuracy (Backend/API Query)
*   **Description**: Combining filters (e.g. Plan Tier and Payment Status) returns incorrect data lists due to a database query parameter evaluation error on the API endpoint.
*   **Scope**: Inspect the backend endpoints (specifically `/api/billing/overview` in `server/index.js`) to ensure parameter evaluations are correctly matching database records.

### 3. [Feature] CSV Export Button (Dashboard)
*   **Description**: Add a clean, simple "Export to CSV" button to the Invoice Ledger table on the dashboard so administrators can download the listed invoices directly as a `.csv` file.
*   **Scope**: Implement the CSV download parser and UI button mapping in `src/ApexBilling.jsx`.

### 4. [Regression] System Stability & Integration Checking
*   **Description**: A test suite must be included to run regression checks and ensure core operations (auth validation, invoice creation, deletion) remain stable.
*   **Scope**: Validate operations using `server/test_system.js`.

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
