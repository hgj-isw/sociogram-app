/**
 * Cloudflare Worker — Sociogram API + static assets
 * Auth: Google + Microsoft OAuth | Admin: hgj@isw.info
 */

const SUPER_ADMIN = "hgj@isw.info";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        const status = err.status || 500;
        return json({ error: err.message || "Serverfout" }, status);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = request.method;

  if (path === "/health" && method === "GET") {
    return json({ ok: true, app: env.APP_NAME || "Sociogram" });
  }

  if (path === "/auth/providers" && method === "GET") {
    return json({
      google: Boolean(env.GOOGLE_CLIENT_ID),
      microsoft: Boolean(env.MICROSOFT_CLIENT_ID),
      adminEmail: (env.ADMIN_EMAIL || SUPER_ADMIN).toLowerCase(),
    });
  }

  if (path === "/auth/login/google" && method === "GET") {
    return startOAuth(env, url, "google");
  }
  if (path === "/auth/login/microsoft" && method === "GET") {
    return startOAuth(env, url, "microsoft");
  }
  if (path === "/auth/callback/google" && method === "GET") {
    return finishOAuth(request, env, url, "google");
  }
  if (path === "/auth/callback/microsoft" && method === "GET") {
    return finishOAuth(request, env, url, "microsoft");
  }
  if (path === "/auth/logout" && method === "POST") {
    return logout(request, env);
  }
  if (path === "/me" && method === "GET") {
    const user = await getUser(request, env);
    return json({ user });
  }

  if (path === "/admin/requests" && method === "GET") {
    await requireAdmin(request, env);
    const rows = await env.DB.prepare(
      "SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at ASC"
    ).all();
    return json({ requests: rows.results || [] });
  }
  if (path === "/admin/users" && method === "GET") {
    await requireAdmin(request, env);
    const rows = await env.DB.prepare(
      "SELECT id, email, name, provider, status, role, created_at, approved_at FROM users ORDER BY created_at DESC"
    ).all();
    return json({ users: rows.results || [] });
  }
  if (path.startsWith("/admin/requests/") && path.endsWith("/decide") && method === "POST") {
    const admin = await requireAdmin(request, env);
    const id = path.split("/")[3];
    const body = await request.json();
    return decideRequest(env, admin, id, body.decision);
  }

  if (path === "/classes" && method === "GET") {
    const user = await requireApproved(request, env);
    const rows = await env.DB.prepare(
      "SELECT id, name, created_at FROM classes WHERE owner_id = ? ORDER BY created_at DESC"
    )
      .bind(user.id)
      .all();
    return json({ classes: rows.results || [] });
  }
  if (path === "/classes" && method === "POST") {
    const user = await requireApproved(request, env);
    const body = await request.json();
    return createClass(env, user, body);
  }
  if (path.match(/^\/classes\/[^/]+$/) && method === "GET") {
    const user = await requireApproved(request, env);
    return getClassDetail(env, user, path.split("/")[2]);
  }
  if (path.match(/^\/classes\/[^/]+$/) && method === "PUT") {
    const user = await requireApproved(request, env);
    const body = await request.json();
    return updateClass(env, user, path.split("/")[2], body);
  }
  if (path.match(/^\/classes\/[^/]+\/fill-link$/) && method === "POST") {
    const user = await requireApproved(request, env);
    return createFillLink(env, user, path.split("/")[2], url.origin);
  }
  if (path.match(/^\/classes\/[^/]+\/nominations$/) && method === "GET") {
    const user = await requireApproved(request, env);
    return getNominations(env, user, path.split("/")[2]);
  }

  if (path.match(/^\/fill\/[^/]+$/) && method === "GET") {
    return getFillForm(env, path.split("/")[2]);
  }
  if (path.match(/^\/fill\/[^/]+$/) && method === "POST") {
    const body = await request.json();
    return submitFill(env, path.split("/")[2], body);
  }

  return json({ error: "Not found" }, 404);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...headers },
  });
}

function adminEmail(env) {
  return (env.ADMIN_EMAIL || SUPER_ADMIN).toLowerCase();
}

