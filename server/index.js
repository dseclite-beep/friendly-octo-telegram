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
    
    // Apply filters with the specific FILTER BUG
    if (status || plan) {
      list = list.filter(item => {
        if (status && plan) {
          // BUG: OR (||) logic instead of AND (&&) for combined queries
          return item.status === status.toLowerCase() || item.plan.toLowerCase() === plan.toLowerCase();
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

// Manage Invoice creation
app.post("/api/invoices", authenticateToken, async (req, res) => {
  const { customer, email, plan, amount, status } = req.body;
  if (!customer || !email || !plan || !amount || !status) {
    return res.status(400).json({ error: "All fields are required to create an invoice." });
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
