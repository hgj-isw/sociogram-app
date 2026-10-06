(function () {
  var state = window.SociogramStorage.load();
  window.SociogramStorage.save(state);

  var ROLE_KEY = "sociogram-role";

  function uid() {
    return "s-" + Math.random().toString(36).slice(2, 9);
  }

  function save() {
    window.SociogramStorage.save(state);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showView(name) {
    $("view-welcome").hidden = name !== "welcome";
    $("view-docent").hidden = name !== "docent";
    $("view-leerling").hidden = name !== "leerling";
  }

  function setRole(role) {
    if (role) sessionStorage.setItem(ROLE_KEY, role);
    else sessionStorage.removeItem(ROLE_KEY);
  }

  function getRole() {
    return sessionStorage.getItem(ROLE_KEY);
  }

  function goHome() {
    setRole(null);
    showView("welcome");
  }

  function enterDocent() {
    setRole("docent");
    showView("docent");
    $("docent-tagline").textContent = state.className
      ? "Klas " + state.className
      : "Mentortool";
    renderQuestions();
    renderStudents();
    renderProgress();
    refreshVizFilter();
  }

  function enterLeerling() {
    setRole("leerling");
    showView("leerling");
    $("leerling-class-label").textContent = state.className
      ? "Klas " + state.className
      : "Invullen";
    renderLeerlingForm();
  }

  $("btn-role-docent").addEventListener("click", enterDocent);
  $("btn-role-leerling").addEventListener("click", enterLeerling);
  $("btn-home-docent").addEventListener("click", goHome);
  $("btn-home-leerling").addEventListener("click", goHome);

  /* ---------- tabs ---------- */
  document.querySelectorAll("#view-docent .tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-tab");
      document.querySelectorAll("#view-docent .tab").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll("#view-docent .panel").forEach(function (panel) {
        var match = panel.id === "panel-" + tab;
        panel.classList.toggle("is-active", match);
        panel.hidden = !match;
      });
      if (tab === "beeld") renderViz();
      if (tab === "klas") renderStudents();
      if (tab === "uitdelen") renderProgress();
    });
  });

  /* ---------- questions ---------- */
  function questionHasData(qId) {
    return state.students.some(function (s) {
      var bag = state.nominations[s.id];
      return bag && bag[qId] && bag[qId].length > 0;
    });
  }

  function renderQuestions() {
    var list = $("question-list");
    if (!list) return;
    var showPos = $("filter-positive").checked;
    var showNeg = $("filter-negative").checked;
    list.innerHTML = "";

    var visible = state.questions.filter(function (q) {
      if (q.polarity === "positive" && !showPos) return false;
      if (q.polarity === "negative" && !showNeg) return false;
      return true;
    });

    var shown = window.SociogramQuestions.activeQuestions(state.questions).length;
    $("active-count").textContent =
      shown + " van " + state.questions.length + " vragen aan";

    visible.forEach(function (q) {
      var card = document.createElement("article");
      card.className = "q-card" + (q.enabled ? "" : " is-off");
      card.innerHTML =
        '<div class="q-card-top">' +
        '<div class="q-meta">' +
        '<span class="pill ' +
        (q.polarity === "positive" ? "pill-pos" : "pill-neg") +
        '">' +
        (q.polarity === "positive" ? "Positief" : "Negatief") +
        "</span>" +
        (questionHasData(q.id)
          ? '<span class="pill pill-pos">Ingevuld</span>'
          : "") +
        "<strong>" +
        escapeHtml(q.label) +
        "</strong>" +
        "</div>" +
        '<label class="toggle">' +
        '<input type="checkbox" data-action="toggle" ' +
        (q.enabled ? "checked" : "") +
        " />" +
        (q.enabled ? "Aan" : "Uit") +
        "</label>" +
        "</div>" +
        '<div class="q-fields">' +
        "<div><label>Vraagtekst</label>" +
        '<input type="text" data-field="text" value="' +
        escapeAttr(q.text) +
        '" /></div>' +
        '<div style="display:grid;grid-template-columns:1fr 100px;gap:10px">' +
        "<div><label>Korte naam</label>" +
        '<input type="text" data-field="label" value="' +
        escapeAttr(q.label) +
        '" /></div>' +
        "<div><label>Max. keuzes</label>" +
        '<input type="number" min="1" max="5" data-field="maxChoices" value="' +
        q.maxChoices +
        '" /></div>' +
        "</div>" +
        "</div>";

      card.querySelector('[data-action="toggle"]').addEventListener("change", function (e) {
        q.enabled = e.target.checked;
        save();
        renderQuestions();
        refreshVizFilter();
      });

      card.querySelectorAll("[data-field]").forEach(function (input) {
        input.addEventListener("change", function () {
          var field = input.getAttribute("data-field");
          if (field === "maxChoices") {
            q.maxChoices = Math.min(5, Math.max(1, Number(input.value) || 1));
          } else {
            q[field] = input.value.trim();
          }
          save();
          renderQuestions();
          refreshVizFilter();
        });
      });

      list.appendChild(card);
    });
  }

  $("filter-positive").addEventListener("change", renderQuestions);
  $("filter-negative").addEventListener("change", renderQuestions);

  $("btn-reset-questions").addEventListener("click", function () {
    if (!confirm("Vragen terugzetten naar standaard?")) return;
    var oldNoms = state.nominations;
    state.questions = window.SociogramQuestions.cloneDefaultQuestions();
    state.nominations = oldNoms;
    state.isDemo = false;
    save();
    renderQuestions();
    refreshVizFilter();
  });

  $("btn-enable-positive").addEventListener("click", function () {
    state.questions.forEach(function (q) {
      q.enabled = q.polarity === "positive";
    });
    save();
    renderQuestions();
    refreshVizFilter();
  });

  $("btn-enable-all").addEventListener("click", function () {
    state.questions.forEach(function (q) {
      q.enabled = true;
    });
    save();
    renderQuestions();
    refreshVizFilter();
  });

  /* ---------- class ---------- */
  function parseNames(raw) {
    return raw
      .split(/[\n,;]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function renderStudents() {
    $("class-name").value = state.className || "";
    $("docent-tagline").textContent = state.className
      ? "Klas " + state.className
      : "Mentortool";
    var ul = $("student-list");
    ul.innerHTML = "";
    if (!state.students.length) {
      ul.innerHTML = '<li class="muted">Nog geen leerlingen</li>';
      return;
    }
    state.students.forEach(function (s) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" +
        escapeHtml(s.name) +
        '</span><button type="button">Verwijder</button>';
      li.querySelector("button").addEventListener("click", function () {
        state.students = state.students.filter(function (x) {
          return x.id !== s.id;
        });
        delete state.nominations[s.id];
        Object.keys(state.nominations).forEach(function (fromId) {
          Object.keys(state.nominations[fromId] || {}).forEach(function (qid) {
            state.nominations[fromId][qid] = (
              state.nominations[fromId][qid] || []
            ).filter(function (id) {
              return id !== s.id;
            });
          });
        });
        state.isDemo = false;
        save();
        renderStudents();
        renderProgress();
      });
      ul.appendChild(li);
    });
  }

  $("class-name").addEventListener("change", function () {
    state.className = $("class-name").value.trim();
    state.isDemo = false;
    save();
    $("docent-tagline").textContent = state.className
      ? "Klas " + state.className
      : "Mentortool";
  });

  $("btn-add-students").addEventListener("click", function () {
    state.className = $("class-name").value.trim();
    var names = parseNames($("student-input").value);
    var existing = {};
    state.students.forEach(function (s) {
      existing[s.name.toLowerCase()] = s;
    });
    names.forEach(function (name) {
      var key = name.toLowerCase();
      if (!existing[key]) {
        var student = { id: uid(), name: name };
        state.students.push(student);
        existing[key] = student;
      }
    });
    $("student-input").value = "";
    state.isDemo = false;
    save();
    renderStudents();
    renderProgress();
  });

  $("btn-clear-students").addEventListener("click", function () {
    if (!confirm("Alle leerlingen en antwoorden wissen?")) return;
    state.students = [];
    state.nominations = {};
    state.isDemo = false;
    save();
    renderStudents();
    renderProgress();
  });

  $("btn-load-demo").addEventListener("click", function () {
    if (
      state.students.length &&
      !confirm("Huidige klas vervangen door testklas Demo 2A?")
    ) {
      return;
    }
    state = window.SociogramDemo.build();
    save();
    renderStudents();
    renderQuestions();
    renderProgress();
    refreshVizFilter();
    alert("Testklas Demo 2A geladen. Open Beeld of laat een leerling invullen.");
  });

  /* ---------- uitnodigen / voortgang ---------- */
  function hasAnswered(studentId) {
    var active = window.SociogramQuestions.activeQuestions(state.questions);
    if (!active.length) return false;
    var bag = state.nominations[studentId] || {};
    return active.some(function (q) {
      return (bag[q.id] || []).length > 0;
    });
  }

  function renderProgress() {
    var ul = $("progress-list");
    if (!ul) return;
    ul.innerHTML = "";
    if (!state.students.length) {
      ul.innerHTML = '<li class="muted">Eerst een klas toevoegen</li>';
      return;
    }
    state.students.forEach(function (s) {
      var done = hasAnswered(s.id);
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" +
        escapeHtml(s.name) +
        '</span><span class="status-dot ' +
        (done ? "done" : "todo") +
        '" title="' +
        (done ? "Ingevuld" : "Nog niet") +
        '"></span>';
      ul.appendChild(li);
    });
  }

  $("btn-open-leerling").addEventListener("click", enterLeerling);

  $("btn-copy-link").addEventListener("click", function () {
    var url = location.href.split("#")[0];
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () {
          $("invite-status").textContent = "Link gekopieerd.";
        },
        function () {
          $("invite-status").textContent = url;
        }
      );
    } else {
      $("invite-status").textContent = url;
    }
  });

  /* ---------- leerling invullen ---------- */
  function renderLeerlingForm() {
    var sel = $("leerling-select");
    var form = $("leerling-form");
    var msg = $("leerling-msg");
    msg.textContent = "";
    sel.innerHTML = "";
    form.innerHTML = "";

    if (!state.students.length) {
      form.innerHTML =
        '<p class="hint">Er is nog geen klas. Vraag je mentor om leerlingen toe te voegen.</p>';
      return;
    }

    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— kies je naam —";
    sel.appendChild(opt0);
    state.students.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      sel.appendChild(o);
    });

    function drawQuestions() {
      form.innerHTML = "";
      var me = sel.value;
      if (!me) return;
      var active = window.SociogramQuestions.activeQuestions(state.questions);
      if (!active.length) {
        form.innerHTML =
          '<p class="hint">Er staan nu geen vragen aan. Vraag je mentor.</p>';
        return;
      }
      var saved = state.nominations[me] || {};
      active.forEach(function (q) {
        var block = document.createElement("div");
        block.className = "nomination-block";
        var selected = saved[q.id] || [];
        var others = state.students.filter(function (s) {
          return s.id !== me;
        });
        var html =
          "<h3>" +
          escapeHtml(q.text) +
          "</h3>" +
          '<p class="hint">Maximaal ' +
          q.maxChoices +
          " keuzes.</p>" +
          '<div class="choice-grid">';
        others.forEach(function (s) {
          html +=
            "<label><input type=\"checkbox\" data-qid=\"" +
            escapeAttr(q.id) +
            '" value="' +
            escapeAttr(s.id) +
            '" ' +
            (selected.indexOf(s.id) !== -1 ? "checked" : "") +
            " /> " +
            escapeHtml(s.name) +
            "</label>";
        });
        html += "</div>";
        block.innerHTML = html;
        block.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          cb.addEventListener("change", function () {
            var boxes = block.querySelectorAll(
              'input[type="checkbox"]:checked'
            );
            if (boxes.length > q.maxChoices) {
              cb.checked = false;
              alert("Maximaal " + q.maxChoices + " keuzes.");
            }
          });
        });
        form.appendChild(block);
      });
    }

    sel.onchange = drawQuestions;
  }

  $("btn-leerling-save").addEventListener("click", function () {
    var me = $("leerling-select").value;
    var msg = $("leerling-msg");
    if (!me) {
      msg.textContent = "Kies eerst je naam.";
      return;
    }
    if (!state.nominations[me]) state.nominations[me] = {};
    var active = window.SociogramQuestions.activeQuestions(state.questions);
    active.forEach(function (q) {
      var checked = Array.prototype.slice.call(
        document.querySelectorAll(
          '#leerling-form input[data-qid="' + q.id + '"]:checked'
        )
      );
      state.nominations[me][q.id] = checked.map(function (el) {
        return el.value;
      });
    });
    save();
    msg.textContent = "Bedankt, je antwoorden zijn opgeslagen.";
  });

  /* ---------- visualization ---------- */
  function refreshVizFilter() {
    var sel = $("viz-question-filter");
    if (!sel) return;
    var current = sel.value || "all";
    sel.innerHTML = '<option value="all">Alle actieve vragen</option>';
    window.SociogramQuestions.activeQuestions(state.questions).forEach(function (q) {
      var opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent =
        (q.polarity === "positive" ? "+ " : "− ") + q.label;
      sel.appendChild(opt);
    });
    if (
      current === "all" ||
      state.questions.some(function (q) {
        return q.id === current && q.enabled;
      })
    ) {
      sel.value = current;
    } else {
      sel.value = "all";
    }
  }

  function renderViz() {
    refreshVizFilter();
    var filterId = $("viz-question-filter").value;
    var signals = window.SociogramViz.draw(
      $("sociogram-svg"),
      state.students,
      state.nominations,
      state.questions,
      filterId
    );
    var ul = $("signals-list");
    ul.innerHTML = "";
    function add(title, items) {
      var li = document.createElement("li");
      li.innerHTML =
        "<div><strong>" +
        escapeHtml(title) +
        '</strong><div class="hint">' +
        (items.length ? escapeHtml(items.join(", ")) : "—") +
        "</div></div>";
      ul.appendChild(li);
    }
    add("Actieve vragen", [String(signals.activeCount)]);
    add("Weinig / niet positief genoemd", signals.littleNamed);
    add("Meest positief genoemd", signals.mostNamed);
  }

  $("viz-question-filter").addEventListener("change", renderViz);
  $("btn-redraw").addEventListener("click", renderViz);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  /* ---------- boot ---------- */
  var role = getRole();
  if (role === "docent") enterDocent();
  else if (role === "leerling") enterLeerling();
  else showView("welcome");
})();
