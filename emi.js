// =========================================
// FINSIGHT - EMI Calculator JS
// =========================================

// ── AUTH GUARD ──
(function() {
  const user = JSON.parse(localStorage.getItem("finsightUser"));
  if (!user || !user.loggedIn) {
    window.location.href = "login.html";
  }
})();


const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

// ── FORMAT ──
function fmt(n)    { 
return "₹" + Math.round(n).toLocaleString("en-IN"); 
}
function fmtD(n,d) { 
return "₹" + Number(n).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
 }
function fmtPct(n) { return n.toFixed(1) + "%"; }
function fmtYM(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m > 1 ? "s" : ""}`;
  if (m === 0) return `${y} year${y > 1 ? "s" : ""}`;
  return `${y} yr${y > 1 ? "s" : ""} ${m} mo`;
}

// ── TOAST ──
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => { t.className = "toast"; }, 3200);
}

// ── EMI FORMULA ──
// EMI = P * r * (1+r)^n / ((1+r)^n - 1)
// P = principal, r = monthly rate, n = months
function calcEMI(principal, annualRate, months) {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 100 / 12;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

// ── BUILD AMORTISATION SCHEDULE ──
// Returns array of monthly entries. Stops early if prepayment closes loan.
function buildSchedule(principal, annualRate, months, prepayment, startYear, startMonth) {
  const r      = annualRate / 100 / 12;
  const emi    = calcEMI(principal, annualRate, months);
  let balance  = principal;
  const rows   = [];
  let yr = startYear, mo = startMonth;

  for (let i = 1; i <= months; i++) {
    if (balance <= 0) break;

    const interest   = annualRate > 0 ? balance * r : 0;
    const principal_ = Math.min(emi - interest, balance); // principal portion of EMI
    const prep       = Math.min(prepayment, balance - principal_); // extra payment, capped at remaining
    const totalPaid  = principal_ + interest + prep;
    balance          = Math.max(0, balance - principal_ - prep);

    rows.push({
      no: i,
      monthLabel: MONTH_NAMES[mo] + " " + yr,
      year: yr,
      emi: emi,
      principal: principal_,
      interest: interest,
      prepayment: prep,
      totalPaid: totalPaid,
      balance: balance,
    });

    mo++;
    if (mo > 11) { mo = 0; yr++; }

    if (balance < 1) break; // loan closed
  }
  return rows;
}

// ── RANGE ↔ INPUT SYNC ──
function syncRange(inputId, rangeId) {
  const input = document.getElementById(inputId);
  const range = document.getElementById(rangeId);
  if (!input || !range) return;

  input.addEventListener("input", () => {
    let v = parseFloat(input.value);
    if (!isNaN(v)) {
      v = Math.max(parseFloat(range.min), Math.min(parseFloat(range.max), v));
      range.value = v;
      updateRangeBackground(range);
    }
  });
  range.addEventListener("input", () => {
    input.value = range.value;
    updateRangeBackground(range);
  });
  updateRangeBackground(range);
}

function updateRangeBackground(range) {
  const min  = parseFloat(range.min);
  const max  = parseFloat(range.max);
  const val  = parseFloat(range.value);
  const pct  = ((val - min) / (max - min)) * 100;
  range.style.background =
    `linear-gradient(to right, rgb(141,15,214) 0%, rgb(141,15,214) ${pct}%, #e0d4f7 ${pct}%, #e0d4f7 100%)`;
}

// ── TENURE RANGE SYNC (years/months aware) ──
function setupTenureSync() {
  const input  = document.getElementById("tenure");
  const range  = document.getElementById("tenure-range");
  const select = document.getElementById("tenure-type");

  function toYears() {
    const v = parseFloat(input.value) || 0;
    return select.value === "months" ? v / 12 : v;
  }

  input.addEventListener("input", () => {
    const yr = toYears();
    range.value = Math.min(30, Math.max(1, yr));
    updateRangeBackground(range);
  });
  range.addEventListener("input", () => {
    if (select.value === "months") {
      input.value = Math.round(parseFloat(range.value) * 12);
    } else {
      input.value = range.value;
    }
    updateRangeBackground(range);
  });
  select.addEventListener("change", () => {
    const yr = toYears();
    range.value = Math.min(30, Math.max(1, yr));
    updateRangeBackground(range);
  });
  updateRangeBackground(range);
}

// ── LOAN TYPE PILLS ──
function setupLoanTypePills() {
  document.querySelectorAll(".pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const rate = parseFloat(btn.dataset.rate);
      if (rate > 0) {
        document.getElementById("interest-rate").value = rate;
        document.getElementById("interest-rate-range").value = rate;
        updateRangeBackground(document.getElementById("interest-rate-range"));
      }
    });
  });
}

