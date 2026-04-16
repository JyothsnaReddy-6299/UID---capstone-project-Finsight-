
// FINSIGHT - Expense Tracker JS (with Persistence)

// ── AUTH GUARD ──
(function() {
  const user = JSON.parse(localStorage.getItem("finsightUser"));
  if (!user || !user.loggedIn) {
    window.location.href = "login.html";
  }
})();



let expenseHistory = [];

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const CATEGORIES = [
  { id: "rent",          label: "Rent / Housing",       icon: "🏠", limit: 30 },
  { id: "food",          label: "Food & Groceries",      icon: "🍽️", limit: 15 },
  { id: "transport",     label: "Transport",             icon: "🚗", limit: 10 },
  { id: "bills",         label: "Electricity & Bills",   icon: "💡", limit: 8  },
  { id: "health",        label: "Health & Medical",      icon: "🏥", limit: 8  },
  { id: "education",     label: "Education",             icon: "🎓", limit: 10 },
  { id: "entertainment", label: "Entertainment",         icon: "🎬", limit: 10 },
  { id: "shopping",      label: "Clothing & Shopping",   icon: "👗", limit: 8  },
  { id: "phone",         label: "Phone & Internet",      icon: "📱", limit: 5  },
  { id: "emi",           label: "EMI / Loan Payment",    icon: "💳", limit: 20 },
  { id: "travel",        label: "Travel & Vacation",     icon: "✈️", limit: 5  },
  { id: "other",         label: "Other Expenses",        icon: "📦", limit: 5  },
];

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function saveHistory() {
  localStorage.setItem("finsight_expense_history", JSON.stringify(expenseHistory));
}

function loadHistory() {
  const saved = localStorage.getItem("finsight_expense_history");
  if (saved) expenseHistory = JSON.parse(saved);
}

function calcHealthScore(savingsPct, overCount) {
  let score = 100;
  if (savingsPct < 0)        score -= 40;
  else if (savingsPct < 10)  score -= 20;
  else if (savingsPct < 20)  score -= 10;
  score -= overCount * 8;
  score = Math.max(0, Math.min(100, score));
  if (score >= 75) return { score, label: "Excellent 🌟", color: "#16a34a" };
  if (score >= 50) return { score, label: "Fair ⚠️",      color: "#d97706" };
  return             { score, label: "Poor 🚨",            color: "#dc2626" };
}

function calculate(e) {
  e.preventDefault();

  const monthInput = document.getElementById("month").value;
  if (!monthInput) { showToast("⚠️ Please select a month.", "warn"); return; }

  const [year, month] = monthInput.split("-");
  const monthLabel = MONTHS[parseInt(month) - 1] + " " + year;

  const income = parseFloat(document.getElementById("income").value) || 0;
  if (income <= 0) { showToast("⚠️ Please enter your monthly income.", "warn"); return; }

  let totalExpenses = 0;
  const breakdown = [];

  CATEGORIES.forEach(cat => {
    const val = parseFloat(document.getElementById(cat.id).value) || 0;
    totalExpenses += val;
    breakdown.push({ ...cat, amount: val, pct: income > 0 ? (val / income * 100) : 0 });
  });

  const savings    = income - totalExpenses;
  const savingsPct = income > 0 ? (savings / income * 100) : 0;
  const expensePct = income > 0 ? (totalExpenses / income * 100) : 0;
  const overCount  = breakdown.filter(c => c.pct > c.limit).length;

  const record = { month: monthLabel, income, totalExpenses, savings, savingsPct, expensePct, overCount, breakdown };

  const existing = expenseHistory.findIndex(h => h.month === monthLabel);
  if (existing >= 0) expenseHistory[existing] = record;
  else               expenseHistory.push(record);

  saveHistory();

  document.getElementById("results-section").style.display = "block";
  renderSummary(record);
  renderBreakdownTable(record);
  renderHistoryTable();

  setTimeout(() => {
    document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
  }, 60);

  showToast("✅ Analysis complete!", "success");
}