function uid(prefix) {
  return prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowIso() {
  return new Date().toISOString();
}

function cookieGet(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function sessionCookie(token, maxAgeSec) {
  return `sg_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

async function getUser(request, env) {
  const token = cookieGet(request, "sg_session");
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  )
    .bind(token, nowIso())
    .first();
}

async function requireUser(request, env) {
  const user = await getUser(request, env);
  if (!user) throw Object.assign(new Error("Niet ingelogd"), { status: 401 });
  return user;
}

async function requireApproved(request, env) {
  const user = await requireUser(request, env);
  if (user.email.toLowerCase() === adminEmail(env)) {
    if (user.status !== "approved" || user.role !== "admin") {
      await env.DB.prepare(
        "UPDATE users SET status='approved', role='admin', approved_at=COALESCE(approved_at, ?) WHERE id=?"
      )
        .bind(nowIso(), user.id)
        .run();
      user.status = "approved";
      user.role = "admin";
    }
    return user;
  }
  if (user.status !== "approved") {
    throw Object.assign(new Error("Account wacht op goedkeuring"), { status: 403 });
  }
  return user;
}

async function requireAdmin(request, env) {
  const user = await requireApproved(request, env);
  if (user.role !== "admin" && user.email.toLowerCase() !== adminEmail(env)) {
    throw Object.assign(new Error("Geen admin"), { status: 403 });
  }
  return user;
}

async function startOAuth(env, url, provider) {
  const state = uid("st");
  const redirectUri = `${url.origin}/api/auth/callback/${provider}`;
  let authUrl;
  if (provider === "google") {
    if (!env.GOOGLE_CLIENT_ID) {
      return json({ error: "Google login nog niet geconfigureerd (GOOGLE_CLIENT_ID)" }, 503);
    }
    const p = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
  } else {
    if (!env.MICROSOFT_CLIENT_ID) {
      return json({ error: "Microsoft login nog niet geconfigureerd (MICROSOFT_CLIENT_ID)" }, 503);
    }
    const p = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: "openid email profile User.Read offline_access",
      state,
    });
    authUrl =
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + p.toString();
  }
  return redirect(authUrl, {
    "Set-Cookie": `sg_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  });
}

