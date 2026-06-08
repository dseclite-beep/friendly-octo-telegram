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

  // Manager projection state
  const [projectedNewSubs, setProjectedNewSubs] = useState(10);

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

  // --- LOGIN HANDLER ---
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

      // Set user session state fully before transitioning the screen to prevent routing race conditions
      setToken(data.token);
      setUser(data.user);
      setScreen("dashboard");
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

    if (!newEmail.includes("@") || !newEmail.includes(".")) {
      setFormMsg("Error: Please enter a valid email address.");
      return;
    }

    if (parseFloat(newAmount) <= 0 || isNaN(parseFloat(newAmount))) {
      setFormMsg("Error: Amount must be a positive number.");
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

  // Delete Invoice (Only allowed for Admin)
  const handleDeleteInvoice = async (id, invoiceNo) => {
    if (user?.role !== "admin") {
      alert("Unauthorized: Only billing administrators can delete invoices.");
      return;
    }

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
      Number(inv.amount || 0).toFixed(2),
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

  // Dynamic Manager Stats
  const basicCount = invoices.filter(i => i.plan === "Basic").length;
  const proCount = invoices.filter(i => i.plan === "Pro").length;
  const entCount = invoices.filter(i => i.plan === "Enterprise").length;
  const totalCount = invoices.length || 1;
  const basicPct = Math.round((basicCount / totalCount) * 100);
  const proPct = Math.round((proCount / totalCount) * 100);
  const entPct = Math.round((entCount / totalCount) * 100);

  const averageAmount = invoices.length > 0 
    ? (invoices.reduce((sum, i) => sum + i.amount, 0) / invoices.length) 
    : 299;

  // Filter logs for Support role to prevent showing sensitive telemetry (like security rate limits or system warnings)
  const displayLogs = user?.role === "support"
    ? logs.filter(log => !log.msg.toLowerCase().includes("rate limit") && !log.msg.toLowerCase().includes("failed login"))
    : logs;

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
            <p>Session: <strong>{user?.name || "Initializing..."}</strong> · <span style={{ color: "#34d399", fontWeight: 700 }}>{(user?.role || "user").toUpperCase()}</span></p>
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
        {/* Metrics Grid (Conditional based on role) */}
        {user?.role === "support" ? (
          <div className="metrics-grid">
            <div className="metric-card tickets">
              <div className="m-label">Active Support Tickets</div>
              <div className="m-value">14</div>
            </div>
            <div className="metric-card sla">
              <div className="m-label">Avg Response SLA</div>
              <div className="m-value">8.5m</div>
            </div>
            <div className="metric-card csat">
              <div className="m-label">CSAT Satisfaction</div>
              <div className="m-value">98.4%</div>
            </div>
            <div className="metric-card inquiries">
              <div className="m-label">Billing Inquiries</div>
              <div className="m-value">3</div>
            </div>
          </div>
        ) : (
          <div className="metrics-grid">
            <div className="metric-card revenue">
              <div className="m-label">Total Revenue (Paid)</div>
              <div className="m-value">${Number(stats.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="metric-card subscriptions">
              <div className="m-label">Active Subscriptions</div>
              <div className="m-value">{stats.activeSubscriptions || 0}</div>
            </div>
            <div className="metric-card outstanding">
              <div className="m-label">Outstanding Invoices</div>
              <div className="m-value">${Number(stats.outstandingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="metric-card churn">
              <div className="m-label">System Churn Rate</div>
              <div className="m-value">{stats.churnRate}</div>
            </div>
          </div>
        )}

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
                    {user?.role === "admin" && <th style={{ textAlign: "right" }}>Control</th>}
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
                        <td className="inv-amount">${Number(inv.amount || 0).toFixed(2)}</td>
                        <td>
                          <span className={`status-badge ${inv.status}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="inv-date">{inv.issued}</td>
                        {user?.role === "admin" && (
                          <td style={{ textAlign: "right" }}>
                            <button 
                              className="delete-row-btn" 
                              onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNo)}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={user?.role === "admin" ? "7" : "6"} className="empty-row">No invoice records match current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel: Operations Logs & Creator Form (Conditional based on role) */}
          <div className="ops-panel">
            {/* ADMIN VIEW */}
            {user?.role === "admin" && (
              <>
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

                <div className="audit-card card">
                  <div className="panel-header">
                    <h2>Security & Audit Telemetry</h2>
                  </div>
                  <div className="log-stream-wrapper">
                    {displayLogs.length > 0 ? (
                      displayLogs.map((log, idx) => (
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
              </>
            )}

            {/* MANAGER VIEW */}
            {user?.role === "manager" && (
              <>
                <div className="card">
                  <h2>Subscription Tier Analysis</h2>
                  <p className="card-desc">Active subscriber distributions across billing plans</p>
                  
                  <div className="tier-distribution-list">
                    <div className="tier-item">
                      <div className="tier-header-info">
                        <span className="tier-label">Basic Plan ($49/mo)</span>
                        <span className="tier-stats">{basicCount} users ({basicPct}%)</span>
                      </div>
                      <div className="tier-meter-bar">
                        <div className="tier-meter-fill" style={{ width: `${basicPct}%` }}></div>
                      </div>
                    </div>
                    <div className="tier-item">
                      <div className="tier-header-info">
                        <span className="tier-label">Pro Plan ($299/mo)</span>
                        <span className="tier-stats">{proCount} users ({proPct}%)</span>
                      </div>
                      <div className="tier-meter-bar">
                        <div className="tier-meter-fill" style={{ width: `${proPct}%` }}></div>
                      </div>
                    </div>
                    <div className="tier-item">
                      <div className="tier-header-info">
                        <span className="tier-label">Enterprise Plan ($1,200/mo)</span>
                        <span className="tier-stats">{entCount} users ({entPct}%)</span>
                      </div>
                      <div className="tier-meter-bar">
                        <div className="tier-meter-fill" style={{ width: `${entPct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card projection-card">
                  <h2>Financial MRR Simulator</h2>
                  <p className="card-desc">Simulate revenue growth by adding new subscribers</p>
                  
                  <div className="slider-container">
                    <label className="form-group label">Add Projected Subscribers: <strong>+{projectedNewSubs}</strong></label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={projectedNewSubs} 
                      onChange={(e) => setProjectedNewSubs(parseInt(e.target.value))} 
                      className="slider-control"
                    />
                  </div>

                  <div className="projection-results">
                    <div className="proj-item">
                      <span className="proj-label">Current Revenue</span>
                      <span className="proj-val">${Number(stats.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="proj-item">
                      <span className="proj-label">Est. Value (Avg: ${Math.round(averageAmount)}/sub)</span>
                      <span className="proj-val">+${Number(projectedNewSubs * averageAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="proj-item">
                      <span className="proj-label">Projected Monthly Revenue</span>
                      <span className="proj-val highlight">${Number(stats.totalRevenue + (projectedNewSubs * averageAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SUPPORT VIEW */}
            {user?.role === "support" && (
              <>
                <div className="card support-welcome-card">
                  <h3>Support Center Workspace</h3>
                  <p>Logged in as Customer Support. Use this workspace to review billing status and resolve customer inquiries. You can add customer invoices using the form below.</p>
                  <div className="support-actions-row">
                    <button className="support-action-btn" onClick={() => alert("Payment reminder emails dispatched to all pending accounts!")}>Send Reminders</button>
                    <button className="support-action-btn" onClick={() => alert("Ticket cache purged. Syncing with ZenDesk/Intercom...")}>Sync Helpdesk</button>
                  </div>
                </div>

                <div className="create-invoice-card card">
                  <h2>Customer Invoice Creator</h2>
                  <p className="card-desc">Log a customer transaction into the ledger database</p>
                  
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

                <div className="audit-card card">
                  <div className="panel-header">
                    <h2>Customer Operations Log</h2>
                  </div>
                  <div className="log-stream-wrapper">
                    {displayLogs.length > 0 ? (
                      displayLogs.map((log, idx) => (
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
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="dash-footer">
        APEXBILLING LEDGER CONTROL PANEL v1.4 · JSON-ORM BACKEND ENGINE · 2026
      </footer>
    </div>
  );
}