function restoreLastEntry() {
  if (expenseHistory.length === 0) return;

  const last  = expenseHistory[expenseHistory.length - 1];
  const parts = last.month.split(" ");
  const mIdx  = MONTHS.indexOf(parts[0]);

  document.getElementById("month").value  = `${parts[1]}-${String(mIdx + 1).padStart(2, "0")}`;
  document.getElementById("income").value = last.income;

  last.breakdown.forEach(cat => {
    const el = document.getElementById(cat.id);
    if (el) el.value = cat.amount || "";
  });

  document.getElementById("results-section").style.display = "block";
  renderSummary(last);
  renderBreakdownTable(last);
  renderHistoryTable();
}

function renderSummary({ income, totalExpenses, savings, savingsPct, expensePct, overCount }) {
  const savClass = savings >= 0 ? "positive" : "negative";
  const health   = calcHealthScore(savingsPct, overCount);

  document.getElementById("summary-cards").innerHTML = `
    <div class="sum-card">
      <div class="sum-icon">💼</div>
      <div class="sum-label">Monthly Income</div>
      <div class="sum-value">${fmt(income)}</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">💸</div>
      <div class="sum-label">Total Expenses</div>
      <div class="sum-value">${fmt(totalExpenses)}</div>
      <div class="sum-sub">${expensePct.toFixed(1)}% of income</div>
    </div>
    <div class="sum-card ${savClass}">
      <div class="sum-icon">${savings >= 0 ? "💰" : "🚨"}</div>
      <div class="sum-label">${savings >= 0 ? "Savings" : "Deficit"}</div>
      <div class="sum-value">${fmt(Math.abs(savings))}</div>
      <div class="sum-sub">${Math.abs(savingsPct).toFixed(1)}% of income</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">📊</div>
      <div class="sum-label">Financial Health</div>
      <div class="sum-value health-score" style="color:${health.color};font-size:18px;">${health.label}</div>
      <div class="sum-sub">Score: ${health.score}/100</div>
    </div>
  `;
}