// ── CURRENT SCHEDULE (saved for year filter) ──
let currentSchedule = [];
let currentData     = {};

// ── MAIN CALCULATE ──
function calculate(e) {
  e.preventDefault();

  const principal  = parseFloat(document.getElementById("loan-amount").value)  || 0;
  const annualRate = parseFloat(document.getElementById("interest-rate").value) || 0;
  const tenureRaw  = parseFloat(document.getElementById("tenure").value)        || 0;
  const tenureType = document.getElementById("tenure-type").value;
  const prepayment = parseFloat(document.getElementById("prepayment").value)    || 0;
  const startInput = document.getElementById("start-date").value;

  if (principal <= 0)  { showToast("⚠️ Please enter a loan amount.",          "warn"); return; }
  if (annualRate <= 0) { showToast("⚠️ Please enter an interest rate.",        "warn"); return; }
  if (tenureRaw <= 0)  { showToast("⚠️ Please enter the loan tenure.",         "warn"); return; }
  if (!startInput)     { showToast("⚠️ Please select a loan start date.",      "warn"); return; }

  const totalMonths = tenureType === "months" ? Math.round(tenureRaw) : Math.round(tenureRaw * 12);
  const [sy, sm]    = startInput.split("-").map(Number);
  const emi         = calcEMI(principal, annualRate, totalMonths);

  // Full schedule (without prepayment) for baseline comparison
  const scheduleBase = buildSchedule(principal, annualRate, totalMonths, 0, sy, sm - 1);
  // Schedule with prepayment
  const schedulePrep = prepayment > 0
    ? buildSchedule(principal, annualRate, totalMonths, prepayment, sy, sm - 1)
    : null;

  const totalInterestBase  = scheduleBase.reduce((s, r) => s + r.interest,    0);
  const totalPaidBase      = scheduleBase.reduce((s, r) => s + r.totalPaid,   0);
  const actualMonthsBase   = scheduleBase.length;

  currentSchedule = scheduleBase;
  currentData = {
    principal, annualRate, totalMonths, emi,
    totalInterestBase, totalPaidBase, actualMonthsBase,
    prepayment, schedulePrep,
    scheduleBase
  };

  document.getElementById("results-section").style.display = "block";
  renderHero();
  renderSummaryCards();
  renderDonut();
  renderPrepaymentSection();
  
  renderAmortTable("all");
  renderYearFilter();

  setTimeout(() => document.getElementById("results-section").scrollIntoView({ behavior: "smooth" }), 60);
  showToast("✅ EMI calculated!", "success");
}

// ── HERO CARD ──
function renderHero() {
  const { emi, principal, annualRate, totalMonths, totalInterestBase, totalPaidBase, actualMonthsBase } = currentData;
  const activePill = document.querySelector(".pill-btn.active")?.dataset.label || "Loan";

  document.getElementById("emi-hero-section").innerHTML = `
    <div class="results-heading">
      <span class="section-tag" style="color:rgb(141,15,214)">Result</span>
      <h2>Your EMI Summary</h2>
    </div>
    <div class="emi-hero">
      <div class="emi-hero-left">
        <div class="emi-hero-label">Monthly EMI</div>
        <div class="emi-hero-amount">${fmt(emi)}</div>
        <div class="emi-hero-sub">${activePill} · ${annualRate}% p.a. · ${fmtYM(totalMonths)}</div>
      </div>
      <div class="emi-hero-right">
        <div class="emi-stat">
          <div class="emi-stat-label">Principal</div>
          <div class="emi-stat-value">${fmt(principal)}</div>
        </div>
        <div class="emi-stat">
          <div class="emi-stat-label">Total Interest</div>
          <div class="emi-stat-value accent">${fmt(totalInterestBase)}</div>
        </div>
        <div class="emi-stat">
          <div class="emi-stat-label">Total Payable</div>
          <div class="emi-stat-value">${fmt(totalPaidBase)}</div>
        </div>
      </div>
    </div>
  `;
}

// ── SUMMARY CARDS ──
function renderSummaryCards() {
  const { principal, emi, totalInterestBase, totalPaidBase, totalMonths, annualRate } = currentData;
  const interestRatio = (totalInterestBase / principal * 100).toFixed(1);

  document.getElementById("summary-cards").innerHTML = `
    <div class="sum-card accent">
      <div class="sum-icon">📅</div>
      <div class="sum-label">Monthly EMI</div>
      <div class="sum-value">${fmt(emi)}</div>
      <div class="sum-sub">For ${fmtYM(totalMonths)}</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">🏦</div>
      <div class="sum-label">Loan Principal</div>
      <div class="sum-value">${fmt(principal)}</div>
      <div class="sum-sub">Amount borrowed</div>
    </div>
    <div class="sum-card negative">
      <div class="sum-icon">💸</div>
      <div class="sum-label">Total Interest</div>
      <div class="sum-value">${fmt(totalInterestBase)}</div>
      <div class="sum-sub">${interestRatio}% of principal</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">💳</div>
      <div class="sum-label">Total Payable</div>
      <div class="sum-value">${fmt(totalPaidBase)}</div>
      <div class="sum-sub">Principal + Interest</div>
    </div>
  `;
}

