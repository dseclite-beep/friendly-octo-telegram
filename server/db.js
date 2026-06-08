const fs = require("fs").promises;
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

// Unified Table implementation utilizing fs.promises
class Table {
  constructor(filename, defaultData = []) {
    this.filepath = path.join(DATA_DIR, filename);
    this.defaultData = defaultData;
    this.data = [];
  }

  async init() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      try {
        const fileContent = await fs.readFile(this.filepath, "utf8");
        this.data = JSON.parse(fileContent);
      } catch (err) {
        // File does not exist, initialize with default data
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        await this.save();
      }
    } catch (error) {
      console.error(`Database error initializing table ${this.filepath}:`, error);
    }
  }

  async save() {
    try {
      await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2), "utf8");
    } catch (error) {
      console.error(`Database error writing to ${this.filepath}:`, error);
    }
  }

  async find(filterFn = () => true) {
    return this.data.filter(filterFn);
  }

  async findOne(filterFn) {
    return this.data.find(filterFn) || null;
  }

  async insert(record) {
    this.data.push(record);
    await this.save();
    return record;
  }

  async update(filterFn, updateData) {
    let updatedCount = 0;
    this.data = this.data.map((record) => {
      if (filterFn(record)) {
        updatedCount++;
        return { ...record, ...updateData };
      }
      return record;
    });
    if (updatedCount > 0) {
      await this.save();
    }
    return updatedCount;
  }

  async remove(filterFn) {
    const originalLength = this.data.length;
    this.data = this.data.filter((record) => !filterFn(record));
    if (this.data.length !== originalLength) {
      await this.save();
      return true;
    }
    return false;
  }
}

// Baseline mock users
const defaultUsers = [
  {
    email: "billing_admin@apexbilling.com",
    pw: "Admin@123",
    name: "Lucas Vance",
    role: "admin",
    av: "LV",
    joined: "Jan 12, 2025",
    status: "active"
  },
  {
    email: "finance_manager@apexbilling.com",
    pw: "Manager@123",
    name: "Sophia Martinez",
    role: "manager",
    av: "SM",
    joined: "Feb 5, 2025",
    status: "active"
  },
  {
    email: "support_agent@apexbilling.com",
    pw: "Support@123",
    name: "Liam Thompson",
    role: "support",
    av: "LT",
    joined: "Mar 1, 2025",
    status: "active"
  }
];

// Baseline mock invoices
const defaultInvoices = [
  {
    id: 1,
    invoiceNo: "INV-1001",
    customer: "Acme Corp",
    email: "billing@acme.com",
    plan: "Enterprise",
    amount: 1200.00,
    status: "paid",
    issued: "2026-06-01",
    due: "2026-06-15"
  },
  {
    id: 2,
    invoiceNo: "INV-1002",
    customer: "Globex Inc",
    email: "accounting@globex.com",
    plan: "Pro",
    amount: 299.00,
    status: "unpaid",
    issued: "2026-06-03",
    due: "2026-06-17"
  },
  {
    id: 3,
    invoiceNo: "INV-1003",
    customer: "Initech",
    email: "invoices@initech.com",
    plan: "Pro",
    amount: 299.00,
    status: "pending",
    issued: "2026-06-04",
    due: "2026-06-18"
  },
  {
    id: 4,
    invoiceNo: "INV-1004",
    customer: "Umbrella Corp",
    email: "payables@umbrella.com",
    plan: "Basic",
    amount: 49.00,
    status: "paid",
    issued: "2026-05-28",
    due: "2026-06-11"
  },
  {
    id: 5,
    invoiceNo: "INV-1005",
    customer: "Tyrell Corp",
    email: "finance@tyrell.com",
    plan: "Enterprise",
    amount: 1500.00,
    status: "unpaid",
    issued: "2026-06-05",
    due: "2026-06-19"
  },
  {
    id: 6,
    invoiceNo: "INV-1006",
    customer: "Hooli",
    email: "billing@hooli.xyz",
    plan: "Pro",
    amount: 299.00,
    status: "paid",
    issued: "2026-06-02",
    due: "2026-06-16"
  },
  {
    id: 7,
    invoiceNo: "INV-1007",
    customer: "Stark Industries",
    email: "accounts@stark.com",
    plan: "Basic",
    amount: 49.00,
    status: "pending",
    issued: "2026-06-06",
    due: "2026-06-20"
  },
  {
    id: 8,
    invoiceNo: "INV-1008",
    customer: "Wayne Enterprises",
    email: "treasury@wayne.com",
    plan: "Enterprise",
    amount: 2400.00,
    status: "paid",
    issued: "2026-05-25",
    due: "2026-06-08"
  }
];

// Baseline mock log entries
const defaultLogs = [
  { ts: "14:22:01", lvl: "INFO", msg: "User auth success: billing_admin@apexbilling.com (admin)" },
  { ts: "14:21:44", lvl: "WARN", msg: "Rate limit approached: IP 203.0.113.88 (48/50 req/min)" },
  { ts: "14:21:10", lvl: "INFO", msg: "Audit Log initialized: ApexBilling secure telemetry connection established." }
];

// Instantiate Tables
const db = {
  users: new Table("users.json", defaultUsers),
  invoices: new Table("invoices.json", defaultInvoices),
  logs: new Table("logs.json", defaultLogs)
};

// Initializer helper
async function initDatabase() {
  await db.users.init();
  await db.invoices.init();
  await db.logs.init();
  console.log("Database initialized successfully!");
}

module.exports = {
  db,
  initDatabase
};
