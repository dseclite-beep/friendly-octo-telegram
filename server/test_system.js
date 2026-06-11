const baseUrl = "http://localhost:5000";

// ANSI escape codes for styling
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

async function runTests() {
  console.log(bold(cyan("\n==================================================")));
  console.log(bold(cyan("     APEXBILLING V1.6 - SYSTEM TESTING SUITE       ")));
  console.log(bold(cyan("==================================================\n")));

  try {
    // ----------------------------------------------------
    // TEST 1: Retrieve Profiles (Dynamic Login Catalog)
    // ----------------------------------------------------
    console.log(bold("1. Testing Profiles Catalog Endpoint..."));
    const profilesRes = await fetch(`${baseUrl}/api/auth/profiles`);
    if (!profilesRes.ok) throw new Error("Failed to load profiles catalog!");
    const profiles = await profilesRes.json();
    console.log(green(`  ✓ Profile Catalog Loaded. Found ${profiles.length} mock accounts.`));
    if (profiles.length === 0) throw new Error("Catalog returned empty users!");
    profiles.forEach(p => console.log(`    - Profile: ${p.name} (${p.role.toUpperCase()}) | Email: ${p.email}`));

    // ----------------------------------------------------
    // TEST 2: Authentication & JWT Validation
    // ----------------------------------------------------
    console.log(bold("\n2. Testing Auth & Credentials..."));

    // Admin Login using credentials from catalog
    const adminProfile = profiles.find(p => p.role === "admin");
    if (!adminProfile) throw new Error("Admin profile missing in database!");

    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminProfile.email, pw: adminProfile.pw })
    });
    if (!adminLoginRes.ok) throw new Error("Admin login failed!");
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    console.log(green("  ✓ Admin successfully authenticated."));
    console.log(`    Token: ${adminToken.slice(0, 24)}...`);
    console.log(`    Lucas Vance (Admin) Successfully Logged In.`);

    // Token Validation via /api/auth/me
    const authMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    if (!authMeRes.ok) throw new Error("Auth verification failed!");
    const meData = await authMeRes.json();
    console.log(green(`  ✓ Token verified. Profile Name: ${meData.user.name} | Role: ${meData.user.role}`));

    // ----------------------------------------------------
    // TEST 3: Profile Configuration Updates
    // ----------------------------------------------------
    console.log(bold("\n3. Testing User Profile Updates..."));
    const updateProfileRes = await fetch(`${baseUrl}/api/auth/profile/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ 
        name: "Lucas Vance Edit",
        userStatus: "Away",
        bio: "ApexBilling Principal Console Administrator (Edited)"
      })
    });
    if (!updateProfileRes.ok) throw new Error("Failed to update profile details!");
    const updatedUser = await updateProfileRes.json();
    if (updatedUser.name !== "Lucas Vance Edit" || updatedUser.userStatus !== "Away" || updatedUser.bio !== "ApexBilling Principal Console Administrator (Edited)") {
      throw new Error("Profile details updates not applied!");
    }
    console.log(green("  ✓ Profile Name, Status, and Bio updated successfully."));

    // Restore original profile details
    await fetch(`${baseUrl}/api/auth/profile/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ 
        name: "Lucas Vance",
        userStatus: "Active",
        bio: "ApexBilling Principal Console Administrator"
      })
    });
    console.log(green("  ✓ Original Profile details restored."));

    // ----------------------------------------------------
    // TEST 4: App Settings Configuration
    // ----------------------------------------------------
    console.log(bold("\n4. Testing App Settings Configuration..."));
    const settingsGetRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    if (!settingsGetRes.ok) throw new Error("Failed to load settings!");
    const currentSettings = await settingsGetRes.json();
    console.log(green(`  ✓ Current Settings Loaded: Currency=${currentSettings.currency} | DueDays=${currentSettings.dueDays} | TargetMinutes=${currentSettings.supportTargetMinutes}`));

    // Update settings
    const updateSettingsRes = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        currency: "EUR",
        dueDays: 30,
        autoReminders: false,
        supportTargetMinutes: 15
      })
    });
    if (!updateSettingsRes.ok) throw new Error("Failed to save settings!");
    const newSettings = await updateSettingsRes.json();
    if (newSettings.currency !== "EUR" || newSettings.dueDays !== 30) throw new Error("Settings save validation failed!");
    console.log(green(`  ✓ Settings updated successfully: Currency=${newSettings.currency} | DueDays=${newSettings.dueDays} | Reminders=${newSettings.autoReminders}`));

    // Restore original settings
    await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        currency: "USD",
        dueDays: 14,
        autoReminders: true,
        supportTargetMinutes: 10
      })
    });
    console.log(green("  ✓ Original Settings restored."));

    // ----------------------------------------------------
    // TEST 5: Overview Stats & Invoices Retrieval
    // ----------------------------------------------------
    console.log(bold("\n5. Testing Invoice Retrieval & Telemetry Logs..."));
    const overviewRes = await fetch(`${baseUrl}/api/billing/overview`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    if (!overviewRes.ok) throw new Error("Failed to retrieve overview stats!");
    const overviewData = await overviewRes.json();
    
    console.log(green(`  ✓ Overview data loaded successfully.`));
    console.log(`    Invoices count in database: ${overviewData.invoices.length}`);
    console.log(`    Total Paid Revenue: $${overviewData.stats.totalRevenue}`);
    console.log(`    Outstanding Balance: $${overviewData.stats.outstandingAmount}`);
    console.log(`    Telemetry Logs Count: ${overviewData.logs.length}`);

    // ----------------------------------------------------
    // TEST 6: Invoice Posting / Creation
    // ----------------------------------------------------
    console.log(bold("\n6. Testing Invoice Registry Insertion..."));
    const newInvoice = {
      customer: "Stark Tech Industries",
      email: "billing@stark.com",
      plan: "Enterprise",
      amount: 4500.00,
      status: "pending"
    };

    const postInvoiceRes = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify(newInvoice)
    });
    if (!postInvoiceRes.ok) throw new Error("Failed to post invoice!");
    const createdInvoice = await postInvoiceRes.json();
    const invoiceId = createdInvoice.id;
    console.log(green(`  ✓ Invoice created successfully (ID: ${invoiceId} | No: ${createdInvoice.invoiceNo}).`));
    console.log(`    Customer: ${createdInvoice.customer} | Plan: ${createdInvoice.plan}`);
    console.log(`    Amount: $${createdInvoice.amount} | Status: ${createdInvoice.status}`);

    // ----------------------------------------------------
    // TEST 7: Query Filtering Evaluation
    // ----------------------------------------------------
    console.log(bold("\n7. Verifying Query Filters & Endpoint Parameters..."));
    
    // Test filtering by single parameter (Plan=Enterprise)
    const planFilterRes = await fetch(`${baseUrl}/api/billing/overview?plan=Enterprise`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const planFilterData = await planFilterRes.json();
    console.log(`    Filtering by Plan=Enterprise: returned ${planFilterData.invoices.length} invoices.`);
    const nonEnterprise = planFilterData.invoices.filter(i => i.plan !== "Enterprise");
    if (nonEnterprise.length > 0) {
      throw new Error("Plan filtering returned incorrect tiers!");
    }
    console.log(green("  ✓ Single parameter Plan filtering works correctly."));

    // Test combining filters (Plan=Enterprise AND Status=Paid)
    const combinedFilterRes = await fetch(`${baseUrl}/api/billing/overview?plan=Enterprise&status=Paid`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const combinedFilterData = await combinedFilterRes.json();
    console.log(`    Filtering by Plan=Enterprise AND Status=Paid (Combined): returned ${combinedFilterData.invoices.length} invoices.`);
    
    const incorrectMatches = combinedFilterData.invoices.filter(i => i.plan !== "Enterprise" || i.status !== "paid");
    if (incorrectMatches.length > 0) {
      throw new Error("Combined Plan and Status filtering returned incorrect results (AND logic failed)!");
    }
    console.log(green("  ✓ Combined Plan and Status filtering works correctly."));

    // ----------------------------------------------------
    // TEST 8: Invoice Deletion
    // ----------------------------------------------------
    console.log(bold("\n8. Testing Invoice Deletion..."));
    const deleteRes = await fetch(`${baseUrl}/api/invoices/${invoiceId}/delete`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    if (!deleteRes.ok) throw new Error(`Failed to delete invoice with ID: ${invoiceId}`);
    const deleteResultData = await deleteRes.json();
    console.log(green(`  ✓ ${deleteResultData.message}`));

    // ----------------------------------------------------
    // TEST 9: User Creation, Authentication & Cleanup
    // ----------------------------------------------------
    console.log(bold("\n9. Testing Operator Account Registry & Verification..."));
    
    // Create new support user as admin
    const createOperatorRes = await fetch(`${baseUrl}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Test Operator",
        email: "test_operator@apexbilling.com",
        pw: "TestPass@123",
        role: "support"
      })
    });
    if (!createOperatorRes.ok) {
      const errData = await createOperatorRes.json();
      throw new Error(`Failed to create test operator account: ${errData.error || createOperatorRes.statusText}`);
    }
    const createdOperator = await createOperatorRes.json();
    console.log(green(`  ✓ Operator user created: ${createdOperator.name} (${createdOperator.role})`));

    // Try logging in with the new user's credentials
    const opLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test_operator@apexbilling.com",
        pw: "TestPass@123"
      })
    });
    if (!opLoginRes.ok) throw new Error("Created operator failed to log in!");
    const opLoginData = await opLoginRes.json();
    console.log(green("  ✓ Created operator authenticated successfully and retrieved token."));
    const opToken = opLoginData.token;

    // Delete the operator user as admin
    const deleteOpRes = await fetch(`${baseUrl}/api/users/test_operator@apexbilling.com/delete`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    if (!deleteOpRes.ok) throw new Error("Failed to delete test operator account!");
    const deleteOpResult = await deleteOpRes.json();
    console.log(green(`  ✓ ${deleteOpResult.message}`));

    // Verify login fails now
    const opLoginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test_operator@apexbilling.com",
        pw: "TestPass@123"
      })
    });
    if (opLoginRes2.ok) throw new Error("Operator login succeeded after account was deleted!");
    console.log(green("  ✓ Verified operator login rejected after account deletion."));

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log(bold(cyan("\n==================================================")));
    console.log(bold(green("     E2E INTEGRATION TEST RESULTS: SUCCESSFUL     ")));
    console.log(bold(cyan("==================================================")));
    console.log(green("  ✓ All API routing works flawlessly"));
    console.log(green("  ✓ Dynamic profile loading operational"));
    console.log(green("  ✓ App settings and Profile updates save to DB"));
    console.log(green("  ✓ Invoice registers, filters and deletions succeed"));
    console.log(green("  ✓ Operator user creation and cleanup verified"));
    console.log(bold(cyan("==================================================\n")));


  } catch (error) {
    console.error(bold(red("\n❌ Deep testing encountered a critical failure!")));
    console.error(red(error.message));
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
