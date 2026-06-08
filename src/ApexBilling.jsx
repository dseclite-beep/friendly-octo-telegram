import React, { useState, useEffect } from "react";

export default function ApexBilling() {
  const [screen, setScreen] = useState("login"); // 'login' or 'dashboard'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("apexbilling_token"));
  
  // Dashboard states
  const [invoices, setInvoices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    outstandingAmount: 0,
    activeSubscriptions: 0,
    churnRate: "0.0%"
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  // New Invoice Form
  const [newCust, setNewCust] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPlan, setNewPlan] = useState("Pro");
  const [newAmount, setNewAmount] = useState("");
  const [newStatus, setNewStatus] = useState("pending");
  const [formMsg, setFormMsg] = useState("");

  // Auto-login configuration profiles (Mock accounts)
  const mockProfiles = [
    { name: "Lucas Vance (Admin)", email: "billing_admin@apexbilling.com", pw: "Admin@123" },
    { name: "Sophia Martinez (Manager)", email: "finance_manager@apexbilling.com", pw: "Manager@123", recommended: true },
    { name: "Liam Thompson (Support)", email: "support_agent@apexbilling.com", pw: "Support@123" }
  ];

  // Fetch overview data from Express backend
  const fetchOverview = async (authToken) => {
    const activeToken = authToken || token;
    if (!activeToken) return;

    try {
      const queryParams = new URLSearchParams();
      if (statusFilter) queryParams.append("status", statusFilter);
      if (planFilter) queryParams.append("plan", planFilter);

      const res = await fetch(`/api/billing/overview?${queryParams.toString()}`, {
        headers: {
          "Authorization": `Bearer ${activeToken}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
        setLogs(data.logs);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching overview data:", err);
    }
  };

  // Check auth session on load
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setScreen("login");
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setScreen("dashboard");
        } else {
          handleLogout();
        }
      } catch (err) {
        handleLogout();
      }
    };
    verifyAuth();
  }, [token]);

  // Refetch when filters change
  useEffect(() => {
    if (screen === "dashboard") {
      fetchOverview();
    }
  }, [statusFilter, planFilter, screen]);

  // --- LOGIN HANDLER (WITH INTRODUCED TIMING BUG) ---
  const handleLogin = async (e, customCredentials) => {
    if (e) e.preventDefault();
    setError("");

    const targetEmail = customCredentials ? customCredentials.email : email;
    const targetPassword = customCredentials ? customCredentials.pw : password;

    if (!targetEmail || !targetPassword) {
      setError("Please fill out all credentials.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, pw: targetPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login credentials invalid.");
        return;
      }

      // Write token to storage
      localStorage.setItem("apexbilling_token", data.token);

      // --- TIMING / RACE-CONDITION BUG ---
      // To simulate route redirect instability (fails about 3 out of 10 times)
      const randomTrigger = Math.random();
      if (randomTrigger < 0.3) {
        // BUG: Transition screens immediately before state variables are successfully populated,
        // causing authentication guards to fail route verification and bounce users back.
        setScreen("dashboard");
        setTimeout(() => {
          setToken(data.token);
          setUser(data.user);
        }, 80);
      } else {
        // Safe pathway (70% probability)
        setToken(data.token);
        setUser(data.user);
        setScreen("dashboard");
      }
    } catch (err) {
      setError("Connection failure to ApexBilling servers.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("apexbilling_token");
    setToken(null);
    setUser(null);
    setScreen("login");
  };

  // Create Invoice
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setFormMsg("");

    if (!newCust || !newEmail || !newAmount) {
      setFormMsg("Error: All fields are required.");
      return;
    }

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customer: newCust,
          email: newEmail,
          plan: newPlan,
          amount: parseFloat(newAmount),
          status: newStatus
        })
      });

      if (res.ok) {
        setFormMsg("Success: Invoice added to database.");
        setNewCust("");
        setNewEmail("");
        setNewAmount("");
        fetchOverview();
      } else {
        const data = await res.json();
        setFormMsg(`Error: ${data.error}`);
      }
    } catch (err) {
      setFormMsg("Error: Failed to contact billing server.");
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id, invoiceNo) => {
    if (!confirm(`Are you sure you want to remove invoice ${invoiceNo}?`)) return;

    try {
      const res = await fetch(`/api/invoices/${id}/delete`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        fetchOverview();
      }
    } catch (err) {
      console.error("Failed to delete invoice:", err);
    }
  };

  // --- CSV EXPORT HANDLER ---
  const handleExportCSV = () => {
    if (invoices.length === 0) {
      alert("No data available to export.");
      return;
    }

    // CSV Headers
    const headers = ["Invoice No", "Customer Name", "Customer Email", "Plan", "Amount ($)", "Status", "Issue Date", "Due Date"];
    
    // CSV Rows
    const rows = invoices.map(inv => [
      inv.invoiceNo,
      `"${inv.customer.replace(/"/g, '""')}"`, // escape quotes
      inv.email,
      inv.plan,
      inv.amount.toFixed(2),
      inv.status.toUpperCase(),
      inv.issued,
      inv.due
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `apexbilling_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Login screen
  if (screen === "login") {
    return (
      <div className="app-container login-layout">
        <div className="login-card">
          <div className="logo-box">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" style={{ width: 28, height: 28, color: "#fff" }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>APEXBILLING</h2>
          <p className="subtitle">Enterprise Subscription Ledger</p>

          <form onSubmit={(e) => handleLogin(e)}>
            <div className="input-group">
              <label>Console Email</label>
              <input 
                type="email" 
                placeholder="billing_admin@apexbilling.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            <div className="input-group">
              <label>Passcode</label>
              <input 
                type="password" 
                placeholder="••••••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="login-btn">Establish Connection</button>
          </form>

          <div className="mock-gateway">
            <h3>Mock Authorization Gateway</h3>
            <p className="gateway-desc">Select a profile to bypass manual entry (reproduces redirect bug 30% of the time):</p>
            <div className="profiles-grid">
              {mockProfiles.map((p, idx) => (
                <button 
                  key={idx} 
                  className={`profile-shortcut-btn ${p.recommended ? "recommended" : ""}`}
                  onClick={() => handleLogin(null, p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="app-container dashboard-layout">
      {/* Header bar */}
      <header className="dash-header">
        <div className="brand-area">
          <div className="logo-box small">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16, color: "#fff" }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="brand-text">
            <h1>ApexBilling // System Console</h1>
            <p>Admin: {user?.name || "Initializing..."} ({user?.role || "user"})</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="system-status">
            <span className="pulse-dot"></span>
            Database: Online
          </div>
          <button className="logout-btn" onClick={handleLogout}>Disconnect Session</button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dash-content">
        {/* Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card revenue">
            <div className="m-label">Total Revenue (Paid)</div>
            <div className="m-value">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="metric-card subscriptions">
            <div className="m-label">Active Subscriptions</div>
            <div className="m-value">{stats.activeSubscriptions}</div>
          </div>
          <div className="metric-card outstanding">
            <div className="m-label">Outstanding Invoices</div>
            <div className="m-value">${stats.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="metric-card churn">
            <div className="m-label">System Churn Rate</div>
            <div className="m-value">{stats.churnRate}</div>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="workspace-grid">
          {/* Left Panel: Invoices Ledger */}
          <div className="ledger-panel card">
            <div className="panel-header">
              <div className="header-titles">
                <h2>Invoice Ledger</h2>
                <p>Manage subscriber billing states and plans</p>
              </div>
              <div className="header-controls">
                <button className="export-btn" onClick={handleExportCSV}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
              <div className="filter-select">
                <label>Filter Plan</label>
                <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                  <option value="">All Plans</option>
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
              <div className="filter-select">
                <label>Filter Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              {(planFilter || statusFilter) && (
                <button className="clear-filters-btn" onClick={() => { setPlanFilter(""); setStatusFilter(""); }}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Invoices Table */}
            <div className="table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer Details</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th style={{ textAlign: "right" }}>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length > 0 ? (
                    invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="inv-no">{inv.invoiceNo}</td>
                        <td>
                          <div className="cust-name">{inv.customer}</div>
                          <div className="cust-email">{inv.email}</div>
                        </td>
                        <td><span className="plan-badge">{inv.plan}</span></td>
                        <td className="inv-amount">${inv.amount.toFixed(2)}</td>
                        <td>
                          <span className={`status-badge ${inv.status}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="inv-date">{inv.issued}</td>
                        <td style={{ textAlign: "right" }}>
                          <button 
                            className="delete-row-btn" 
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNo)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-row">No invoice records match current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel: Operations Logs & Creator Form */}
          <div className="ops-panel">
            {/* Create Invoice Card */}
            <div className="create-invoice-card card">
              <h2>Invoice Registry Form</h2>
              <p className="card-desc">Post a new customer bill to the database ledger</p>
              
              <form onSubmit={handleCreateInvoice}>
                <div className="form-group">
                  <label>Customer Name</label>
                  <input 
                    type="text" 
                    placeholder="Acme Corp" 
                    value={newCust} 
                    onChange={(e) => setNewCust(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Billing Email</label>
                  <input 
                    type="email" 
                    placeholder="finance@acme.com" 
                    value={newEmail} 
                    onChange={(e) => setNewEmail(e.target.value)} 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group half">
                    <label>Plan Tier</label>
                    <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="form-group half">
                    <label>Amount ($)</label>
                    <input 
                      type="number" 
                      placeholder="299.00" 
                      value={newAmount} 
                      onChange={(e) => setNewAmount(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Payment Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                {formMsg && (
                  <div className={`form-feedback ${formMsg.startsWith("Success") ? "success" : "error"}`}>
                    {formMsg}
                  </div>
                )}

                <button type="submit" className="submit-invoice-btn">Submit Ledger Record</button>
              </form>
            </div>

            {/* Live Audit Stream */}
            <div className="audit-card card">
              <div className="panel-header">
                <h2>Security & Audit Telemetry</h2>
              </div>
              <div className="log-stream-wrapper">
                {logs.length > 0 ? (
                  logs.map((log, idx) => (
                    <div key={idx} className="log-line">
                      <span className="log-time">{log.ts}</span>
                      <span className={`log-level ${log.lvl.toLowerCase()}`}>[{log.lvl}]</span>
                      <span className="log-text">{log.msg}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-logs">No telemetry data streamed.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="dash-footer">
        APEXBILLING LEDGER CONTROL PANEL v1.4 · JSON-ORM BACKEND ENGINE · 2026
      </footer>
    </div>
  );
}
