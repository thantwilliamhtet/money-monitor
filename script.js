const STORAGE_KEY = "moneyMonitorTransactions";
let transactions = loadTransactions();

const $ = id => document.getElementById(id);
const form = $("transactionForm");
const amount = $("amount");
const type = $("type");
const category = $("category");
const date = $("date");
const note = $("note");
const message = $("message");
const monthSelect = $("monthSelect");
const historyFilter = $("historyFilter");

function loadTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value)) + " MMK";
}

function monthKey(value) {
  return value.slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

date.value = todayISO();

function showMessage(text, error = false) {
  message.textContent = text;
  message.style.color = error ? "var(--expense)" : "var(--income)";
  setTimeout(() => { if (message.textContent === text) message.textContent = ""; }, 2500);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const value = Number(amount.value);

  if (!Number.isFinite(value) || value <= 0) {
    showMessage("Please enter a valid amount.", true);
    return;
  }
  if (!date.value) {
    showMessage("Please choose a date.", true);
    return;
  }

  transactions.push({
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    amount: Math.round(value),
    type: type.value,
    category: category.value,
    date: date.value,
    note: note.value.trim()
  });

  saveTransactions();
  form.reset();
  date.value = todayISO();
  showMessage("Transaction added.");
  render();
});

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
}

$("clearAllBtn").addEventListener("click", () => {
  if (!transactions.length) return;
  if (confirm("Delete every transaction? This cannot be undone.")) {
    transactions = [];
    saveTransactions();
    render();
  }
});

historyFilter.addEventListener("change", renderHistory);
monthSelect.addEventListener("change", renderMonthly);

function totals(list) {
  return list.reduce((result, t) => {
    if (t.type === "income") result.income += t.amount;
    else result.expense += t.amount;
    return result;
  }, { income: 0, expense: 0 });
}

function renderSummary() {
  const t = totals(transactions);
  $("income").textContent = formatMoney(t.income);
  $("expense").textContent = formatMoney(t.expense);
  $("balance").textContent = formatMoney(t.income - t.expense);
}

function renderMonthOptions() {
  const keys = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
  const current = monthKey(date.value || todayISO());
  if (!keys.includes(current)) keys.unshift(current);
  const previous = monthSelect.value;
  monthSelect.innerHTML = keys.map(k => '<option value="' + k + '">' + monthLabel(k) + "</option>").join("");
  monthSelect.value = keys.includes(previous) ? previous : current;
}

function renderMonthly() {
  const selected = monthSelect.value;
  const grouped = {};

  transactions.forEach(t => {
    const key = monthKey(t.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  const keys = Object.keys(grouped).sort().reverse();
  const container = $("monthlyList");

  if (!keys.length) {
    container.innerHTML = '<div class="empty">No transactions yet. Add your first transaction above.</div>';
    return;
  }

  const visibleKeys = selected && grouped[selected] ? [selected] : keys;
  container.innerHTML = visibleKeys.map(key => {
    const t = totals(grouped[key]);
    const balance = t.income - t.expense;
    const ratio = t.income > 0 ? Math.min(100, (t.expense / t.income) * 100) : 0;
    return '<div class="month-row">' +
      '<div class="month-top"><span class="month-name">' + monthLabel(key) + '</span><span class="month-total ' + (balance >= 0 ? "income-text" : "expense-text") + '">' + formatMoney(balance) + '</span></div>' +
      '<div class="progress" aria-label="Expense ratio"><div style="width:' + ratio + '%"></div></div>' +
      '<div class="month-meta"><span class="income-text">Income: ' + formatMoney(t.income) + '</span><span class="expense-text">Spent: ' + formatMoney(t.expense) + '</span><span>Expense ratio: ' + Math.round(ratio) + '%</span></div>' +
      '</div>';
  }).join("");
}

function renderHistory() {
  const filter = historyFilter.value;
  let list = transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (filter !== "all") list = list.filter(t => t.type === filter);

  $("historyCount").textContent = list.length + (list.length === 1 ? " transaction" : " transactions");

  if (!list.length) {
    $("transactions").innerHTML = '<div class="empty">No matching transactions.</div>';
    return;
  }

  $("transactions").innerHTML = list.map(t => {
    const sign = t.type === "income" ? "+" : "-";
    const title = t.note || t.category;
    return '<div class="transaction">' +
      '<div class="transaction-main"><div class="transaction-title">' + escapeHTML(title) + '</div><div class="transaction-sub">' + escapeHTML(t.category) + ' • ' + escapeHTML(t.date) + '</div></div>' +
      '<div class="transaction-amount ' + (t.type === "income" ? "income-text" : "expense-text") + '">' + sign + formatMoney(t.amount) + '</div>' +
      '<button class="delete-btn" type="button" data-id="' + t.id + '">Delete</button>' +
      '</div>';
  }).join("");

  $("transactions").querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.id));
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function render() {
  renderSummary();
  renderMonthOptions();
  renderMonthly();
  renderHistory();
}

render();