async function finishOAuth(request, env, url, provider) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = cookieGet(request, "sg_oauth_state");
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirect("/?error=oauth_state");
  }

  const redirectUri = `${url.origin}/api/auth/callback/${provider}`;
  let profile;
  try {
    profile = await exchangeCode(env, provider, code, redirectUri);
  } catch (e) {
    return redirect("/?error=" + encodeURIComponent(e.message || "oauth_failed"));
  }

  const email = (profile.email || "").toLowerCase();
  if (!email) return redirect("/?error=no_email");

  const isAdmin = email === adminEmail(env);
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    const id = uid("u");
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, provider, status, role, created_at, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        email,
        profile.name || email,
        provider,
        isAdmin ? "approved" : "pending",
        isAdmin ? "admin" : "teacher",
        nowIso(),
        isAdmin ? nowIso() : null
      )
      .run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!isAdmin) {
      await env.DB.prepare(
        `INSERT INTO access_requests (id, email, name, provider, message, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      )
        .bind(
          uid("ar"),
          email,
          profile.name || email,
          provider,
          "Automatische aanvraag bij eerste login",
          nowIso()
        )
        .run();
    }
  } else {
    await env.DB.prepare("UPDATE users SET name = ?, provider = ? WHERE id = ?")
      .bind(profile.name || user.name, provider, user.id)
      .run();
    if (isAdmin) {
      await env.DB.prepare(
        "UPDATE users SET status='approved', role='admin', approved_at=COALESCE(approved_at, ?) WHERE id=?"
      )
        .bind(nowIso(), user.id)
        .run();
      user.status = "approved";
      user.role = "admin";
    }
  }

  const token = uid("sess");
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  )
    .bind(token, user.id, expires)
    .run();

  const fresh = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const dest =
    fresh.role === "admin"
      ? "/admin.html"
      : fresh.status === "approved"
        ? "/app.html"
        : "/pending.html";

  const headers = new Headers({ Location: dest });
  headers.append("Set-Cookie", sessionCookie(token, 30 * 24 * 3600));
  headers.append(
    "Set-Cookie",
    "sg_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );
  return new Response(null, { status: 302, headers });
}

async function exchangeCode(env, provider, code, redirectUri) {
  if (provider === "google") {
    const body = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokRes.ok) throw new Error("Google token mislukt");
    const tok = await tokRes.json();
    const uRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + tok.access_token },
    });
    if (!uRes.ok) throw new Error("Google userinfo mislukt");
    const u = await uRes.json();
    return { email: u.email, name: u.name };
  }

  const body = new URLSearchParams({
    code,
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  if (!tokRes.ok) throw new Error("Microsoft token mislukt");
  const tok = await tokRes.json();
  const uRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: "Bearer " + tok.access_token },
  });
  if (!uRes.ok) throw new Error("Microsoft profile mislukt");
  const u = await uRes.json();
  return { email: u.mail || u.userPrincipalName, name: u.displayName };
}

async function logout(request, env) {
  const token = cookieGet(request, "sg_session");
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return json(
    { ok: true },
    200,
    {
      "Set-Cookie":
        "sg_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    }
  );
}

async function decideRequest(env, admin, id, decision) {
  if (decision !== "approved" && decision !== "rejected") {
    return json({ error: "Ongeldige beslissing" }, 400);
  }
  const reqRow = await env.DB.prepare("SELECT * FROM access_requests WHERE id = ?")
    .bind(id)
    .first();
  if (!reqRow) return json({ error: "Aanvraag niet gevonden" }, 404);
  await env.DB.prepare(
    "UPDATE access_requests SET status=?, decided_at=?, decided_by=? WHERE id=?"
  )
    .bind(decision, nowIso(), admin.email, id)
    .run();
  if (decision === "approved") {
    await env.DB.prepare(
      "UPDATE users SET status='approved', role='teacher', approved_at=?, approved_by=? WHERE email=?"
    )
      .bind(nowIso(), admin.email, reqRow.email.toLowerCase())
      .run();
  } else {
    await env.DB.prepare("UPDATE users SET status='blocked' WHERE email=?")
      .bind(reqRow.email.toLowerCase())
      .run();
  }
  return json({ ok: true });
}

const DEFAULT_QUESTIONS = [
  { key: "q-samenwerken", polarity: "positive", label: "Samenwerken", text: "Met wie werk je graag samen?", max: 3, enabled: 1 },
  { key: "q-zitten", polarity: "positive", label: "Zitten", text: "Naast wie wil je graag zitten?", max: 3, enabled: 1 },
  { key: "q-pauze", polarity: "positive", label: "Pauze", text: "Met wie praat je graag in de pauze?", max: 3, enabled: 1 },
  { key: "q-veilig", polarity: "positive", label: "Steun", text: "Bij wie kun je terecht als je ergens mee zit?", max: 2, enabled: 0 },
  { key: "q-leider", polarity: "positive", label: "Leiderschap", text: "Wie zou je kiezen als groepsleider voor een project?", max: 2, enabled: 0 },
  { key: "q-buiten-school", polarity: "positive", label: "Buiten school", text: "Met wie zou je graag willen afspreken buiten school?", max: 2, enabled: 0 },
  { key: "q-niet-samenwerken", polarity: "negative", label: "Minder graag samenwerken", text: "Met wie werk je het minst graag samen?", max: 2, enabled: 0 },
  { key: "q-niet-zitten", polarity: "negative", label: "Liever niet zitten", text: "Naast wie wil je liever niet zitten?", max: 2, enabled: 0 },
  { key: "q-spanning", polarity: "negative", label: "Spanning", text: "Met wie ervaar je weleens spanning of ruzie?", max: 2, enabled: 0 },
  { key: "q-uitsluiting", polarity: "negative", label: "Uitsluiting", text: "Wie laat anderen naar jouw idee vaak buiten de groep?", max: 2, enabled: 0 },
];

async function createClass(env, user, body) {
  const name = (body.name || "").trim();
  if (!name) return json({ error: "Klasnaam verplicht" }, 400);
  const classId = uid("c");
  await env.DB.prepare(
    "INSERT INTO classes (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(classId, user.id, name, nowIso())
    .run();

  const students = Array.isArray(body.students) ? body.students : [];
  for (const s of students) {
    const sn = String(s.name || s).trim();
    if (!sn) continue;
    await env.DB.prepare(
      "INSERT INTO students (id, class_id, name, code) VALUES (?, ?, ?, ?)"
    )
      .bind(uid("s"), classId, sn, s.code || null)
      .run();
  }

  let order = 0;
  for (const q of DEFAULT_QUESTIONS) {
    await env.DB.prepare(
      `INSERT INTO questions (id, class_id, question_key, polarity, label, text, max_choices, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(uid("q"), classId, q.key, q.polarity, q.label, q.text, q.max, q.enabled, order++)
      .run();
  }
  return json({ id: classId, name });
}

async function assertClassOwner(env, user, classId) {
  const c = await env.DB.prepare("SELECT * FROM classes WHERE id = ? AND owner_id = ?")
    .bind(classId, user.id)
    .first();
  if (!c) throw Object.assign(new Error("Klas niet gevonden"), { status: 404 });
  return c;
}

async function getClassDetail(env, user, classId) {
  const c = await assertClassOwner(env, user, classId);
  const students = await env.DB.prepare(
    "SELECT id, name, code FROM students WHERE class_id = ? ORDER BY name"
  )
    .bind(classId)
    .all();
  const questions = await env.DB.prepare(
    "SELECT id, question_key, polarity, label, text, max_choices AS maxChoices, enabled, sort_order FROM questions WHERE class_id = ? ORDER BY sort_order"
  )
    .bind(classId)
    .all();
  const link = await env.DB.prepare(
    "SELECT token, active, created_at FROM fill_links WHERE class_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1"
  )
    .bind(classId)
    .first();
  return json({
    class: c,
    students: students.results || [],
    questions: (questions.results || []).map((q) => ({
      ...q,
      enabled: !!q.enabled,
    })),
    fillLink: link || null,
  });
}

async function updateClass(env, user, classId, body) {
  await assertClassOwner(env, user, classId);
  if (Array.isArray(body.questions)) {
    for (const q of body.questions) {
      const key = q.question_key || q.key;
      await env.DB.prepare(
        `UPDATE questions SET text=?, label=?, max_choices=?, enabled=?
         WHERE class_id=? AND question_key=?`
      )
        .bind(
          q.text,
          q.label,
          q.max_choices || q.maxChoices || 3,
          q.enabled ? 1 : 0,
          classId,
          key
        )
        .run();
    }
  }
  if (Array.isArray(body.students)) {
    await env.DB.prepare("DELETE FROM students WHERE class_id = ?").bind(classId).run();
    for (const s of body.students) {
      const sn = String(s.name || s).trim();
      if (!sn) continue;
      await env.DB.prepare(
        "INSERT INTO students (id, class_id, name, code) VALUES (?, ?, ?, ?)"
      )
        .bind(s.id || uid("s"), classId, sn, s.code || null)
        .run();
    }
  }
  if (body.name) {
    await env.DB.prepare("UPDATE classes SET name = ? WHERE id = ?")
      .bind(String(body.name).trim(), classId)
      .run();
  }
  return getClassDetail(env, user, classId);
}

async function createFillLink(env, user, classId, origin) {
  await assertClassOwner(env, user, classId);
  await env.DB.prepare("UPDATE fill_links SET active = 0 WHERE class_id = ?")
    .bind(classId)
    .run();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await env.DB.prepare(
    "INSERT INTO fill_links (id, class_id, token, active, created_at) VALUES (?, ?, ?, 1, ?)"
  )
    .bind(uid("fl"), classId, token, nowIso())
    .run();
  return json({
    token,
    url: origin + "/fill.html?t=" + token,
  });
}

async function getNominations(env, user, classId) {
  await assertClassOwner(env, user, classId);
  const rows = await env.DB.prepare(
    "SELECT from_student_id, question_key, to_student_id FROM nominations WHERE class_id = ?"
  )
    .bind(classId)
    .all();
  return json({ nominations: rows.results || [] });
}

async function getFillForm(env, token) {
  const link = await env.DB.prepare(
    "SELECT * FROM fill_links WHERE token = ? AND active = 1"
  )
    .bind(token)
    .first();
  if (!link) return json({ error: "Link ongeldig of verlopen" }, 404);
  const c = await env.DB.prepare("SELECT id, name FROM classes WHERE id = ?")
    .bind(link.class_id)
    .first();
  const students = await env.DB.prepare(
    "SELECT id, name FROM students WHERE class_id = ? ORDER BY name"
  )
    .bind(link.class_id)
    .all();
  const questions = await env.DB.prepare(
    "SELECT question_key, polarity, label, text, max_choices AS maxChoices FROM questions WHERE class_id = ? AND enabled = 1 ORDER BY sort_order"
  )
    .bind(link.class_id)
    .all();
  return json({
    className: c.name,
    students: students.results || [],
    questions: questions.results || [],
  });
}

async function submitFill(env, token, body) {
  const link = await env.DB.prepare(
    "SELECT * FROM fill_links WHERE token = ? AND active = 1"
  )
    .bind(token)
    .first();
  if (!link) return json({ error: "Link ongeldig" }, 404);
  const fromId = body.fromStudentId;
  if (!fromId) return json({ error: "Kies je naam" }, 400);
  const student = await env.DB.prepare(
    "SELECT * FROM students WHERE id = ? AND class_id = ?"
  )
    .bind(fromId, link.class_id)
    .first();
  if (!student) return json({ error: "Leerling onbekend" }, 400);

  await env.DB.prepare(
    "DELETE FROM nominations WHERE class_id = ? AND from_student_id = ?"
  )
    .bind(link.class_id, fromId)
    .run();

  const answers = body.answers || {};
  for (const [qKey, toIds] of Object.entries(answers)) {
    const list = Array.isArray(toIds) ? toIds : [];
    for (const toId of list) {
      if (!toId || toId === fromId) continue;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO nominations (id, class_id, from_student_id, question_key, to_student_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(uid("n"), link.class_id, fromId, qKey, toId, nowIso())
        .run();
    }
  }
  return json({ ok: true });
}
