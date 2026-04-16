// =========================================
// FINSIGHT - Savings Planner JS (Corrected & Complete)
// =========================================

// ── AUTH GUARD ──
(function() {
  const user = JSON.parse(localStorage.getItem("finsightUser"));
  if (!user || !user.loggedIn) {
    window.location.href = "login.html";
  }
})();

// ── STATE ──
let goal = null;
// goal = { name, amount, months, currentSavings, annualRate }

let monthLogs = [];
// each = { monthLabel, income, totalExpenses, surplus, contributed, interest, balance }

let step1DataChanged = false;

const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

// ── FORMAT ──
function fmt(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
function fmtPct(n) { return n.toFixed(1) + "%"; }

// ── TOAST ──
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => { t.className = "toast"; }, 3500);
}

// ── SAVE / LOAD ──
function saveState() {
  localStorage.setItem("finsight_goal", JSON.stringify(goal));
  localStorage.setItem("finsight_logs", JSON.stringify(monthLogs));
}
function loadState() {
  const g = localStorage.getItem("finsight_goal");
  const l = localStorage.getItem("finsight_logs");
  if (g) {
    goal      = JSON.parse(g);
    monthLogs = l ? JSON.parse(l) : [];
    document.getElementById("goal-name").value       = goal.name || "";
    document.getElementById("goal-amount").value     = goal.amount || "";
    document.getElementById("goal-months").value     = goal.months || "";
    document.getElementById("current-savings").value = goal.currentSavings || 0;
    document.getElementById("investment").value      = String(goal.annualRate ?? 10);
    step1DataChanged = false;
    showStep1(false);
    updateGoToStep2Button();
  }
}

// ── CORRECT INTEREST FORMULA ──
// Interest is earned on (prevBalance + this month's contribution).
// Standard approach: deposit at start of month → full month of interest.
function calcMonthEntry(prevBalance, contributed, annualRate) {
  const r        = annualRate / 100 / 12;
  const interest = annualRate > 0 ? (prevBalance + contributed) * r : 0;
  const balance  = prevBalance + contributed + interest;
  return { interest, balance };
}

// ── CORRECT REQUIRED MONTHLY (PMT formula) ──
// How much to save per month for remaining months to hit goal,
// given current balance growing at annualRate.
function calcRequiredMonthly(currentBalance, target, remainingMonths, annualRate) {
  if (remainingMonths <= 0) return 0;
  if (annualRate === 0) return Math.max(0, (target - currentBalance) / remainingMonths);
  const r         = annualRate / 100 / 12;
  const fvExisting = currentBalance * Math.pow(1 + r, remainingMonths);
  const gap        = target - fvExisting;
  if (gap <= 0) return 0;
  // PMT = gap / [((1+r)^n - 1) / r]
  return gap / ((Math.pow(1 + r, remainingMonths) - 1) / r);
}

// ── LIVE TOTALS ──
function updateLiveTotals() {
  const income  = parseFloat(document.getElementById("log-income").value)   || 0;
  const expense = parseFloat(document.getElementById("total-expense").value) || 0;
  const surplus = income - expense;
  const contrib = Math.max(0, surplus);
  document.getElementById("live-expense-total").textContent = fmt(expense);
  const el = document.getElementById("live-surplus");
  el.className  = "live-value " + (surplus >= 0 ? "positive" : "negative");
  el.textContent = (surplus < 0 ? "-" : "") + fmt(Math.abs(surplus));
  document.getElementById("live-savings-contrib").textContent = fmt(contrib);
}

// ── STEP NAVIGATION ──
function showStep1(hideResults = true) {
  document.getElementById("goal-setup-card").style.display  = "block";
  document.getElementById("monthly-log-card").style.display = "none";
  if (hideResults) document.getElementById("results-section").style.display = "none";
  updateGoToStep2Button();
}
function showStep2() {
  document.getElementById("goal-setup-card").style.display  = "none";
  document.getElementById("monthly-log-card").style.display = "block";
  updateGoalPill();
  autoAdvanceMonthInput();
  showRequiredMonthlyBanner();
  if (monthLogs.length > 0) {
    document.getElementById("results-section").style.display = "block";
    renderAll();
  } else {
    document.getElementById("results-section").style.display = "none";
  }
}
function goToStep1()        { showStep1(false); }
function goToExistingPlan() {
  if (!goal)             { showToast("⚠️ No plan yet. Fill Step 1 first.", "warn"); return; }
  if (step1DataChanged)  { showToast("⚠️ You changed the goal fields. Submit first to save.", "warn"); return; }
  showStep2();
}
function updateGoToStep2Button() {
  const btn = document.getElementById("go-to-step2-btn");
  if (!btn) return;
  btn.style.display = (goal && !step1DataChanged) ? "inline-block" : "none";
}

