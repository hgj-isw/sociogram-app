(function () {
  var state = window.SociogramStorage.load();
  window.SociogramStorage.save(state);

  function $(id) {
    return document.getElementById(id);
  }

  function save() {
    var cls = active();
    if (cls && window.SociogramCodes) {
      window.SociogramCodes.ensureCodes(
        cls.students,
        window.SociogramStorage.allCodesUsed(
          Object.assign({}, state, {
            classes: state.classes.filter(function (c) {
              return c.id !== cls.id;
            }),
          })
        )
      );
    }
    window.SociogramStorage.save(state);
  }

  function active() {
    return window.SociogramStorage.getActive(state);
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

  function parseNames(raw) {
    return raw
      .split(/[\n,;]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function refreshChrome() {
    var cls = active();
    $("docent-tagline").textContent = cls ? "Klas " + cls.name : "Mentortool";
    var sel = $("class-switch");
    sel.innerHTML = "";
    state.classes.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === state.activeClassId) opt.selected = true;
      sel.appendChild(opt);
    });
    $("class-switch-wrap").hidden = state.classes.length < 1;
  }

  $("class-switch").addEventListener("change", function () {
    window.SociogramStorage.setActive(state, this.value);
    save();
    refreshAll();
  });

  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      document.querySelectorAll(".panel").forEach(function (panel) {
        var match = panel.id === "panel-" + tab;
        panel.classList.toggle("is-active", match);
        panel.hidden = !match;
      });
      if (tab === "beeld") renderViz();
      if (tab === "klassen") renderClasses();
      if (tab === "codes") renderProgress();
      if (tab === "vragen") renderQuestions();
    });
  });

  function refreshAll() {
    refreshChrome();
    renderClasses();
    renderQuestions();
    renderProgress();
    refreshVizFilter();
  }

  /* ---------- klassen ---------- */
  function renderClasses() {
    refreshChrome();
    var ul = $("class-list");
    ul.innerHTML = "";
    if (!state.classes.length) {
      ul.innerHTML = '<li class="muted">Nog geen klassen</li>';
      $("active-class-edit").hidden = true;
      return;
    }
    state.classes.forEach(function (c) {
      var li = document.createElement("li");
      var isActive = c.id === state.activeClassId;
      li.innerHTML =
        "<span>" +
        escapeHtml(c.name) +
        " <span class=\"hint\">" +
        c.students.length +
        " lln" +
        (isActive ? " · actief" : "") +
        "</span></span>" +
        '<span class="row-actions"></span>';
      var actions = li.querySelector(".row-actions");
      if (!isActive) {
        var open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open";
        open.onclick = function () {
          window.SociogramStorage.setActive(state, c.id);
          save();
          refreshAll();
        };
        actions.appendChild(open);
      }
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "Verwijder";
      del.onclick = function () {
        if (
          !confirm(
            'Klas "' +
              c.name +
              '" en alle antwoorden definitief verwijderen?'
          )
        ) {
          return;
        }
        state.classes = state.classes.filter(function (x) {
          return x.id !== c.id;
        });
        if (state.activeClassId === c.id) {
          state.activeClassId = state.classes[0] ? state.classes[0].id : null;
        }
        save();
        refreshAll();
      };
      actions.appendChild(del);
      ul.appendChild(li);
    });

    var cls = active();
    $("active-class-edit").hidden = !cls;
    if (cls) renderStudents();
  }

  function renderStudents() {
    var cls = active();
    var ul = $("student-list");
    if (!cls || !ul) return;
    ul.innerHTML = "";
    cls.students.forEach(function (s) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" +
        escapeHtml(s.name) +
        ' <span class="hint">' +
        escapeHtml(s.code || "") +
        "</span></span>" +
        '<button type="button">Verwijder</button>';
      li.querySelector("button").onclick = function () {
        cls.students = cls.students.filter(function (x) {
          return x.id !== s.id;
        });
        delete cls.nominations[s.id];
        Object.keys(cls.nominations).forEach(function (fromId) {
          Object.keys(cls.nominations[fromId] || {}).forEach(function (qid) {
            cls.nominations[fromId][qid] = (
              cls.nominations[fromId][qid] || []
            ).filter(function (id) {
              return id !== s.id;
            });
          });
        });
        cls.isDemo = false;
        save();
        renderStudents();
        renderProgress();
      };
      ul.appendChild(li);
    });
  }

  $("btn-create-class").addEventListener("click", function () {
    var name = $("new-class-name").value.trim();
    var names = parseNames($("new-students").value);
    if (!name) {
      alert("Vul een klasnaam in.");
      return;
    }
    if (!names.length) {
      alert("Voeg minstens één leerling toe.");
      return;
    }
    var used = window.SociogramStorage.allCodesUsed(state);
    var students = names.map(function (n) {
      return { id: window.SociogramStorage.uid("s"), name: n };
    });
    window.SociogramCodes.ensureCodes(students, used);
    var cls = {
      id: window.SociogramStorage.uid("c"),
      name: name,
      students: students,
      questions: window.SociogramQuestions.cloneDefaultQuestions(),
      nominations: {},
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    state.classes.push(cls);
    state.activeClassId = cls.id;
    $("new-class-name").value = "";
    $("new-students").value = "";
    save();
    refreshAll();
    alert(
      "Klas aangemaakt. Codes staan bij tab Codes. Stel daarna de vragen in."
    );
  });

  $("btn-add-students").addEventListener("click", function () {
    var cls = active();
    if (!cls) return;
    var names = parseNames($("add-students").value);
    var existing = {};
    cls.students.forEach(function (s) {
      existing[s.name.toLowerCase()] = true;
    });
    var used = window.SociogramStorage.allCodesUsed(state);
    names.forEach(function (name) {
      if (existing[name.toLowerCase()]) return;
      var s = { id: window.SociogramStorage.uid("s"), name: name };
      window.SociogramCodes.ensureCodes([s], used);
      used[s.code] = true;
      cls.students.push(s);
    });
    $("add-students").value = "";
    cls.isDemo = false;
    save();
    renderStudents();
    renderProgress();
  });

  $("btn-load-demo").addEventListener("click", function () {
    var demo = window.SociogramDemo.buildClass();
    var exists = state.classes.some(function (c) {
      return c.id === demo.id;
    });
    if (exists) {
      if (!confirm("Demo 2A opnieuw laden? Bestaande demo-antwoorden worden overschreven."))
        return;
      state.classes = state.classes.filter(function (c) {
        return c.id !== demo.id;
      });
    }
    state.classes.push(demo);
    state.activeClassId = demo.id;
    save();
    refreshAll();
  });

  /* ---------- vragen ---------- */
  function questionHasData(qId) {
    var cls = active();
    if (!cls) return false;
    return cls.students.some(function (s) {
      var bag = cls.nominations[s.id];
      return bag && bag[qId] && bag[qId].length > 0;
    });
  }

  function renderQuestions() {
    var cls = active();
    var empty = $("vragen-empty");
    var body = $("vragen-body");
    if (!cls) {
      empty.hidden = false;
      body.hidden = true;
      return;
    }
    empty.hidden = true;
    body.hidden = false;

    var list = $("question-list");
    var showPos = $("filter-positive").checked;
    var showNeg = $("filter-negative").checked;
    list.innerHTML = "";
    $("active-count").textContent =
      window.SociogramQuestions.activeQuestions(cls.questions).length +
      " van " +
      cls.questions.length +
      " aan · " +
      cls.name;

    cls.questions
      .filter(function (q) {
        if (q.polarity === "positive" && !showPos) return false;
        if (q.polarity === "negative" && !showNeg) return false;
        return true;
      })
      .forEach(function (q) {
        var card = document.createElement("article");
        card.className = "q-card" + (q.enabled ? "" : " is-off");
        card.innerHTML =
          '<div class="q-card-top"><div class="q-meta">' +
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

        card.querySelector('[data-action="toggle"]').onchange = function (e) {
          q.enabled = e.target.checked;
          cls.isDemo = false;
          save();
          renderQuestions();
          refreshVizFilter();
        };
        card.querySelectorAll("[data-field]").forEach(function (input) {
          input.onchange = function () {
            var field = input.getAttribute("data-field");
            if (field === "maxChoices") {
              q.maxChoices = Math.min(5, Math.max(1, Number(input.value) || 1));
            } else {
              q[field] = input.value.trim();
            }
            cls.isDemo = false;
            save();
            renderQuestions();
          };
        });
        list.appendChild(card);
      });
  }

  $("filter-positive").addEventListener("change", renderQuestions);
  $("filter-negative").addEventListener("change", renderQuestions);

  $("btn-reset-questions").addEventListener("click", function () {
    var cls = active();
    if (!cls) return;
    if (!confirm("Vragen van deze klas terugzetten naar standaard?")) return;
    cls.questions = window.SociogramQuestions.cloneDefaultQuestions();
    cls.isDemo = false;
    save();
    renderQuestions();
  });

  $("btn-enable-positive").addEventListener("click", function () {
    var cls = active();
    if (!cls) return;
    cls.questions.forEach(function (q) {
      q.enabled = q.polarity === "positive";
    });
    save();
    renderQuestions();
  });

  $("btn-enable-all").addEventListener("click", function () {
    var cls = active();
    if (!cls) return;
    cls.questions.forEach(function (q) {
      q.enabled = true;
    });
    save();
    renderQuestions();
  });

  /* ---------- codes ---------- */
  function hasAnswered(cls, studentId) {
    var activeQs = window.SociogramQuestions.activeQuestions(cls.questions);
    if (!activeQs.length) return false;
    var bag = cls.nominations[studentId] || {};
    return activeQs.some(function (q) {
      return (bag[q.id] || []).length > 0;
    });
  }

  function renderProgress() {
    var cls = active();
    var ul = $("progress-list");
    ul.innerHTML = "";
    if (!cls) {
      ul.innerHTML = '<li class="muted">Geen actieve klas</li>';
      return;
    }
    save();
    cls.students.forEach(function (s) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span><strong>" +
        escapeHtml(s.code || "????") +
        "</strong> · " +
        escapeHtml(s.name) +
        '</span><span class="status-dot ' +
        (hasAnswered(cls, s.id) ? "done" : "todo") +
        '"></span>';
      ul.appendChild(li);
    });
  }

  $("btn-copy-link").addEventListener("click", function () {
    var url = new URL("leerling.html", location.href).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        $("invite-status").textContent = "Leerlinglink gekopieerd.";
      });
    } else {
      $("invite-status").textContent = url;
    }
  });

  /* ---------- beeld ---------- */
  function refreshVizFilter() {
    var cls = active();
    var sel = $("viz-question-filter");
    var current = sel.value || "all";
    sel.innerHTML = '<option value="all">Alle actieve vragen</option>';
    if (!cls) return;
    window.SociogramQuestions.activeQuestions(cls.questions).forEach(function (q) {
      var opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent =
        (q.polarity === "positive" ? "+ " : "− ") + q.label;
      sel.appendChild(opt);
    });
    sel.value =
      current === "all" ||
      cls.questions.some(function (q) {
        return q.id === current && q.enabled;
      })
        ? current
        : "all";
  }

  function renderViz() {
    var cls = active();
    refreshVizFilter();
    $("print-class-title").textContent = cls
      ? "Sociogram · " + cls.name
      : "";
    if (!cls) {
      window.SociogramViz.draw(
        $("sociogram-svg"),
        [],
        {},
        [],
        "all"
      );
      $("signals-list").innerHTML = "";
      return;
    }
    var signals = window.SociogramViz.draw(
      $("sociogram-svg"),
      cls.students,
      cls.nominations,
      cls.questions,
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
  $("btn-print").addEventListener("click", function () {
    renderViz();
    window.print();
  });

  refreshAll();
})();