// ── DONUT CHART ── (pure SVG, no library needed)
function renderDonut() {
  const { principal, totalInterestBase, totalPaidBase, emi } = currentData;
  const CIRC = 2 * Math.PI * 80; // circumference of r=80 circle

  const interestPct  = totalInterestBase / totalPaidBase;
  const principalPct = principal         / totalPaidBase;

  const interestArc  = CIRC * interestPct;
  const principalArc = CIRC * principalPct;

  // Interest arc starts at 0 (top after rotate -90)
  document.getElementById("donut-interest").setAttribute("stroke-dasharray",
    `${interestArc.toFixed(2)} ${(CIRC - interestArc).toFixed(2)}`);

  // Principal arc starts where interest ends
  const principalOffset = CIRC - interestArc;
  document.getElementById("donut-principal").setAttribute("stroke-dasharray",
    `${principalArc.toFixed(2)} ${(CIRC - principalArc).toFixed(2)}`);
  document.getElementById("donut-principal").setAttribute("stroke-dashoffset",
    `-${interestArc.toFixed(2)}`);

  document.getElementById("donut-center-value").textContent = fmt(emi);
  document.getElementById("legend-interest-pct").textContent  = fmtPct(interestPct * 100);
  document.getElementById("legend-principal-pct").textContent = fmtPct(principalPct * 100);

  // Chart stats
  const { totalMonths } = currentData;
  document.getElementById("chart-stats").innerHTML = `
    <div class="stat-box">
      <div class="stat-box-label">Loan Principal</div>
      <div class="stat-box-value">${fmt(principal)}</div>
      <div class="stat-box-sub">${fmtPct(principalPct * 100)} of total</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-label">Total Interest</div>
      <div class="stat-box-value">${fmt(totalInterestBase)}</div>
      <div class="stat-box-sub">${fmtPct(interestPct * 100)} of total</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-label">Total Amount</div>
      <div class="stat-box-value">${fmt(totalPaidBase)}</div>
      <div class="stat-box-sub">Over ${fmtYM(totalMonths)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-label">Effective Cost</div>
      <div class="stat-box-value">${(totalInterestBase / principal * 100).toFixed(1)}%</div>
      <div class="stat-box-sub">Interest as % of loan</div>
    </div>
  `;
}

// ── PREPAYMENT SECTION ──
function renderPrepaymentSection() {
  const { prepayment, schedulePrep, scheduleBase, principal, totalInterestBase, totalPaidBase, totalMonths } = currentData;
  const section = document.getElementById("prepayment-section");

  if (!schedulePrep || prepayment <= 0) { section.style.display = "none"; return; }
  section.style.display = "block";

  const totalInterestPrep = schedulePrep.reduce((s, r) => s + r.interest, 0);
  const totalPaidPrep     = schedulePrep.reduce((s, r) => s + r.totalPaid, 0);
  const actualMonthsPrep  = schedulePrep.length;
  const interestSaved     = totalInterestBase - totalInterestPrep;
  const monthsSaved       = totalMonths - actualMonthsPrep;

  document.getElementById("prepayment-cards").innerHTML = `
    <div class="prep-card">
      <div class="prep-card-title">Without Prepayment</div>
      <div class="prep-row"><span>Monthly EMI</span><strong>${fmt(currentData.emi)}</strong></div>
      <div class="prep-row"><span>Loan Tenure</span><strong>${fmtYM(totalMonths)}</strong></div>
      <div class="prep-row"><span>Total Principal</span><strong>${fmt(principal)}</strong></div>
      <div class="prep-row"><span>Total Interest</span><strong>${fmt(totalInterestBase)}</strong></div>
      <div class="prep-row"><span>Total Payable</span><strong>${fmt(totalPaidBase)}</strong></div>
    </div>
    <div class="prep-card highlight">
      <div class="prep-card-title">✅ With ₹${Math.round(prepayment).toLocaleString("en-IN")}/month Prepayment</div>
      <div class="prep-row"><span>Monthly EMI + Extra</span><strong class="accent">${fmt(currentData.emi + prepayment)}</strong></div>
      <div class="prep-row"><span>Actual Tenure</span><strong class="accent">${fmtYM(actualMonthsPrep)}</strong></div>
      <div class="prep-row"><span>Total Principal</span><strong>${fmt(principal)}</strong></div>
      <div class="prep-row"><span>Total Interest</span><strong class="save">${fmt(totalInterestPrep)}</strong></div>
      <div class="prep-row"><span>Total Payable</span><strong class="save">${fmt(totalPaidPrep)}</strong></div>
      <div class="prep-row" style="margin-top:8px;padding-top:8px;border-top:1.5px solid rgba(141,15,214,0.2)">
        <span>🎉 Interest Saved</span><strong class="save">${fmt(interestSaved)}</strong>
      </div>
      <div class="prep-row">
        <span>⏱️ Time Saved</span><strong class="save">${fmtYM(monthsSaved)}</strong>
      </div>
    </div>
  `;
}