function renderBreakdownTable({ breakdown }) {
  const sorted = [...breakdown].sort((a, b) => {
    if (a.amount === 0 && b.amount !== 0) return 1;
    if (b.amount === 0 && a.amount !== 0) return -1;
    return b.amount - a.amount;
  });

  const topId = sorted.find(c => c.amount > 0)?.id;

  const rows = sorted.map(cat => {
    const isTop    = cat.id === topId && cat.amount > 0;
    const isOver   = cat.pct > cat.limit;
    const isZero   = cat.amount === 0;
    const rowClass = isZero ? "zero-row" : isTop ? "top-spender" : "";
    const barW     = Math.min(cat.pct / cat.limit * 100, 100).toFixed(1);
    const statusTag = isZero
      ? `<span class="tag-ok" style="background:#f1f5f9;color:#94a3b8;">—</span>`
      : isOver
        ? `<span class="tag-over">Over Limit</span>`
        : `<span class="tag-ok">Within Limit</span>`;

    return `
      <tr class="${rowClass}">
        <td>
          <span class="row-icon">${cat.icon}</span>${cat.label}
          ${isTop ? '<span class="badge-top">TOP</span>' : ""}
        </td>
        <td class="amount-cell">${fmt(cat.amount)}</td>
        <td class="pct-cell">
          <div class="bar-wrap">
            <div class="bar-fill ${isOver ? "over" : ""}" style="width:${barW}%;${isOver ? "background:#dc2626;" : ""}"></div>
          </div>
          <span class="${isOver ? "over" : ""}">${cat.pct.toFixed(1)}%</span>
        </td>
        <td class="limit-cell">≤ ${cat.limit}%</td>
        <td>${statusTag}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("breakdown-table-body").innerHTML = rows;
}

function renderHistoryTable() {
  const section = document.getElementById("history-section");
  if (expenseHistory.length === 0) { section.style.display = "none"; return; }
  section.style.display = "block";

  const rows = expenseHistory.map((h, i) => {
    const savClass = h.savings >= 0 ? "pos" : "neg";
    return `
      <tr>
        <td><strong>${h.month}</strong></td>
        <td>${fmt(h.income)}</td>
        <td>${fmt(h.totalExpenses)}</td>
        <td class="${savClass}">${h.savings >= 0 ? "+" : ""}${fmt(h.savings)}</td>
        <td>${h.expensePct.toFixed(1)}%</td>
        <td class="${h.savingsPct >= 20 ? "pos" : h.savingsPct >= 0 ? "" : "neg"}">${h.savingsPct.toFixed(1)}%</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="action-btn" onclick="loadHistoryEntry(${i})" title="Load this month">📂</button>
            <button class="action-btn delete-btn" onclick="deleteHistoryEntry(${i})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.getElementById("history-body").innerHTML = rows;
}

function loadHistoryEntry(index) {
  const record = expenseHistory[index];
  const parts  = record.month.split(" ");
  const mIdx   = MONTHS.indexOf(parts[0]);
  document.getElementById("month").value  = `${parts[1]}-${String(mIdx + 1).padStart(2, "0")}`;
  document.getElementById("income").value = record.income;
  record.breakdown.forEach(cat => {
    const el = document.getElementById(cat.id);
    if (el) el.value = cat.amount || "";
  });
  renderSummary(record);
  renderBreakdownTable(record);
  window.scrollTo({ top: document.querySelector(".main-content").offsetTop - 80, behavior: "smooth" });
  showToast(`📂 Loaded ${record.month}`, "success");
}

function deleteHistoryEntry(index) {
  if (!confirm(`Delete entry for ${expenseHistory[index].month}?`)) return;
  expenseHistory.splice(index, 1);
  saveHistory();
  renderHistoryTable();
  if (expenseHistory.length === 0) {
    document.getElementById("results-section").style.display = "none";
  }
  showToast("🗑️ Entry deleted.", "success");
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

const images = ["img1.svg","img2.svg","img3.svg","img4.svg"];
const tips   = [
  "Track your daily expenses to avoid overspending.",
  "Follow the 50/30/20 budgeting rule.",
  "Invest early to maximize compound growth.",
  "Avoid impulse purchases by waiting 24 hours."
];
let sliderIndex = 0;

function updateContent() {
  const img  = document.getElementById("slider-img");
  const text = document.getElementById("tip-text");
  if (!img || !text) return;
  img.src = images[sliderIndex];
  text.textContent = tips[sliderIndex];
}
function rotateContent() {
  sliderIndex = (sliderIndex + 1) % images.length;
  updateContent();
}

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  updateContent();
  setInterval(rotateContent, 3000);

  document.querySelector(".expense-form").addEventListener("submit", calculate);

  loadHistory();
  restoreLastEntry();

  // ── HAMBURGER → partial purple dropdown ──
  const hamburger = document.getElementById("hamburger");
  const overlay   = document.getElementById("mobileOverlay");

  function openMenu() {
    overlay.classList.add("open");
  }

  function closeMenu() {
    overlay.classList.remove("open");
  }

  if (hamburger && overlay) {

    // Toggle on hamburger click
    hamburger.addEventListener("click", function (e) {
      e.stopPropagation();
      overlay.classList.contains("open") ? closeMenu() : openMenu();
    });

    // Close when any link inside overlay is clicked
    overlay.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", closeMenu);
    });

    // Close when clicking anywhere outside the navbar + overlay
    document.addEventListener("click", function (e) {
      const navbar = document.querySelector(".navbar");
      if (!navbar.contains(e.target) && !overlay.contains(e.target)) {
        closeMenu();
      }
    });
  }
});