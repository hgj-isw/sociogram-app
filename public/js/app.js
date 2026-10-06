async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

let currentClassId = null;
let currentDetail = null;

async function boot() {
  const me = await api("/api/me");
  if (!me.user) return (location.href = "/");
  if (me.user.status !== "approved") return (location.href = "/pending.html");
  document.getElementById("who").textContent = me.user.email;
  if (me.user.role === "admin") {
    document.getElementById("admin-link").hidden = false;
  }
  document.getElementById("logout").onclick = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  };
  document.getElementById("btn-create").onclick = createClass;
  document.getElementById("btn-save-q").onclick = saveQuestions;
  document.getElementById("btn-link").onclick = makeLink;
  document.getElementById("btn-viz").onclick = showViz;
  await loadClasses();
}

async function loadClasses() {
  const data = await api("/api/classes");
  const ul = document.getElementById("class-list");
  ul.innerHTML = "";
  data.classes.forEach((c) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost";
    btn.textContent = "Open";
    btn.onclick = () => openClass(c.id);
    li.innerHTML = "<span>" + escapeHtml(c.name) + "</span>";
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

async function createClass() {
  const name = document.getElementById("new-class").value.trim();
  const students = document
    .getElementById("new-students")
    .value.split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  if (!name) return alert("Vul een klasnaam in");
  const created = await api("/api/classes", {
    method: "POST",
    body: JSON.stringify({ name, students }),
  });
  document.getElementById("new-class").value = "";
  document.getElementById("new-students").value = "";
  await loadClasses();
  await openClass(created.id);
}

async function openClass(id) {
  currentClassId = id;
  currentDetail = await api("/api/classes/" + id);
  document.getElementById("class-panel").hidden = false;
  document.getElementById("class-title").textContent = currentDetail.class.name;
  renderQuestions();
  if (currentDetail.fillLink) {
    document.getElementById("link-out").textContent =
      "Actieve link: " + location.origin + "/fill.html?t=" + currentDetail.fillLink.token;
  } else {
    document.getElementById("link-out").textContent = "Nog geen invullink.";
  }
}

function renderQuestions() {
  const box = document.getElementById("q-list");
  box.innerHTML = "";
  currentDetail.questions.forEach((q) => {
    const art = document.createElement("article");
    art.className = "q-card" + (q.enabled ? "" : " is-off");
    art.innerHTML =
      '<label class="toggle"><input type="checkbox" data-key="' +
      escapeAttr(q.question_key) +
      '" ' +
      (q.enabled ? "checked" : "") +
      "/> Tonen</label>" +
      "<div><label>Vraag</label><input data-field='text' data-key='" +
      escapeAttr(q.question_key) +
      "' value='" +
      escapeAttr(q.text) +
      "'/></div>";
    box.appendChild(art);
  });
}

async function saveQuestions() {
  const updates = currentDetail.questions.map((q) => {
    const enabled = document.querySelector(
      'input[type=checkbox][data-key="' + q.question_key + '"]'
    ).checked;
    const text = document.querySelector(
      'input[data-field=text][data-key="' + q.question_key + '"]'
    ).value;
    return {
      question_key: q.question_key,
      label: q.label,
      text,
      maxChoices: q.maxChoices || q.max_choices || 3,
      enabled,
    };
  });
  currentDetail = await api("/api/classes/" + currentClassId, {
    method: "PUT",
    body: JSON.stringify({ questions: updates }),
  });
  renderQuestions();
  alert("Vragen opgeslagen");
}

async function makeLink() {
  const data = await api("/api/classes/" + currentClassId + "/fill-link", {
    method: "POST",
  });
  document.getElementById("link-out").innerHTML =
    'Deel deze link met de klas:<br><a href="' +
    escapeAttr(data.url) +
    '">' +
    escapeHtml(data.url) +
    "</a>";
  await navigator.clipboard.writeText(data.url).catch(() => {});
}

async function showViz() {
  const detail = await api("/api/classes/" + currentClassId);
  const noms = await api("/api/classes/" + currentClassId + "/nominations");
  const qPolarity = {};
  detail.questions.forEach((q) => {
    qPolarity[q.question_key] = q.polarity;
  });
  const pair = {};
  const edges = [];
  noms.nominations.forEach((n) => {
    if (!detail.questions.some((q) => q.question_key === n.question_key && q.enabled))
      return;
    const key = n.from_student_id + ">" + n.to_student_id + ">" + n.question_key;
    const rev =
      n.to_student_id + ">" + n.from_student_id + ">" + n.question_key;
    pair[key] = true;
    edges.push({
      from: n.from_student_id,
      to: n.to_student_id,
      polarity: qPolarity[n.question_key] || "positive",
      mutual: !!pair[rev],
    });
  });
  window.SociogramViz.draw(
    document.getElementById("sociogram-svg"),
    detail.students,
    edges
  );

  const received = {};
  detail.students.forEach((s) => (received[s.id] = 0));
  noms.nominations.forEach((n) => {
    const q = detail.questions.find((x) => x.question_key === n.question_key);
    if (q && q.enabled && q.polarity === "positive") {
      received[n.to_student_id] = (received[n.to_student_id] || 0) + 1;
    }
  });
  const little = detail.students
    .filter((s) => (received[s.id] || 0) === 0)
    .map((s) => s.name);
  document.getElementById("signals").innerHTML =
    "<li><strong>Niet/weinig positief genoemd</strong><div class='hint'>" +
    (little.length ? escapeHtml(little.join(", ")) : "—") +
    "</div></li>";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

boot().catch((e) => {
  alert(e.message);
  if (/Niet ingelogd|401/i.test(e.message)) location.href = "/";
});
