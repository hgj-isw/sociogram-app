(function () {
  var state = window.SociogramStorage.load();
  window.SociogramCodes.ensureCodes(state.students);
  window.SociogramStorage.save(state);

  function uid() {
    return "s-" + Math.random().toString(36).slice(2, 9);
  }

  function save() {
    window.SociogramCodes.ensureCodes(state.students);
    window.SociogramStorage.save(state);
  }

  function $(id) {
    return document.getElementById(id);
  }

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

  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
      });
      document.querySelectorAll(".panel").forEach(function (panel) {
        var match = panel.id === "panel-" + tab;
        panel.classList.toggle("is-active", match);
        panel.hidden = !match;
      });
      if (tab === "beeld") renderViz();
      if (tab === "klas") renderStudents();
      if (tab === "uitdelen") renderProgress();
    });
  });

  function questionHasData(qId) {
    return state.students.some(function (s) {
      var bag = state.nominations[s.id];
      return bag && bag[qId] && bag[qId].length > 0;
    });
  }

  function renderQuestions() {
    var list = $("question-list");
    var showPos = $("filter-positive").checked;
    var showNeg = $("filter-negative").checked;
    list.innerHTML = "";
    var visible = state.questions.filter(function (q) {
      if (q.polarity === "positive" && !showPos) return false;
      if (q.polarity === "negative" && !showNeg) return false;
      return true;
    });
    $("active-count").textContent =
      window.SociogramQuestions.activeQuestions(state.questions).length +
      " van " +
      state.questions.length +
      " vragen aan";

    visible.forEach(function (q) {
      var card = document.createElement("article");
      card.className = "q-card" + (q.enabled ? "" : " is-off");
      card.innerHTML =
        '<div class="q-card-top"><div class="q-meta">' +
        '<span class="pill ' +
        (q.polarity === "positive" ? "pill-pos" : "pill-neg") +
        '">' +
        (q.polarity === "positive" ? "Positief" : "Negatief") +
        "</span>" +
        (questionHasData(q.id) ? '<span class="pill pill-pos">Ingevuld</span>' : "") +
        "<strong>" +
        escapeHtml(q.label) +
        "</strong></div>" +
        '<label class="toggle"><input type="checkbox" data-action="toggle" ' +
        (q.enabled ? "checked" : "") +
        " />" +
        (q.enabled ? "Aan" : "Uit") +
        "</label></div>" +
        '<div class="q-fields"><div><label>Vraagtekst</label>' +
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
        '" /></div></div></div>';

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
        ' <span class="hint">' +
        escapeHtml(s.code || "") +
        "</span></span>" +
        '<button type="button">Verwijder</button>';
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
      if (!existing[name.toLowerCase()]) {
        state.students.push({ id: uid(), name: name });
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
  });

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
    ul.innerHTML = "";
    if (!state.students.length) {
      ul.innerHTML = '<li class="muted">Eerst een klas toevoegen</li>';
      return;
    }
    window.SociogramCodes.ensureCodes(state.students);
    save();
    state.students.forEach(function (s) {
      var done = hasAnswered(s.id);
      var li = document.createElement("li");
      li.innerHTML =
        "<span><strong>" +
        escapeHtml(s.code || "????") +
        "</strong> · " +
        escapeHtml(s.name) +
        '</span><span class="status-dot ' +
        (done ? "done" : "todo") +
        '"></span>';
      ul.appendChild(li);
    });
  }

  $("btn-copy-link").addEventListener("click", function () {
    var url = new URL("leerling.html", location.href).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () {
          $("invite-status").textContent = "Leerlinglink gekopieerd.";
        },
        function () {
          $("invite-status").textContent = url;
        }
      );
    } else {
      $("invite-status").textContent = url;
    }
  });

  function refreshVizFilter() {
    var sel = $("viz-question-filter");
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
    var signals = window.SociogramViz.draw(
      $("sociogram-svg"),
      state.students,
      state.nominations,
      state.questions,
      $("viz-question-filter").value
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

  renderQuestions();
  renderStudents();
  renderProgress();
  refreshVizFilter();
})();