// ── REQUIRED MONTHLY BANNER ──
function showRequiredMonthlyBanner() {
  const banner = document.getElementById("required-monthly-banner");
  if (!banner || !goal) return;
  const currentBalance  = monthLogs.length > 0 ? monthLogs[monthLogs.length - 1].balance : goal.currentSavings;
  const remainingMonths = goal.months - monthLogs.length;
  if (remainingMonths <= 0) { banner.style.display = "none"; return; }
  const req = calcRequiredMonthly(currentBalance, goal.amount, remainingMonths, goal.annualRate);
  banner.style.display = "flex";
  banner.innerHTML = `
    <span>🎯</span>
    <div>
      <strong>Save ${fmt(req)} per month</strong> for the next ${remainingMonths} month${remainingMonths > 1 ? "s" : ""} to reach ${fmt(goal.amount)}.
      ${goal.annualRate > 0 ? `<span class="banner-note">(includes ${goal.annualRate}% p.a. compound growth)</span>` : ""}
    </div>
  `;
}

// ── GOAL PILL ──
function updateGoalPill() {
  if (!goal) return;
  const bal = monthLogs.length > 0 ? monthLogs[monthLogs.length - 1].balance : goal.currentSavings;
  const pct = Math.min(100, (bal / goal.amount) * 100);
  document.getElementById("goal-pill").innerHTML = `
    <span class="pill purple">🎯 ${goal.name}</span>
    <span class="pill">Target: ${fmt(goal.amount)}</span>
    <span class="pill">${goal.months} months</span>
    <span class="pill ${pct >= 100 ? "green" : ""}">Saved: ${fmt(bal)} (${fmtPct(pct)})</span>
    ${goal.annualRate > 0 ? `<span class="pill">${goal.annualRate}% p.a.</span>` : ""}
  `;
}

