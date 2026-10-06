async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function boot() {
  const me = await api("/api/me");
  if (!me.user) return (location.href = "/");
  if (me.user.role !== "admin") return (location.href = "/app.html");
  document.getElementById("who").textContent = me.user.email;

  document.getElementById("logout").onclick = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  };

  await refresh();
}

async function refresh() {
  const reqs = await api("/api/admin/requests");
  const users = await api("/api/admin/users");
  const rl = document.getElementById("requests");
  rl.innerHTML = "";
  if (!reqs.requests.length) {
    rl.innerHTML = "<li class='muted'>Geen openstaande aanvragen</li>";
  }
  reqs.requests.forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML =
      "<div><strong>" +
      escapeHtml(r.email) +
      "</strong><div class='hint'>" +
      escapeHtml(r.name || "") +
      " · " +
      escapeHtml(r.provider || "") +
      "</div></div><div class='stack-actions'></div>";
    const actions = li.querySelector(".stack-actions");
    const ok = document.createElement("button");
    ok.className = "btn";
    ok.textContent = "Goedkeuren";
    ok.onclick = async () => {
      await api("/api/admin/requests/" + r.id + "/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
      });
      refresh();
    };
    const no = document.createElement("button");
    no.className = "btn btn-ghost";
    no.textContent = "Weigeren";
    no.onclick = async () => {
      await api("/api/admin/requests/" + r.id + "/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
      });
      refresh();
    };
    actions.appendChild(ok);
    actions.appendChild(no);
    rl.appendChild(li);
  });

  const ul = document.getElementById("users");
  ul.innerHTML = "";
  users.users.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML =
      "<span>" +
      escapeHtml(u.email) +
      ' <span class="hint">' +
      escapeHtml(u.status + " · " + u.role) +
      "</span></span>";
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

boot().catch((e) => alert(e.message));
