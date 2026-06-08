import React, { useState, useEffect } from "react";

export default function ApexBilling() {
  const [screen, setScreen] = useState("login"); // 'login' or 'dashboard'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("apexbilling_token"));
  
  // Dashboard & Navigation states
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard', 'settings', 'profile'
  const [theme, setTheme] = useState(() => localStorage.getItem("apexbilling_theme") || "light");
  
  // Dynamic datasets from API
  const [mockProfiles, setMockProfiles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    outstandingAmount: 0,
    activeSubscriptions: 0,
    churnRate: "0.0%",
    activeTickets: 0,
    avgResponseTime: "0m",
    csat: "0.0%",
    billingInquiries: 0
  });

  // Database settings
  const [settings, setSettings] = useState({
    currency: "USD",
    dueDays: 14,
    autoReminders: true,
    supportTargetMinutes: 10
  });
  const [settingsMsg, setSettingsMsg] = useState("");

  // Profile Edit states
  const [profileName, setProfileName] = useState("");
  const [profilePass, setProfilePass] = useState("");
  const [profileMsg, setProfileMsg] = useState("");

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

  // Load available profiles from backend dynamically for the gateway selector
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await fetch("/api/auth/profiles");
        if (res.ok) {
          const data = await res.json();
          setMockProfiles(data);
        }
      } catch (err) {
        console.error("Failed to load profiles from backend:", err);
      }
    };
    fetchProfiles();
  }, []);

  // Theme Sync on change
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("apexbilling_theme", theme);
  }, [theme]);

  // Set Profile fields when user session loads
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
    }
  }, [user]);

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
        if (data.settings) {
          setSettings(data.settings);
        }
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
      setActiveTab("dashboard");
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

  // --- SAVE SETTINGS HANDLER ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSettingsMsg("Success: System settings saved dynamically to database.");
        fetchOverview();
      } else {
        setSettingsMsg("Error: Failed to update settings on the server.");
      }
    } catch (err) {
      setSettingsMsg("Error: Failed to communicate settings payload to backend.");
    }
  };

  // --- SAVE PROFILE HANDLER ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg("");

    try {
      const res = await fetch("/api/auth/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: profileName, pw: profilePass })
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setProfilePass("");
        setProfileMsg("Success: Account credentials updated successfully.");
      } else {
        const data = await res.json();
        setProfileMsg(`Error: ${data.error || "Failed to save profile."}`);
      }
    } catch (err) {
      setProfileMsg("Error: Connection failure to database server.");
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

  // Currency utility mapper
  const getCurrencySymbol = (code) => {
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    return "$";
  };
  const sym = getCurrencySymbol(settings.currency);

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

  // User-friendly formatter to translate raw developer logs into readable statements
  const formatLogItem = (log) => {
    const msg = log.msg;
    const lower = msg.toLowerCase();
    
    let title = "Security Event";
    let desc = msg;
    let type = "info"; // info, success, warning, error
    let icon = "🛡️";

    if (lower.includes("user auth success")) {
      title = "Session Established";
      type = "success";
      icon = "🔑";
      const match = msg.match(/success:\s*([^\s(]+)/);
      const email = match ? match[1] : "user";
      desc = `Operator (${email}) signed in successfully.`;
    } else if (lower.includes("failed login")) {
      title = "Blocked Login Attempt";
      type = "warning";
      icon = "⚠️";
      const match = msg.match(/email:\s*([^\s]+)/);
      const email = match ? match[1] : "unknown";
      desc = `Failed sign-in attempt detected for: ${email}`;
    } else if (lower.includes("created invoice")) {
      title = "New Invoice Registered";
      type = "success";
      icon = "📝";
      const match = msg.match(/invoice\s*(INV-\d+)/i);
      const invNo = match ? match[1] : "invoice";
      desc = `Invoice ${invNo} added to the ledger databases.`;
    } else if (lower.includes("deleted invoice")) {
      title = "Invoice Record Deleted";
      type = "error";
      icon = "🗑️";
      const match = msg.match(/invoice\s*(INV-\d+)/i);
      const invNo = match ? match[1] : "invoice";
      desc = `Invoice ${invNo} permanently purged by administrator.`;
    } else if (lower.includes("profile updated")) {
      title = "Credentials Modified";
      type = "info";
      icon = "👤";
      const match = msg.match(/for\s*([^\s]+)/);
      const email = match ? match[1] : "user";
      desc = `Account details updated for ${email}.`;
    } else if (lower.includes("settings updated")) {
      title = "Configurations Adjusted";
      type = "info";
      icon = "⚙️";
      desc = "Billing terms and currency parameters modified.";
    } else if (lower.includes("rate limit")) {
      title = "Traffic Throttle Alert";
      type = "warning";
      icon = "🚦";
      desc = "API traffic threshold approached on system gateway.";
    }

    return { title, desc, type, icon };
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
            <h3>Mock Access Gateway</h3>
            <p className="gateway-desc">Select a tester profile to dynamically simulate billing roles:</p>
            <div className="profiles-layout-grid">
              {mockProfiles.length > 0 ? (
                mockProfiles.map((p, idx) => {
                  let roleDesc = "";
                  let badgeColor = "";
                  if (p.role === "admin") {
                    roleDesc = "Full administrative ledger control. Delete invoices, write records, review security logs.";
                    badgeColor = "var(--color-error)";
                  } else if (p.role === "manager") {
                    roleDesc = "Financial projection workspace. Run subscription MRR analytics & projection simulators.";
                    badgeColor = "var(--accent-green-primary)";
                  } else if (p.role === "support") {
                    roleDesc = "Customer service desk. Register customer invoices, sync helpdesk metrics, view logs.";
                    badgeColor = "var(--accent-green-light)";
                  }
                  
                  return (
                    <div 
                      key={idx} 
                      className={`gateway-profile-card ${p.role === "manager" ? "highlighted" : ""}`}
                      onClick={() => handleLogin(null, p)}
                    >
                      <div className="gateway-profile-header">
                        <span className="gateway-profile-name">{p.name}</span>
                        <span className="gateway-profile-badge" style={{ backgroundColor: badgeColor }}>{p.role.toUpperCase()}</span>
                      </div>
                      <p className="gateway-profile-desc">{roleDesc}</p>
                      <div className="gateway-profile-action">Sign In as {p.name.split(" ")[0]} &rarr;</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: "0.72rem", color: "var(--txt-muted)", textAlign: "center", padding: "20px" }}>
                  Establishing connection to access database...
                </div>
              )}
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
            <p>Session: <strong>{user?.name || "Initializing..."}</strong> · <span style={{ color: "var(--accent-green-primary)", fontWeight: 700 }}>{(user?.role || "user").toUpperCase()}</span></p>
          </div>
        </div>
        <div className="header-actions">
          <div className="system-status">
            <span className="pulse-dot"></span>
            Database: Online
          </div>
          
          {/* Theme Switcher Toggle */}
          <button className="theme-toggle-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Dark Mode
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                Light Mode
              </>
            )}
          </button>

          <button className="logout-btn" onClick={handleLogout}>Disconnect Session</button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dash-content">
        
        {/* Workspace tabs navigation */}
        <div className="workspace-tabs">
          <button className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
            Dashboard
          </button>
          <button className={`tab-btn ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>
            User Profile
          </button>
          <button className={`tab-btn ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
            App Settings
          </button>
        </div>

        {/* TAB 1: DASHBOARD VIEW */}
        {activeTab === "dashboard" && (
          <>
            {/* Metrics Grid (Conditional based on role) */}
            {user?.role === "support" ? (
              <div className="metrics-grid">
                <div className="metric-card tickets">
                  <div className="m-label">Active Support Tickets</div>
                  <div className="m-value">{stats.activeTickets}</div>
                  <div className="m-help">Open customer tickets in Zendesk</div>
                </div>
                <div className="metric-card sla">
                  <div className="m-label">Avg Response SLA</div>
                  <div className="m-value">{stats.avgResponseTime}</div>
                  <div className="m-help">Average SLA response delay</div>
                </div>
                <div className="metric-card csat">
                  <div className="m-label">CSAT Satisfaction</div>
                  <div className="m-value">{stats.csat}</div>
                  <div className="m-help">Customer satisfaction rating</div>
                </div>
                <div className="metric-card inquiries">
                  <div className="m-label">Billing Inquiries</div>
                  <div className="m-value">{stats.billingInquiries}</div>
                  <div className="m-help">Pending customer ledger tickets</div>
                </div>
              </div>
            ) : (
              <div className="metrics-grid">
                <div className="metric-card revenue">
                  <div className="m-label">Total Revenue (Paid)</div>
                  <div className="m-value">{sym}{Number(stats.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="m-help">Settled earnings from paid ledger invoices</div>
                </div>
                <div className="metric-card subscriptions">
                  <div className="m-label">Active Subscriptions</div>
                  <div className="m-value">{stats.activeSubscriptions || 0}</div>
                  <div className="m-help">Active accounts on billing plans</div>
                </div>
                <div className="metric-card outstanding">
                  <div className="m-label">Outstanding Invoices</div>
                  <div className="m-value">{sym}{Number(stats.outstandingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="m-help">Unpaid & pending balance in queue</div>
                </div>
                <div className="metric-card churn">
                  <div className="m-label">System Churn Rate</div>
                  <div className="m-value">{stats.churnRate}</div>
                  <div className="m-help">Monthly customer cancellation average</div>
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
                            <td className="inv-amount">{sym}{Number(inv.amount || 0).toFixed(2)}</td>
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
                            <label>Amount ({sym})</label>
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
                        <h2>Security & Audit Activity</h2>
                      </div>
                      <div className="log-stream-wrapper" style={{ minHeight: 280, maxHeight: 280 }}>
                        {displayLogs.length > 0 ? (
                          [...displayLogs].reverse().map((log, idx) => {
                            const item = formatLogItem(log);
                            return (
                              <div key={idx} className={`log-activity-card ${item.type}`}>
                                <div className="log-activity-icon">{item.icon}</div>
                                <div className="log-activity-body">
                                  <div className="log-activity-header">
                                    <span className="log-activity-title">{item.title}</span>
                                    <span className="log-activity-time">{log.ts}</span>
                                  </div>
                                  <p className="log-activity-desc">{item.desc}</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="empty-logs">No system activity logged.</div>
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
                          <span className="proj-val">{sym}{Number(stats.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="proj-item">
                          <span className="proj-label">Est. Value (Avg: {sym}{Math.round(averageAmount)}/sub)</span>
                          <span className="proj-val">+{sym}{Number(projectedNewSubs * averageAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="proj-item">
                          <span className="proj-label">Projected Monthly Revenue</span>
                          <span className="proj-val highlight">{sym}{Number(stats.totalRevenue + (projectedNewSubs * averageAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                            <label>Amount ({sym})</label>
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
                      <div className="log-stream-wrapper" style={{ minHeight: 280, maxHeight: 280 }}>
                        {displayLogs.length > 0 ? (
                          [...displayLogs].reverse().map((log, idx) => {
                            const item = formatLogItem(log);
                            return (
                              <div key={idx} className={`log-activity-card ${item.type}`}>
                                <div className="log-activity-icon">{item.icon}</div>
                                <div className="log-activity-body">
                                  <div className="log-activity-header">
                                    <span className="log-activity-title">{item.title}</span>
                                    <span className="log-activity-time">{log.ts}</span>
                                  </div>
                                  <p className="log-activity-desc">{item.desc}</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="empty-logs">No customer activity logged.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: USER PROFILE VIEW */}
        {activeTab === "profile" && (
          <div className="profile-view-grid">
            {/* Left Side: Avatar Card */}
            <div className="profile-avatar-card card">
              <div className="profile-avatar-circle">
                {user?.av || (user?.name ? user.name.split(" ").map(n => n[0]).join("") : "U")}
              </div>
              <h3>{user?.name}</h3>
              <p>{user?.role}</p>

              <div className="profile-details-list">
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Status</span>
                  <span className="profile-detail-value" style={{ color: "var(--color-success)" }}>
                    {user?.status ? user.status.toUpperCase() : "ACTIVE"}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Email Address</span>
                  <span className="profile-detail-value">{user?.email}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Joined On</span>
                  <span className="profile-detail-value">{user?.joined || "Jan 1, 2026"}</span>
                </div>
              </div>
            </div>

            {/* Right Side: Edit Profile Form */}
            <div className="card">
              <h2>Profile Management & Security</h2>
              <p className="card-desc">Update your display information and console authorization passcode</p>
              
              <form onSubmit={handleSaveProfile} style={{ marginTop: 20 }}>
                <div className="form-group">
                  <label>Full Display Name</label>
                  <input 
                    type="text" 
                    value={profileName} 
                    onChange={(e) => setProfileName(e.target.value)} 
                    placeholder="Name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Console Passcode (Leave blank to keep current)</label>
                  <input 
                    type="password" 
                    value={profilePass} 
                    onChange={(e) => setProfilePass(e.target.value)} 
                    placeholder="••••••••••••" 
                  />
                </div>

                {profileMsg && (
                  <div className={`form-feedback ${profileMsg.startsWith("Success") ? "success" : "error"}`}>
                    {profileMsg}
                  </div>
                )}

                <button type="submit" className="submit-invoice-btn" style={{ maxWidth: 200 }}>
                  Update Credentials
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: APP SETTINGS VIEW */}
        {activeTab === "settings" && (
          <div className="card" style={{ maxWidth: 900, margin: "0 auto", textAlign: "left" }}>
            <h2>System Configuration Workspace</h2>
            <p className="card-desc">Configure billing terms, payment rules, and SLA tracking parameters. Values are loaded from and stored directly in the database.</p>
            
            <form onSubmit={handleSaveSettings} style={{ marginTop: 24 }}>
              {/* Section 1: Billing Currency */}
              <div className="settings-section">
                <h3>Billing Currency</h3>
                <p className="sec-desc">Set the system-wide currency for calculating invoices and displaying stats panels</p>
                <div className="form-group" style={{ maxWidth: 300 }}>
                  <select 
                    value={settings.currency} 
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  >
                    <option value="USD">USD ($ - United States Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound Sterling)</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Due Terms & Automatic Reminders */}
              <div className="settings-section">
                <h3>Standard Billing Due Terms</h3>
                <p className="sec-desc">Define the default duration (in days) given to customers to fulfill outstanding invoices</p>
                <div className="form-group" style={{ maxWidth: 200 }}>
                  <label>Term Duration (Days)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="90" 
                    value={settings.dueDays} 
                    onChange={(e) => setSettings({ ...settings, dueDays: parseInt(e.target.value) || 14 })}
                  />
                </div>

                {/* Toggle Switch */}
                <div className="toggle-setting-row">
                  <div className="toggle-setting-info">
                    <label>Automatic Payment Reminders</label>
                    <span>Automatically dispatch reminder alerts to unpaid invoices 3 days before due dates</span>
                  </div>
                  <div className="toggle-switch-wrapper">
                    <input 
                      type="checkbox" 
                      className="toggle-switch-input" 
                      id="autoRemindersToggle"
                      checked={settings.autoReminders}
                      onChange={(e) => setSettings({ ...settings, autoReminders: e.target.checked })}
                    />
                    <label className="toggle-switch-slider" htmlFor="autoRemindersToggle"></label>
                  </div>
                </div>
              </div>

              {/* Section 3: SLA Targets */}
              <div className="settings-section">
                <h3>Support Service Level Agreement (SLA)</h3>
                <p className="sec-desc">Configure customer support response limits. Shifts SLA stats displays dynamically.</p>
                <div className="form-group" style={{ maxWidth: 200 }}>
                  <label>SLA First Response Target (Minutes)</label>
                  <input 
                    type="number" 
                    min="2" 
                    max="60" 
                    value={settings.supportTargetMinutes} 
                    onChange={(e) => setSettings({ ...settings, supportTargetMinutes: parseInt(e.target.value) || 10 })}
                  />
                </div>
              </div>

              {settingsMsg && (
                <div className={`form-feedback ${settingsMsg.startsWith("Success") ? "success" : "error"}`}>
                  {settingsMsg}
                </div>
              )}

              <button type="submit" className="submit-invoice-btn" style={{ maxWidth: 200 }}>
                Save Settings Records
              </button>
            </form>
          </div>
        )}
      </main>

      <footer className="dash-footer">
        APEXBILLING LEDGER CONTROL PANEL v1.6 · SYSTEM DATABASE GATEWAY ENGINE · 2026
      </footer>
    </div>
  );
}