// ── YEAR FILTER ──
function renderYearFilter() {
  const years = [...new Set(currentSchedule.map(r => r.year))];
  const wrap  = document.getElementById("year-filter");
  wrap.innerHTML = `
    <button class="year-btn active" onclick="renderAmortTable('all')">All</button>
    ${years.map(y => `<button class="year-btn" onclick="renderAmortTable(${y})">${y}</button>`).join("")}
  `;
}

function renderAmortTable(yearFilter) {
  // Update active button
  document.querySelectorAll(".year-btn").forEach(b => {
    b.classList.toggle("active",
      yearFilter === "all" ? b.textContent === "All" : b.textContent === String(yearFilter));
  });

  const rows = yearFilter === "all"
    ? currentSchedule
    : currentSchedule.filter(r => r.year === yearFilter);

  const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
  const totalInterest  = rows.reduce((s, r) => s + r.interest,  0);
  const totalPrep      = rows.reduce((s, r) => s + r.prepayment, 0);
  const totalPaid      = rows.reduce((s, r) => s + r.totalPaid,  0);
  const { principal }  = currentData;

  let lastYear = null;
  const tableRows = rows.map(r => {
    const paidSoFar   = principal - r.balance;
    const pct         = Math.min(100, paidSoFar / principal * 100);
    const isYearStart = r.year !== lastYear;
    lastYear          = r.year;

    return `
      <tr class="${isYearStart && yearFilter === "all" ? "year-start" : ""}">
        <td class="muted">${r.no}</td>
        <td><strong>${r.monthLabel}</strong></td>
        <td>${fmt(r.emi)}</td>
        <td class="pos">${fmt(r.principal)}</td>
        <td class="neg">${fmt(r.interest)}</td>
        <td class="${r.prepayment > 0 ? "pos" : "muted"}">${r.prepayment > 0 ? fmt(r.prepayment) : "—"}</td>
        <td><strong>${fmt(r.balance)}</strong></td>
        <td>
          <div class="pct-cell">
            <div class="bar-wrap"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
            <span>${fmtPct(pct)}</span>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.getElementById("amort-body").innerHTML = tableRows;
  document.getElementById("amort-sub").textContent =
    yearFilter === "all"
      ? `Full ${currentSchedule.length}-month repayment schedule. Use the year buttons above to filter.`
      : `Showing ${rows.length} months for year ${yearFilter}.`;

  document.getElementById("table-footer").innerHTML = `
    <span>Showing <strong>${rows.length}</strong> month${rows.length > 1 ? "s" : ""}</span>
    <span>Principal paid: <strong>${fmt(totalPrincipal)}</strong></span>
    <span>Interest paid: <strong>${fmt(totalInterest)}</strong></span>
    ${totalPrep > 0 ? `<span>Prepayments: <strong>${fmt(totalPrep)}</strong></span>` : ""}
    <span>Total paid: <strong>${fmt(totalPaid)}</strong></span>
  `;
}

// ── RESET ──
function resetForm() {
  document.getElementById("emi-form").reset();
  document.getElementById("results-section").style.display = "none";
  document.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('.pill-btn[data-label="Home Loan"]').classList.add("active");
  document.getElementById("interest-rate").value = 8.5;
  document.getElementById("interest-rate-range").value = 8.5;
  document.getElementById("loan-amount-range").value = 2000000;
  document.getElementById("tenure-range").value = 20;
  document.getElementById("tenure").value = 20;
  const now = new Date();
  document.getElementById("start-date").value =
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  ["loan-amount-range","interest-rate-range","tenure-range"].forEach(id => {
    updateRangeBackground(document.getElementById(id));
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("Form reset!", "success");
}

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  syncRange("loan-amount",   "loan-amount-range");
  syncRange("interest-rate", "interest-rate-range");
  setupTenureSync();
  setupLoanTypePills();
  document.getElementById("emi-form").addEventListener("submit", calculate);

  // Set initial range backgrounds
  updateRangeBackground(document.getElementById("loan-amount-range"));
  updateRangeBackground(document.getElementById("interest-rate-range"));
  updateRangeBackground(document.getElementById("tenure-range"));
});