// ── AUTO ADVANCE MONTH ──
function autoAdvanceMonthInput() {
  if (monthLogs.length === 0) {
    const now = new Date();
    document.getElementById("log-month").value =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return;
  }
  const last  = monthLogs[monthLogs.length - 1];
  const parts = last.monthLabel.split(" ");
  const mIdx  = MONTH_NAMES.indexOf(parts[0]);
  const yr    = parseInt(parts[1]);
  const next  = new Date(yr, mIdx + 1);
  document.getElementById("log-month").value =
    `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

// ── STEP 1 SUBMIT ──
document.getElementById("goal-form").addEventListener("submit", function(e) {
  e.preventDefault();
  const name    = document.getElementById("goal-name").value.trim() || "My Savings Goal";
  const amount  = parseFloat(document.getElementById("goal-amount").value)    || 0;
  const months  = parseInt(document.getElementById("goal-months").value)      || 0;
  const current = parseFloat(document.getElementById("current-savings").value) || 0;
  const rate    = parseFloat(document.getElementById("investment").value)     || 0;

  if (amount <= 0) { showToast("⚠️ Please enter a target amount.", "warn"); return; }
  if (months <= 0) { showToast("⚠️ Please enter goal duration in months.", "warn"); return; }

  // Only reset logs if financial params changed (not just name)
  const financialsChanged = !goal
    || goal.amount    !== amount
    || goal.months    !== months
    || goal.annualRate !== rate;

  if (financialsChanged && monthLogs.length > 0) {
    if (!confirm("Changing goal amount, duration or rate will reset your logged months. Continue?")) return;
    monthLogs = [];
  }

  goal = { name, amount, months, currentSavings: current, annualRate: rate };
  step1DataChanged = false;
  saveState();
  showStep2();
  showToast(financialsChanged ? "✅ Goal set! Now log your first month." : "✅ Goal name updated!", "success");
});

// Track step 1 changes
document.querySelectorAll("#goal-form input, #goal-form select").forEach(el => {
  el.addEventListener("input", () => { step1DataChanged = true; updateGoToStep2Button(); });
});

// ── STEP 2 SUBMIT ──
document.getElementById("log-form").addEventListener("submit", function(e) {
  e.preventDefault();
  const monthInput = document.getElementById("log-month").value;
  if (!monthInput) { showToast("⚠️ Please select a month.", "warn"); return; }

  const [year, month] = monthInput.split("-");
  const monthLabel = MONTH_NAMES[parseInt(month) - 1] + " " + year;

  if (monthLogs.find(l => l.monthLabel === monthLabel)) {
    showToast("⚠️ Already logged " + monthLabel + ". Delete it first to re-enter.", "warn");
    return;
  }

  const income = parseFloat(document.getElementById("log-income").value) || 0;
  if (income <= 0) { showToast("⚠️ Please enter your income.", "warn"); return; }

  const totalExpenses = parseFloat(document.getElementById("total-expense").value) || 0;
  const surplus       = income - totalExpenses;
  const contributed   = Math.max(0, surplus);
  const prevBalance   = monthLogs.length > 0 ? monthLogs[monthLogs.length - 1].balance : goal.currentSavings;

  // ✅ Correct interest formula
  const { interest, balance } = calcMonthEntry(prevBalance, contributed, goal.annualRate);

  monthLogs.push({ monthLabel, income, totalExpenses, surplus, contributed, interest, balance });
  saveState();

  document.getElementById("log-income").value    = "";
  document.getElementById("total-expense").value = "";
  updateLiveTotals();
  autoAdvanceMonthInput();
  updateGoalPill();
  showRequiredMonthlyBanner();
  document.getElementById("results-section").style.display = "block";
  renderAll();
  document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
  showToast("✅ Month logged! Projections updated.", "success");
});

// ── DELETE ENTRY ──
function deleteLogEntry(index) {
  if (!confirm(`Delete entry for ${monthLogs[index].monthLabel}? Subsequent months will be recalculated.`)) return;
  monthLogs.splice(index, 1);
  recalcFrom(index);
  saveState();
  updateGoalPill();
  autoAdvanceMonthInput();
  showRequiredMonthlyBanner();
  if (monthLogs.length === 0) {
    document.getElementById("results-section").style.display = "none";
  } else {
    renderAll();
  }
  showToast("🗑️ Entry deleted. Balances recalculated.", "success");
}

// ── EDIT ENTRY ──
function editLogEntry(index) {
  const entry  = monthLogs[index];
  const parts  = entry.monthLabel.split(" ");
  const mIdx   = MONTH_NAMES.indexOf(parts[0]);
  document.getElementById("log-month").value         = `${parts[1]}-${String(mIdx + 1).padStart(2, "0")}`;
  document.getElementById("log-income").value         = entry.income;
  document.getElementById("total-expense").value      = entry.totalExpenses;
  updateLiveTotals();
  monthLogs.splice(index, 1);
  recalcFrom(index);
  saveState();
  if (monthLogs.length === 0) {
    document.getElementById("results-section").style.display = "none";
  } else {
    renderAll();
    updateGoalPill();
    showRequiredMonthlyBanner();
  }
  window.scrollTo({ top: document.getElementById("monthly-log-card").offsetTop - 80, behavior: "smooth" });
  showToast("✏️ Edit the values and submit to save.", "success");
}

// ── RECALCULATE FROM INDEX ──
function recalcFrom(startIndex) {
  for (let i = startIndex; i < monthLogs.length; i++) {
    const prevBalance = i === 0 ? goal.currentSavings : monthLogs[i - 1].balance;
    const { interest, balance } = calcMonthEntry(prevBalance, monthLogs[i].contributed, goal.annualRate);
    monthLogs[i].interest = interest;
    monthLogs[i].balance  = balance;
  }
}

// ── RESET GOAL ──
function resetGoal() {
  if (!confirm("This will clear your goal and ALL logged months. Are you sure?")) return;
  goal = null; monthLogs = []; step1DataChanged = false;
  localStorage.removeItem("finsight_goal");
  localStorage.removeItem("finsight_logs");
  document.getElementById("goal-form").reset();
  document.getElementById("results-section").style.display = "none";
  showStep1(true);
  showToast("Goal cleared. Start fresh!", "success");
}

// ── RENDER ALL ──
function renderAll() {
  renderGoalProgress();
  renderSummaryCards();
  renderHistoryTable();
  renderProjectionTable();
  
}

// ── GOAL PROGRESS ──
function renderGoalProgress() {
  const currentBalance = monthLogs.length > 0 ? monthLogs[monthLogs.length - 1].balance : goal.currentSavings;
  const progressPct    = Math.min(100, (currentBalance / goal.amount) * 100);
  const logged         = monthLogs.length;
  const remaining      = goal.months - logged;
  const reached        = currentBalance >= goal.amount;
  const periodOver     = remaining <= 0 && !reached;

  const avgContrib = monthLogs.length > 0
    ? monthLogs.reduce((s, l) => s + l.contributed, 0) / monthLogs.length : 0;

  let projBalance = currentBalance;
  for (let i = 0; i < remaining; i++) {
    const { balance } = calcMonthEntry(projBalance, avgContrib, goal.annualRate);
    projBalance = balance;
  }
  const projPct  = Math.min(100, (projBalance / goal.amount) * 100);
  const canReach = projBalance >= goal.amount;

  document.getElementById("goal-progress-section").innerHTML = `
    <div class="results-heading">
      <span class="section-tag" style="color:rgb(141,15,214)">Goal Tracker</span>
      <h2>🎯 ${goal.name}</h2>
      <p class="results-sub">Target: ${fmt(goal.amount)} &nbsp;|&nbsp; ${logged} of ${goal.months} months logged</p>
    </div>
    <div class="goal-card">
      <div class="goal-bar-block">
        <div class="goal-bar-label">
          <span>Current Balance: ${fmt(currentBalance)}</span>
          <span>${fmtPct(progressPct)}</span>
        </div>
        <div class="goal-bar-wrap">
          <div class="goal-bar-fill current-fill" style="width:${progressPct}%"></div>
        </div>
      </div>
      ${remaining > 0 ? `
      <div class="goal-bar-block" style="margin-top:14px;">
        <div class="goal-bar-label">
          <span>Projected at end of ${goal.months} months: ${fmt(projBalance)}</span>
          <span>${fmtPct(projPct)}</span>
        </div>
        <div class="goal-bar-wrap">
          <div class="goal-bar-fill projected-fill ${canReach ? "" : "over-fill"}" style="width:${projPct}%"></div>
        </div>
      </div>` : ""}
      <div class="goal-badges">
        ${reached
          ? `<span class="tag-ok">🏆 Goal Reached!</span>`
          : periodOver
            ? `<span class="tag-over">❌ Period ended — shortfall: ${fmt(goal.amount - currentBalance)}</span>`
            : `<span class="tag-info">${fmt(goal.amount - currentBalance)} still needed</span>`}
        ${remaining > 0 && !reached
          ? canReach
            ? `<span class="tag-ok">✅ On Track</span>`
            : `<span class="tag-over">⚠️ Projected shortfall: ${fmt(goal.amount - projBalance)}</span>`
          : ""}
        ${remaining > 0 ? `<span class="tag-info">${remaining} month${remaining > 1 ? "s" : ""} remaining</span>` : ""}
      </div>
    </div>
  `;
}

// ── SUMMARY CARDS ──
function renderSummaryCards() {
  const logged = monthLogs.length;
  if (logged === 0) return;
  const totalContributed = monthLogs.reduce((s, l) => s + l.contributed, 0);
  const totalInterest    = monthLogs.reduce((s, l) => s + l.interest, 0);
  const currentBalance   = monthLogs[logged - 1].balance;
  const avgSurplus       = monthLogs.reduce((s, l) => s + l.surplus, 0) / logged;
  const avgContrib       = totalContributed / logged;
  const remainingMonths  = goal.months - logged;
  const requiredMonthly  = calcRequiredMonthly(currentBalance, goal.amount, remainingMonths, goal.annualRate);

  let statusCard = "";
  if (remainingMonths <= 0 && currentBalance < goal.amount) {
    statusCard = `<div class="sum-card negative">
      <div class="sum-icon">❌</div><div class="sum-label">Goal Status</div>
      <div class="sum-value" style="font-size:16px;">Goal Missed</div>
      <div class="sum-sub">Shortfall: ${fmt(goal.amount - currentBalance)}</div></div>`;
  } else if (currentBalance >= goal.amount) {
    statusCard = `<div class="sum-card positive">
      <div class="sum-icon">🏆</div><div class="sum-label">Goal Status</div>
      <div class="sum-value" style="font-size:16px;">Reached! 🎉</div>
      <div class="sum-sub">Extra: ${fmt(currentBalance - goal.amount)}</div></div>`;
  } else {
    statusCard = `<div class="sum-card ${requiredMonthly <= avgContrib * 1.1 ? "positive" : "negative"}">
      <div class="sum-icon">🎯</div><div class="sum-label">Need Per Month</div>
      <div class="sum-value">${fmt(requiredMonthly)}</div>
      <div class="sum-sub">${remainingMonths} month${remainingMonths > 1 ? "s" : ""} left</div></div>`;
  }

  document.getElementById("summary-cards").innerHTML = `
    <div class="sum-card">
      <div class="sum-icon">💰</div><div class="sum-label">Current Balance</div>
      <div class="sum-value">${fmt(currentBalance)}</div>
      <div class="sum-sub">After ${logged} month${logged > 1 ? "s" : ""}</div>
    </div>
    <div class="sum-card positive">
      <div class="sum-icon">📥</div><div class="sum-label">Total Contributed</div>
      <div class="sum-value">${fmt(totalContributed)}</div>
      <div class="sum-sub">Your actual deposits</div>
    </div>
    <div class="sum-card positive">
      <div class="sum-icon">📈</div><div class="sum-label">Interest Earned</div>
      <div class="sum-value">${fmt(totalInterest)}</div>
      <div class="sum-sub">${goal.annualRate}% p.a.</div>
    </div>
    <div class="sum-card ${avgSurplus >= 0 ? "" : "negative"}">
      <div class="sum-icon">📊</div><div class="sum-label">Avg Monthly Surplus</div>
      <div class="sum-value">${fmt(Math.abs(avgSurplus))}</div>
      <div class="sum-sub">${avgSurplus >= 0 ? "avg saved/month" : "avg deficit/month"}</div>
    </div>
    ${statusCard}
  `;
}

// ── HISTORY TABLE ──
function renderHistoryTable() {
  if (monthLogs.length === 0) { document.getElementById("history-section").style.display = "none"; return; }
  document.getElementById("history-section").style.display = "block";

  const rows = monthLogs.map((l, i) => {
    const pct = Math.min(100, (l.balance / goal.amount) * 100);
    return `
      <tr>
        <td><strong>${l.monthLabel}</strong></td>
        <td>${fmt(l.income)}</td>
        <td>${fmt(l.totalExpenses)}</td>
        <td class="${l.surplus >= 0 ? "pos" : "neg"}">${l.surplus >= 0 ? "+" : ""}${fmt(l.surplus)}</td>
        <td class="${l.contributed > 0 ? "pos" : ""}">${fmt(l.contributed)}</td>
        <td class="pos">+${fmt(l.interest)}</td>
        <td><strong>${fmt(l.balance)}</strong></td>
        <td>
          <div class="pct-cell">
            <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;${l.balance >= goal.amount ? "background:#16a34a;" : ""}"></div></div>
            <span>${fmtPct(pct)}</span>
          </div>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="action-btn edit-btn"   onclick="editLogEntry(${i})"   title="Edit">✏️</button>
            <button class="action-btn delete-btn" onclick="deleteLogEntry(${i})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join("");
  document.getElementById("history-body").innerHTML = rows;
}

