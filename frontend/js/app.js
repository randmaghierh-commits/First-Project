// Expense Tracker - frontend logic

// PHASE 2
// Your backend from Phase 1 is already running, with real expenses in the
// database (from schema.sql). Build this page directly against it with
// fetch and async/await - there is no in-memory or localStorage stage
// this time, and no sample data file.
//
// A possible structure (change it if you have a better idea):
//   - async function getExpenses()          fetch(API_URL), return the JSON
//   - async function addExpense(data)       fetch(API_URL, { method: "POST", ... })
//   - async function updateExpense(id,data) fetch(API_URL + "/" + id, { method: "PUT", ... })
//   - async function deleteExpense(id)      fetch(API_URL + "/" + id, { method: "DELETE" })
//   - async function refresh()              get the list, then call renderTable and renderSummary
//   - renderTable(list)                     build the table rows from the array the API returned
//   - renderSummary(list)                   update the summary cards
//   - applyFilter()                         re-render with the list filtered by category
//
// Don't forget:
//   - Show a Bootstrap spinner while a request is in flight.
//   - Wrap every fetch call in try/catch, and show a Bootstrap alert on failure.
//   - After add, edit, or delete, call refresh() so the page always shows
//     what the server actually saved - never update the table by hand.
//   - The API is at http://localhost:3000/api/expenses (see the Roadmap).


const API_URL = "http://localhost:3000/api/expenses";

// Get the page elements once
const alertBox = document.getElementById("alertBox");
const spinner = document.getElementById("spinner");
const tableBody = document.getElementById("expenseTable");
const filterSelect = document.getElementById("filterCategory");
const filterMonthSelect = document.getElementById("filterMonth");

function showAlert(message, type = "danger") {
  const alert = document.createElement("div");
  alert.className = "alert alert-" + type + " alert-dismissible fade show";
  alert.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "btn-close";
  closeButton.setAttribute("data-bs-dismiss", "alert");
  alert.appendChild(closeButton);

  alertBox.appendChild(alert);

  if (type === "success") {
    setTimeout(() => alert.remove(), 3000);
  }
}


// Bootstrap badge color for each category
const CATEGORY_COLORS = {
  Food: "success",
  Transport: "primary",
  Bills: "danger",
  Entertainment: "warning",
  Other: "secondary",
};

// The full list from the server; the filter re-uses it without a new fetch
let expenses = [];

// GET all expenses from the API
async function getExpenses() {
  let response;
  try {
    response = await fetch(API_URL);
  } catch (error) {
    // fetch itself throws only when the network request never reached the server
    throw new Error("Cannot reach the server. Make sure the backend is running.");
  }
  if (!response.ok) {
    throw new Error("Failed to load expenses.");
  }
  return response.json();
}


function formatAmount(value) {
  return Number(value).toFixed(2);
}

// Summary cards always use the FULL list
function renderSummary(list) {
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById("totalAmount").textContent = formatAmount(total);
  document.getElementById("expenseCount").textContent = list.length;

  if (list.length === 0) {
    document.getElementById("highestAmount").textContent = "0.00";
    document.getElementById("highestTitle").textContent = "-";
    return;
  }
  const highest = list.reduce((max, e) => (e.amount > max.amount ? e : max));
  document.getElementById("highestAmount").textContent = formatAmount(highest.amount);
  document.getElementById("highestTitle").textContent = highest.title;
}

let categoryChart = null; // keep a reference so we can destroy

// Draws a bar chart: total amount per category from the FULL list
function renderChart(list) {
  const totals = {};
  list.forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);

  const ctx = document.getElementById("categoryChart");

  if (categoryChart) {
    categoryChart.destroy(); // remove the old chart before drawing a new one
  }

  categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Total by category",
        data: data,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// Builds the table rows from an array of expenses
function renderTable(list) {
  tableBody.innerHTML = ""; // clear old rows

  list.forEach((expense) => {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.textContent = expense.title;

    const amountCell = document.createElement("td");
    amountCell.textContent = formatAmount(expense.amount);

    const categoryCell = document.createElement("td");
    const badge = document.createElement("span");
    const color = CATEGORY_COLORS[expense.category] || "secondary";
    badge.className = "badge text-bg-" + color;
    badge.textContent = expense.category;
    categoryCell.appendChild(badge);

    const dateCell = document.createElement("td");
    dateCell.textContent = expense.date;

    
    const actionsCell = document.createElement("td");
    actionsCell.className = "text-end";

   const editButton = document.createElement("button");
editButton.className = "btn btn-sm btn-outline-primary me-1";
editButton.textContent = "Edit";
editButton.addEventListener("click", () => openEditModal(expense));

const deleteButton = document.createElement("button");
deleteButton.className = "btn btn-sm btn-outline-danger";
deleteButton.textContent = "Delete";
deleteButton.addEventListener("click", () => handleDelete(expense));

actionsCell.append(editButton, deleteButton);


    row.append(titleCell, amountCell, categoryCell, dateCell, actionsCell);
    tableBody.appendChild(row);
  });
}

// Asks the server for the real list, then redraws the page
async function refresh() {
  spinner.classList.remove("d-none");
  try {
    expenses = await getExpenses();
    renderSummary(expenses);
    renderChart(expenses); 
   applyFilter();
  } 
   catch (error) {
  showAlert(error.message || "Cannot reach the server. Make sure it is running.");
 }

  finally {
    spinner.classList.add("d-none");
  }
}

