const token = new URLSearchParams(location.search).get("t");
const msg = document.getElementById("msg");

async function boot() {
  if (!token) {
    msg.textContent = "Geen geldige link.";
    return;
  }
  const res = await fetch("/api/fill/" + token);
  const data = await res.json();
  if (!res.ok) {
    msg.textContent = data.error || "Link ongeldig";
    return;
  }
  document.getElementById("class-name").textContent = data.className;
  const me = document.getElementById("me");
  data.students.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    me.appendChild(o);
  });
  const box = document.getElementById("questions");
  data.questions.forEach((q) => {
    const block = document.createElement("div");
    block.className = "nomination-block";
    block.innerHTML = "<h3>" + escapeHtml(q.text) + "</h3>";
    const max = q.maxChoices || 3;
    for (let k = 1; k <= max; k++) {
      const lab = document.createElement("label");
      lab.textContent = "Keuze " + k;
      const sel = document.createElement("select");
      sel.dataset.q = q.question_key;
      sel.dataset.k = String(k);
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "—";
      sel.appendChild(empty);
      data.students.forEach((s) => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.name;
        sel.appendChild(o);
      });
      block.appendChild(lab);
      block.appendChild(sel);
    }
    box.appendChild(block);
  });

  document.getElementById("submit").onclick = async () => {
    const fromStudentId = me.value;
    if (!fromStudentId) return alert("Kies je naam");
    const answers = {};
    document.querySelectorAll("select[data-q]").forEach((sel) => {
      const q = sel.dataset.q;
      if (!answers[q]) answers[q] = [];
      if (sel.value && answers[q].indexOf(sel.value) === -1) {
        answers[q].push(sel.value);
      }
    });
    // remove self
    Object.keys(answers).forEach((q) => {
      answers[q] = answers[q].filter((id) => id !== fromStudentId);
    });
    const r = await fetch("/api/fill/" + token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromStudentId, answers }),
    });
    const out = await r.json();
    if (!r.ok) {
      msg.textContent = out.error || "Mislukt";
      return;
    }
    msg.textContent = "Bedankt, je antwoorden zijn opgeslagen.";
    document.getElementById("form-card").querySelectorAll("select,button").forEach((el) => {
      el.disabled = true;
    });
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

boot();