// ── PROJECTION TABLE ──
function renderProjectionTable() {
  const logged    = monthLogs.length;
  const remaining = goal.months - logged;
  if (remaining <= 0 || logged === 0) { document.getElementById("projection-section").style.display = "none"; return; }
  document.getElementById("projection-section").style.display = "block";

  const currentBalance  = monthLogs[logged - 1].balance;
  const recent          = monthLogs.slice(-Math.min(3, logged));
  const avgContrib      = recent.reduce((s, l) => s + l.contributed, 0) / recent.length;
  const requiredMonthly = calcRequiredMonthly(currentBalance, goal.amount, remaining, goal.annualRate);

  document.getElementById("projection-sub").innerHTML =
    `Projecting with your recent average of <strong>${fmt(avgContrib)}/month</strong>. 
     You need <strong>${fmt(requiredMonthly)}/month</strong> to reach your goal on time.`;

  let balance     = currentBalance;
  let goalReached = false;
  const rows      = [];

  for (let i = 1; i <= remaining; i++) {
    const { interest, balance: newBalance } = calcMonthEntry(balance, avgContrib, goal.annualRate);
    balance = newBalance;
    const pct       = Math.min(100, (balance / goal.amount) * 100);
    const isGoalMet = !goalReached && balance >= goal.amount;
    if (isGoalMet) goalReached = true;

    rows.push(`
      <tr class="${isGoalMet ? "top-spender" : ""}">
        <td><strong>Month ${logged + i}</strong> <span style="color:#8888aa;font-size:12px;">(projected)</span></td>
        <td class="pos">~${fmt(avgContrib)}</td>
        <td class="pos">+${fmt(interest)}</td>
        <td class="${balance >= goal.amount ? "pos" : ""}">${fmt(balance)}</td>
        <td>
          <div class="pct-cell">
            <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;${balance >= goal.amount ? "background:#16a34a;" : ""}"></div></div>
            <span>${fmtPct(pct)}</span>
          </div>
        </td>
        <td>${isGoalMet ? '<span class="tag-ok">🏆 Goal Reached!</span>' : (balance >= goal.amount ? '<span class="tag-ok">✅ Done</span>' : "")}</td>
      </tr>`);
  }
  document.getElementById("projection-body").innerHTML = rows.join("");
}

