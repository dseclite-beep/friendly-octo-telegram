const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { db, initDatabase } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = "apexbilling-jwt-secret-key-2026";

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Helper to log audit events
async function addAuditLog(lvl, msg) {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  await db.logs.insert({ ts, lvl, msg });
}

// Authentication Middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    const user = await db.users.findOne((u) => u.email === verified.email);
    if (!user) {
      return res.status(404).json({ error: "User session not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
}

const apiPortalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ApexBilling // API Status Gateway</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090d10;
      color: #94a3b8;
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .status-card {
      background: rgba(15, 23, 28, 0.45);
      border: 1px solid rgba(16, 185, 129, 0.08);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      text-align: center;
      backdrop-filter: blur(20px);
    }
    .logo-box {
      width: 46px;
      height: 46px;
      background: linear-gradient(135deg, #10b981, #059669);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px auto;
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
    }
    h1 { font-size: 1.4rem; font-weight: 800; color: #f8fafc; letter-spacing: 0.05em; }
    p.desc { font-size: 0.85rem; color: #64748b; margin-top: 4px; margin-bottom: 24px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 99px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #10b981;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 30px;
    }
    .pulse-dot { width: 6px; height: 6px; background-color: #10b981; border-radius: 50%; animation: pulse 1.8s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; box-shadow: 0 0 6px #10b981; } }
    .info-list { text-align: left; background: rgba(0, 0, 0, 0.25); border-radius: 8px; padding: 16px; margin-bottom: 24px; font-family: 'Space Mono', monospace; font-size: 0.72rem; }
    .info-item { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.02); padding-bottom: 6px; }
    .info-item:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
    .info-label { color: #475569; }
    .info-val { color: #94a3b8; }
    .link-btn {
      display: inline-block;
      width: 100%;
      background: #10b981;
      color: #fff;
      text-decoration: none;
      padding: 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.825rem;
      transition: background 0.2s;
    }
    .link-btn:hover { background: #059669; }
  </style>
</head>
<body>
  <div class="status-card">
    <div class="logo-box">
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="#fff" style="width: 22; height: 22;">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h1>ApexBilling platform API</h1>
    <p class="desc">System REST Gateway & Database Controller</p>
    
    <div class="status-badge">
      <span class="pulse-dot"></span>
      API Services Status: Online
    </div>

    <div class="info-list">
      <div class="info-item">
        <span class="info-label">GATEWAY PORT</span>
        <span class="info-val">5000</span>
      </div>
      <div class="info-item">
        <span class="info-label">PERSISTENCE LAYER</span>
        <span class="info-val">JSON-ORM Ledger Database</span>
      </div>
      <div class="info-item">
        <span class="info-label">DB INITIALIZATION</span>
        <span class="info-val">Success / Stable</span>
      </div>
      <div class="info-item">
        <span class="info-label">VERIFIED SERVICE</span>
        <span class="info-val">JWT Middleware Active</span>
      </div>
    </div>

    <a href="http://localhost:5173" class="link-btn">Launch Frontend Console</a>
  </div>
</body>
</html>`;

app.get("/", (req, res) => {
  res.send(apiPortalHtml);
});

// Auth Routes
app.post("/api/auth/login", async (req, res) => {
  const { email, pw } = req.body;
  if (!email || !pw) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await db.users.findOne((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user || user.pw !== pw) {
      await addAuditLog("WARN", `Failed login attempt for email: ${email}`);
      return res.status(400).json({ error: "Invalid email or passcode credentials." });
    }

    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    await addAuditLog("INFO", `User auth success: ${user.email} (${user.role})`);
    
    const { pw: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  const { pw, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Overview stats & invoices (Requires authentication)
app.get("/api/billing/overview", authenticateToken, async (req, res) => {
  try {
    const { status, plan } = req.query;
    let list = await db.invoices.find();
    
    // Core database records for stats calculations
    const allInvoices = await db.invoices.find();
    const totalRevenue = allInvoices
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + i.amount, 0);
    const outstandingAmount = allInvoices
      .filter(i => i.status === "unpaid" || i.status === "pending")
      .reduce((sum, i) => sum + i.amount, 0);
    const activeSubscriptions = allInvoices.filter(i => i.status === "paid" || i.status === "pending").length;
    
    // Apply filters with query parameters
    if (status || plan) {
      list = list.filter(item => {
        if (status && plan) {
          // FIX: Changed OR (||) logic to AND (&&) for combined queries to ensure correct database filtering matches
          return item.status === status.toLowerCase() && item.plan.toLowerCase() === plan.toLowerCase();
        }
        if (status) return item.status === status.toLowerCase();
        if (plan) return item.plan.toLowerCase() === plan.toLowerCase();
        return true;
      });
    }

    const logs = await db.logs.find();
    
    res.json({
      invoices: list,
      logs: logs.slice(-20),
      stats: {
        totalRevenue,
        outstandingAmount,
        activeSubscriptions,
        churnRate: "2.4%"
      }
    });
  } catch (err) {
    console.error("Failed to load overview data:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/api/invoices", authenticateToken, async (req, res) => {
  const { customer, email, plan, amount, status } = req.body;
  if (!customer || !email || !plan || !amount || !status) {
    return res.status(400).json({ error: "All fields are required to create an invoice." });
  }

  if (parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: "Amount must be a positive number." });
  }

  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  try {
    const list = await db.invoices.find();
    const nextId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    const invoiceNo = `INV-${1000 + nextId}`;
    const issued = new Date().toISOString().split("T")[0];
    const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const newInvoice = {
      id: nextId,
      invoiceNo,
      customer,
      email,
      plan,
      amount: parseFloat(amount),
      status: status.toLowerCase(),
      issued,
      due
    };

    await db.invoices.insert(newInvoice);
    await addAuditLog("INFO", `Created invoice ${invoiceNo} for ${customer} ($${amount})`);
    res.json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: "Failed to create invoice." });
  }
});

// Manage Invoice deletion
app.post("/api/invoices/:id/delete", authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const invoice = await db.invoices.findOne(i => i.id === id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }
    await db.invoices.remove(i => i.id === id);
    await addAuditLog("INFO", `Deleted invoice ${invoice.invoiceNo} for ${invoice.customer}`);
    res.json({ success: true, message: "Invoice removed from ledger." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete invoice." });
  }
});

// System startup
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`ApexBilling server running on http://localhost:${PORT}`);
  });
}

startServer();
