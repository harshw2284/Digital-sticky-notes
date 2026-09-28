// Presentation tier: renders notes and talks to the backend through /api.
// nginx forwards /api/* to the backend service, so no hard-coded hosts here.
const API = "/api/notes";
const COLORS = ["yellow", "pink", "blue", "mint", "lilac"];
const TILTS = [-2.2, 1.6, -0.8, 2.4, -1.5, 0.9];

const form = document.getElementById("note-form");
const titleEl = document.getElementById("title");
const contentEl = document.getElementById("content");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const messageEl = document.getElementById("message");
const board = document.getElementById("board");
const emptyEl = document.getElementById("empty");

let notes = [];
let editingId = null;

function showMessage(text, ok = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("ok", ok);
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function render() {
  board.replaceChildren();
  emptyEl.hidden = notes.length > 0;

  notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = `note ${COLORS[note.id % COLORS.length]}`;
    card.style.setProperty("--tilt", `${TILTS[note.id % TILTS.length]}deg`);
    if (note.id === editingId) card.classList.add("editing");

    const h2 = document.createElement("h2");
    h2.textContent = note.title; // textContent keeps user input from running as HTML

    const body = document.createElement("p");
    body.className = "body";
    body.textContent = note.content;

    const time = document.createElement("time");
    time.dateTime = note.created_at;
    time.textContent = formatDate(note.created_at);

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(note));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "delete";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeNote(note));

    actions.append(editBtn, delBtn);
    card.append(h2, body, time, actions);
    board.append(card);
  });
}

async function loadNotes() {
  try {
    notes = await request(API);
    render();
  } catch (err) {
    showMessage("Could not load notes. Check that the backend is running.");
  }
}

function startEdit(note) {
  editingId = note.id;
  titleEl.value = note.title;
  contentEl.value = note.content;
  submitBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  showMessage("");
  render();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  titleEl.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = "Add note";
  cancelBtn.hidden = true;
  render();
}

async function removeNote(note) {
  if (!confirm(`Delete "${note.title}"?`)) return;
  try {
    await request(`${API}/${note.id}`, { method: "DELETE" });
    if (editingId === note.id) resetForm();
    showMessage("Note deleted.", true);
    await loadNotes();
  } catch (err) {
    showMessage(err.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = JSON.stringify({
    title: titleEl.value,
    content: contentEl.value,
  });

  submitBtn.disabled = true;
  try {
    if (editingId === null) {
      await request(API, { method: "POST", body: payload });
      showMessage("Note added.", true);
    } else {
      await request(`${API}/${editingId}`, { method: "PUT", body: payload });
      showMessage("Changes saved.", true);
    }
    resetForm();
    await loadNotes();
  } catch (err) {
    showMessage(err.message); // e.g. "Note content cannot be empty."
  } finally {
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener("click", () => {
  resetForm();
  showMessage("");
});

loadNotes();
