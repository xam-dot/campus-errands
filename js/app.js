
const db = window.ceSupabase;

const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const dashboardContent = document.getElementById("dashboard-content");
const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const toggleMode = document.getElementById("toggle-mode");
const logoutBtn = document.getElementById("logout-btn");

const accountStatus = document.getElementById("account-status");
const welcomeHeading = document.getElementById("welcome-heading");
const jobForm = document.getElementById("job-form");
const jobMessage = document.getElementById("job-message");
const jobsList = document.getElementById("jobs-list");
const myJobsList = document.getElementById("my-jobs-list");

let isLogin = true;
let currentUser = null;
let currentProfile = null;

function showMessage(element, message) {
  element.textContent = message;
}

function addTextElement(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);
  return element;
}

function money(value) {
  return `K${Number(value).toFixed(2)}`;
}

toggleMode.addEventListener("click", () => {
  isLogin = !isLogin;

  formTitle.textContent = isLogin
    ? "Welcome to Campus Errands"
    : "Create your account";

  submitBtn.textContent = isLogin ? "Log in" : "Register";
  toggleMode.textContent = isLogin ? "Create account" : "Log in";
  nameInput.required = !isLogin;

  document.getElementById("switch-text").firstChild.textContent =
    isLogin ? "New here? " : "Already registered? ";

  showMessage(authMessage, "");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitBtn.disabled = true;
  showMessage(authMessage, "Please wait...");

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (isLogin) {
      const { error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      await checkSession();
    } else {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: nameInput.value.trim()
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        showMessage(
          authMessage,
          "Account created. Checking your account..."
        );
        await checkSession();
      } else {
        showMessage(
          authMessage,
          "Registration received. Confirm your email, then log in."
        );
      }
    }
  } catch (error) {
    showMessage(authMessage, error.message);
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;

  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;

    currentUser = null;
    currentProfile = null;
    showAuth();
  } catch (error) {
    alert(`Could not log out: ${error.message}`);
  } finally {
    logoutBtn.disabled = false;
  }
});

function showAuth() {
  authSection.hidden = false;
  dashboardSection.hidden = true;
  dashboardContent.hidden = true;
  logoutBtn.hidden = true;
  authForm.reset();
  showMessage(authMessage, "");
}

async function checkSession() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  if (!data.session) {
    currentUser = null;
    currentProfile = null;
    showAuth();
    return;
  }

  // Verify the signed-in user with Supabase Auth.
  const { data: userData, error: userError } =
    await db.auth.getUser();

  if (userError) throw userError;

  currentUser = userData.user;

  if (!currentUser) {
    showAuth();
    return;
  }

  await loadDashboard();
}

async function loadDashboard() {
  authSection.hidden = true;
  dashboardSection.hidden = false;
  logoutBtn.hidden = false;
  dashboardContent.hidden = true;

  showMessage(accountStatus, "Checking your student account...");

  const { data: profile, error } = await db
    .from("profiles")
    .select("display_name, student_verified, account_status, is_admin")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    showMessage(
      accountStatus,
      `Could not load your profile: ${error.message}`
    );
    return;
  }

  currentProfile = profile;

  welcomeHeading.textContent =
    `Welcome, ${profile.display_name || "Student"}!`;

  if (
    !profile.student_verified ||
    profile.account_status !== "active"
  ) {
    showMessage(
      accountStatus,
      "Your account is awaiting student verification. You can log in, but posting and browsing errands are not yet available."
    );
    return;
  }

  showMessage(
    accountStatus,
    profile.is_admin
      ? "Administrator account active."
      : "Verified student account active."
  );

  dashboardContent.hidden = false;

 
  
await Promise.all([
  loadAvailableJobs(),
  loadMyJobs(),
  loadMyEarnings(),
  loadAdminDashboard()
]);


}


document.getElementById("refresh-admin")?.addEventListener(
  "click",
  loadAdminDashboard
);