refresh(); // load the data as soon as the page opens

const addForm = document.getElementById("addForm");
const addFields = {
  title: document.getElementById("addTitle"),
  amount: document.getElementById("addAmount"),
  category: document.getElementById("addCategory"),
  date: document.getElementById("addDate"),
};

// Reads the form. Shows Bootstrap validation errors and returns null if invalid.
function readAddForm() {
  let valid = true;
  Object.values(addFields).forEach((input) => input.classList.remove("is-invalid"));

  const title = addFields.title.value.trim();
  const amount = Number(addFields.amount.value);
  const category = addFields.category.value;
  const date = addFields.date.value;

  if (title === "") {
    addFields.title.classList.add("is-invalid");
    addFields.title.nextElementSibling.textContent = "Title is required.";
    valid = false;
  }
  if (!(amount > 0)) {
    addFields.amount.classList.add("is-invalid");
    addFields.amount.nextElementSibling.textContent = "Amount must be greater than 0.";
    valid = false;
  }
  if (category === "") {
    addFields.category.classList.add("is-invalid");
    addFields.category.nextElementSibling.textContent = "Please choose a category.";
    valid = false;
  }
  if (date === "") {
    addFields.date.classList.add("is-invalid");
    addFields.date.nextElementSibling.textContent = "Date is required.";
    valid = false;
  }

  return valid ? { title, amount, category, date } : null;
}

async function addExpense(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to add expense.");
  }
  return response.json();
}

addForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the page from reloading
  const data = readAddForm();
  if (!data) return; // validation failed, errors are already shown

  try {
    await addExpense(data);
    addForm.reset();
    showAlert("Expense added.", "success");
    await refresh(); // reload the real list from the server
  }
   catch (error) {
  showAlert(error.message);
}
});


async function deleteExpense(id) {
  const response = await fetch(API_URL + "/" + id, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to delete expense.");
  }
}

async function handleDelete(expense) {
  if (!confirm('Delete "' + expense.title + '"?')) return;

  try {
    await deleteExpense(expense.id);
    showAlert("Expense deleted.", "success");
    await refresh();
  } 
   catch (error) {
  showAlert(error.message);
}
}

// Re-draws the table using only expenses matching the selected category
function applyFilter() {
  const selectedCategory = filterSelect.value;
  const selectedMonth = filterMonthSelect.value;

  const list = expenses.filter((e) => {
    const matchesCategory = selectedCategory === "All" || e.category === selectedCategory;
    const expenseMonth = e.date.slice(5, 7); // "2026-03-01" -> "03"
    const matchesMonth = selectedMonth === "All" || expenseMonth === selectedMonth;
    return matchesCategory && matchesMonth;
  });

  renderTable(list);
}

filterSelect.addEventListener("change", applyFilter);
filterMonthSelect.addEventListener("change", applyFilter);


const editFields = {
  title: document.getElementById("editTitle"),
  amount: document.getElementById("editAmount"),
  category: document.getElementById("editCategory"),
  date: document.getElementById("editDate"),
};
const editModal = new bootstrap.Modal(document.getElementById("editModal"));
const saveEditButton = document.getElementById("saveEditButton");

let editingId = null; // which expense is currently being edited

function readEditForm() {
  let valid = true;
  Object.values(editFields).forEach((input) => input.classList.remove("is-invalid"));

  const title = editFields.title.value.trim();
  const amount = Number(editFields.amount.value);
  const category = editFields.category.value;
  const date = editFields.date.value;

  if (title === "") {
    editFields.title.classList.add("is-invalid");
    editFields.title.nextElementSibling.textContent = "Title is required.";
    valid = false;
  }
  if (!(amount > 0)) {
    editFields.amount.classList.add("is-invalid");
    editFields.amount.nextElementSibling.textContent = "Amount must be greater than 0.";
    valid = false;
  }
  if (category === "") {
    editFields.category.classList.add("is-invalid");
    editFields.category.nextElementSibling.textContent = "Please choose a category.";
    valid = false;
  }
  if (date === "") {
    editFields.date.classList.add("is-invalid");
    editFields.date.nextElementSibling.textContent = "Date is required.";
    valid = false;
  }

  return valid ? { title, amount, category, date } : null;
}

// Opens the modal filled with this expense's current data
function openEditModal(expense) {
  editingId = expense.id;
  Object.values(editFields).forEach((input) => input.classList.remove("is-invalid"));
  editFields.title.value = expense.title;
  editFields.amount.value = expense.amount;
  editFields.category.value = expense.category;
  editFields.date.value = expense.date;
  editModal.show();
}

async function updateExpense(id, data) {
  const response = await fetch(API_URL + "/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update expense.");
  }
  return response.json();
}

saveEditButton.addEventListener("click", async () => {
  const data = readEditForm();
  if (!data) return;

  try {
    await updateExpense(editingId, data);
    editModal.hide();
    showAlert("Expense updated.", "success");
    await refresh();
  } catch (error) {
  showAlert(error.message);
}
});

const themeToggle = document.getElementById("themeToggle");

// Apply the saved theme 
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark-mode");
    themeToggle.textContent = " Dark mode";
  }
}

const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  const newTheme = isDark ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("theme", newTheme); // remember the choice
});