async function loadAvailableJobs() {
  const jobsList = document.getElementById("jobs-list");
  jobsList.replaceChildren();

  const { data: { user }, error: userError } =
    await db.auth.getUser();

  if (userError || !user) {
    jobsList.textContent = "Please sign in to view errands.";
    return;
  }

  const { data: jobs, error } = await db
    .from("jobs")
    .select(`
      id,
      customer_id,
      title,
      description,
      category,
      pickup_location,
      dropoff_location,
      delivery_fee_zmw,
      item_cost_zmw,
      status,
      created_at
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    jobsList.textContent = "Could not load available errands.";
    return;
  }

  if (!jobs || jobs.length === 0) {
    jobsList.textContent = "No open errands right now.";
    return;
  }

  jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";

    const title = document.createElement("h3");
    title.textContent = job.title;

    const description = document.createElement("p");
    description.textContent = job.description || "No description provided.";

    const locations = document.createElement("p");
    locations.textContent =
      `Pickup: ${job.pickup_location} → Drop-off: ${job.dropoff_location}`;

    const category = document.createElement("p");
    category.textContent = `Category: ${job.category}`;

    const fee = document.createElement("p");
    fee.textContent = `Delivery fee: K${Number(job.delivery_fee_zmw).toFixed(2)}`;

    card.append(title, description, locations, category, fee);

    if (job.customer_id !== user.id) {
      const acceptButton = document.createElement("button");
      acceptButton.textContent = "Accept errand";

      acceptButton.addEventListener("click", () => {
        performJobAction(acceptButton, "accept", job.id);
      });

      card.appendChild(acceptButton);
    } else {
      const ownJob = document.createElement("p");
      ownJob.textContent = "You posted this errand.";
      card.appendChild(ownJob);
    }

    jobsList.appendChild(card);
  });
}










async function loadMyJobs() {
  const myJobsList = document.getElementById("my-jobs-list");
  myJobsList.replaceChildren();

  const { data: { user }, error: userError } =
    await db.auth.getUser();

  if (userError || !user) {
    myJobsList.textContent = "Please sign in to view your errands.";
    return;
  }

  const { data: jobs, error } = await db
    .from("jobs")
    .select(`
      id,
      title,
      status,
      delivery_fee_zmw,
      customer_id,
      runner_id,
      created_at
    `)
    .or(`customer_id.eq.${user.id},runner_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    myJobsList.textContent = "Could not load your errands.";
    return;
  }

  if (!jobs || jobs.length === 0) {
    myJobsList.textContent = "You have not posted or accepted any errands yet.";
    return;
  }

  jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";

    const title = document.createElement("h3");
    title.textContent = job.title;

    const status = document.createElement("p");
    status.textContent = `Status: ${job.status.replaceAll("_", " ")}`;

    const fee = document.createElement("p");
    fee.textContent = `Delivery fee: K${Number(job.delivery_fee_zmw).toFixed(2)}`;

    card.append(title, status, fee);

    let buttonLabel = "";
    let nextStatus = null;

    if (job.runner_id === user.id && job.status === "accepted") {
      buttonLabel = "Mark picked up";
      nextStatus = "picked_up";
    } else if (
      job.runner_id === user.id &&
      job.status === "picked_up"
    ) {
      buttonLabel = "Mark delivered";
      nextStatus = "delivered";
    } else if (
      job.customer_id === user.id &&
      job.status === "delivered"
    ) {
      buttonLabel = "Confirm completion";
      nextStatus = "completed";
    }

    if (nextStatus) {
      const actionButton = document.createElement("button");
      actionButton.textContent = buttonLabel;

      actionButton.addEventListener("click", () => {
        performJobAction(
          actionButton,
          "advance",
          job.id,
          nextStatus
        );
      });

      card.appendChild(actionButton);
    }

    myJobsList.appendChild(card);
  });
}


jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (
    !currentUser ||
    !currentProfile ||
    !currentProfile.student_verified ||
    currentProfile.account_status !== "active"
  ) {
    showMessage(jobMessage, "Your account is not approved to post errands.");
    return;
  }

  const button = document.getElementById("post-job-btn");
  button.disabled = true;
  showMessage(jobMessage, "Posting your errand...");

  try {
    const job = {
      customer_id: currentUser.id,
      title: document.getElementById("job-title").value.trim(),
      description: document.getElementById("job-description").value.trim(),
      category: document.getElementById("category").value,
      pickup_location: document.getElementById("pickup").value.trim(),
      dropoff_location: document.getElementById("dropoff").value.trim(),
      delivery_fee_zmw: Number(
        document.getElementById("delivery-fee").value
      ),
      item_cost_zmw: Number(
        document.getElementById("item-cost").value
      ),
      runner_id: null,
      status: "open"
    };

    const { error } = await db.from("jobs").insert(job);

    if (error) throw error;

    jobForm.reset();
    document.getElementById("item-cost").value = "0";

    showMessage(jobMessage, "Errand posted successfully!");

    await Promise.all([
      loadAvailableJobs(),
      loadMyJobs()
    ]);
  } catch (error) {
    showMessage(jobMessage, `Could not post errand: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("refresh-jobs").addEventListener(
  "click",
  loadAvailableJobs
);

// Restore an existing session when the page is refreshed.
checkSession().catch((error) => {
  showAuth();
  showMessage(authMessage, `Session check failed: ${error.message}`);
});



async function performJobAction(button, action, jobId, nextStatus = null) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Please wait...";

  try {
    let result;

    if (action === "accept") {
      result = await db.rpc("accept_job", {
        p_job_id: jobId
      });
    } else {
      result = await db.rpc("advance_job", {
        p_job_id: jobId,
        p_next_status: nextStatus
      });
    }

    if (result.error) {
      throw result.error;
    }

    alert("Errand updated successfully!");

    await Promise.all([
      loadAvailableJobs(),
      loadMyJobs()
    ]);
  } catch (error) {
    console.error("Errand action failed:", error);
    alert(error.message || "Something went wrong. Please try again.");
    button.disabled = false;
    button.textContent = originalText;
  }
}



async function loadMyEarnings() {
  const earningsList = document.getElementById("earnings-list");
  const completedCount = document.getElementById("completed-count");
  const runnerEarnings = document.getElementById("runner-earnings");

  if (!earningsList || !completedCount || !runnerEarnings) return;

  earningsList.replaceChildren();

  const { data: { user }, error: userError } =
    await db.auth.getUser();

  if (userError || !user) {
    earningsList.textContent = "Please sign in to view your earnings.";
    return;
  }

  const { data: jobs, error: jobsError } = await db
    .from("jobs")
    .select("id, title, delivery_fee_zmw, completed_at")
    .eq("runner_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  if (jobsError) {
    console.error("Completed errands error:", jobsError);
    earningsList.textContent = "Could not load completed errands.";
    return;
  }

  const completedJobs = jobs || [];
  let totalEarnings = 0;

  for (const job of completedJobs) {
    const { data: commission, error: commissionError } = await db
      .from("commission_ledger")
      .select("commission_amount_zmw, status")
      .eq("job_id", job.id)
      .maybeSingle();

    if (commissionError) {
      console.error("Commission error:", commissionError);
      earningsList.textContent = "Could not load commission records.";
      return;
    }

    const fee = Number(job.delivery_fee_zmw) || 0;
    const commissionAmount = Number(
      commission?.commission_amount_zmw || 0
    );
    const netEarning = fee - commissionAmount;

    totalEarnings += netEarning;

    const card = document.createElement("div");
    card.className = "job-card";

    const title = document.createElement("h3");
    title.textContent = job.title;

    const details = document.createElement("p");
    details.textContent =
      `Delivery fee: K${fee.toFixed(2)} | ` +
      `Commission: K${commissionAmount.toFixed(2)} | ` +
      `Your earnings: K${netEarning.toFixed(2)}`;

    card.append(title, details);

    earningsList.appendChild(card);
  }

  completedCount.textContent = completedJobs.length;
  runnerEarnings.textContent = `K${totalEarnings.toFixed(2)}`;

  if (completedJobs.length === 0) {
    earningsList.textContent = "No completed errands yet.";
  }
}



async function loadAdminDashboard() {
  const adminSection = document.getElementById("admin-section");
  if (!adminSection) return;

  // Keep the dashboard hidden unless the current profile is an admin.
  adminSection.hidden = !currentProfile?.is_admin;

  if (!currentProfile?.is_admin) return;

  const message = document.getElementById("admin-message");
  message.textContent = "Loading admin figures...";

  try {
    const { data: jobs, error: jobsError } = await db
      .from("jobs")
      .select("id")
      .eq("status", "completed");

    if (jobsError) throw jobsError;

    const { data: ledger, error: ledgerError } = await db
      .from("commission_ledger")
      .select("commission_amount_zmw, status");

    if (ledgerError) throw ledgerError;

    const records = ledger || [];

    const total = records.reduce(
      (sum, record) => sum + Number(record.commission_amount_zmw || 0),
      0
    );

    const pending = records
      .filter(record => record.status === "pending")
      .reduce(
        (sum, record) => sum + Number(record.commission_amount_zmw || 0),
        0
      );

    const paid = records
      .filter(record => record.status === "paid")
      .reduce(
        (sum, record) => sum + Number(record.commission_amount_zmw || 0),
        0
      );

    document.getElementById("admin-completed-count").textContent =
      jobs.length;

    document.getElementById("admin-total-commission").textContent =
      `K${total.toFixed(2)}`;

    document.getElementById("admin-pending-commission").textContent =
      `K${pending.toFixed(2)}`;

    document.getElementById("admin-paid-commission").textContent =
      `K${paid.toFixed(2)}`;

    message.textContent = "Admin figures updated.";
  } catch (error) {
    console.error("Admin dashboard error:", error);
    message.textContent =
      "Could not load admin figures. Check your database policies.";
  }
}
