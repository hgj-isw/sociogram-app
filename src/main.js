(function () {
  var state = window.SociogramStorage.load();
  // persist migrated pause question if needed
  window.SociogramStorage.save(state);

  function uid() {
    return "s-" + Math.random().toString(36).slice(2, 9);
  }

  function save() {
    window.SociogramStorage.save(state);
  }

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll(".panel").forEach(function (panel) {
        var match = panel.id === "panel-" + tab;
        panel.classList.toggle("is-active", match);
        panel.hidden = !match;
      });
      if (tab === "beeld") renderViz();
      if (tab === "klas") renderStudents();
      if (tab === "forms") renderPackPanel();
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
    var showPos = $("filter-positive").checked;
    var showNeg = $("filter-negative").checked;
    list.innerHTML = "";

    var visible = state.questions.filter(function (q) {
      if (q.polarity === "positive" && !showPos) return false;
      if (q.polarity === "negative" && !showNeg) return false;
      return true;
    });

    var shown = window.SociogramQuestions.activeQuestions(state.questions).length;
    var withData = state.questions.filter(function (q) {
      return questionHasData(q.id);
    }).length;
    $("active-count").textContent =
      shown +
      " in beeld · " +
      withData +
      " met geïmporteerde data · " +
      state.questions.length +
      " in bibliotheek";

    visible.forEach(function (q) {
      var card = document.createElement("article");
      card.className = "q-card" + (q.enabled ? "" : " is-off");
      var dataNote = questionHasData(q.id)
        ? '<span class="pill pill-pos">Heeft data</span>'
        : '<span class="pill">Geen data</span>';
      card.innerHTML =
        '<div class="q-card-top">' +
        '<div class="q-meta">' +
        '<span class="pill ' +
        (q.polarity === "positive" ? "pill-pos" : "pill-neg") +
        '">' +
        (q.polarity === "positive" ? "Positief" : "Negatief") +
        "</span>" +
        dataNote +
        "<strong>" +
        escapeHtml(q.label) +
        "</strong>" +
        "</div>" +
        '<label class="toggle">' +
        '<input type="checkbox" data-action="toggle-viz" ' +
        (q.enabled ? "checked" : "") +
        " />" +
        "Tonen in sociogram" +
        "</label>" +
        "</div>" +
        '<div class="q-fields">' +
        "<div><label>Vraagtekst (voor Copilot/Forms — letterlijk overnemen)</label>" +
        '<input type="text" data-field="text" value="' +
        escapeAttr(q.text) +
        '" /></div>' +
        "<div><label>Korte naam</label>" +
        '<input type="text" data-field="label" value="' +
        escapeAttr(q.label) +
        '" /></div>' +
        '<div style="display:grid;grid-template-columns:120px 1fr;gap:10px">' +
        "<div><label>Max. keuzes</label>" +
        '<input type="number" min="1" max="5" data-field="maxChoices" value="' +
        q.maxChoices +
        '" /></div>' +
        "<div><label>Hint</label>" +
        '<input type="text" data-field="hint" value="' +
        escapeAttr(q.hint || "") +
        '" /></div>' +
        "</div>" +
        "</div>";

      card.querySelector('[data-action="toggle-viz"]').addEventListener("change", function (e) {
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
    if (!confirm("Vraagteksten terugzetten naar standaard? Geïmporteerde antwoorden blijven staan."))
      return;
    var oldNoms = state.nominations;
    var enabledMap = {};
    state.questions.forEach(function (q) {
      enabledMap[q.id] = q.enabled;
    });
    state.questions = window.SociogramQuestions.cloneDefaultQuestions();
    state.questions.forEach(function (q) {
      if (enabledMap[q.id]) q.enabled = true;
    });
    state.nominations = oldNoms;
    save();
    renderQuestions();
    refreshVizFilter();
  });

  $("btn-show-imported").addEventListener("click", function () {
    state.questions.forEach(function (q) {
      q.enabled = questionHasData(q.id);
    });
    save();
    renderQuestions();
    refreshVizFilter();
  });

  $("btn-show-all-viz").addEventListener("click", function () {
    state.questions.forEach(function (q) {
      q.enabled = true;
    });
    save();
    renderQuestions();
    refreshVizFilter();
  });

  /* ---------- class / students ---------- */
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
        (s.code
          ? ' <span class="hint">code ' + escapeHtml(s.code) + "</span>"
          : "") +
        '</span><button type="button" aria-label="Verwijder">Verwijder</button>';
      li.querySelector("button").addEventListener("click", function () {
        state.students = state.students.filter(function (x) {
          return x.id !== s.id;
        });
        delete state.nominations[s.id];
        Object.keys(state.nominations).forEach(function (fromId) {
          Object.keys(state.nominations[fromId] || {}).forEach(function (qid) {
            state.nominations[fromId][qid] = (state.nominations[fromId][qid] || []).filter(
              function (id) {
                return id !== s.id;
              }
            );
          });
        });
        save();
        renderStudents();
      });
      ul.appendChild(li);
    });
  }

  $("class-name").addEventListener("change", function () {
    state.className = $("class-name").value.trim();
    save();
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
    save();
    renderStudents();
  });

  $("btn-clear-students").addEventListener("click", function () {
    if (!confirm("Alle leerlingen en hun antwoorden wissen?")) return;
    state.students = [];
    state.nominations = {};
    save();
    renderStudents();
  });

  /* ---------- Uitdelen (Excel / HTML + codes) ---------- */
  function packageMode() {
    return ($("package-mode") && $("package-mode").value) || "positive";
  }

  function renderPackageCustom() {
    var box = $("package-custom-list");
    if (!box) return;
    var mode = packageMode();
    box.hidden = mode !== "custom";
    if (mode !== "custom") return;
    box.innerHTML = "";
    state.questions.forEach(function (q) {
      var label = document.createElement("label");
      label.innerHTML =
        '<input type="checkbox" data-qid="' +
        escapeAttr(q.id) +
        '" ' +
        (q.inPackage ? "checked" : "") +
        " /> " +
        escapeHtml(q.label) +
        " — " +
        escapeHtml(q.text);
      label.querySelector("input").addEventListener("change", function (e) {
        q.inPackage = e.target.checked;
        save();
      });
      box.appendChild(label);
    });
  }

  function showCodesPreview() {
    var box = $("codes-preview");
    if (!box) return;
    box.hidden = false;
    box.textContent = state.students
      .map(function (s) {
        return (s.code || "????") + "  →  " + s.name;
      })
      .join("\n");
  }

  function renderPackPanel() {
    renderPackageCustom();
    if (state.students.some(function (s) { return s.code; })) showCodesPreview();
  }

  if ($("package-mode")) {
    $("package-mode").addEventListener("change", renderPackageCustom);
  }

  function requireStudents() {
    if (!state.students.length) {
      alert("Voeg eerst leerlingen toe bij Klas.");
      return false;
    }
    return true;
  }

  $("btn-gen-leerling-html").addEventListener("click", function () {
    if (!requireStudents()) return;
    state.students = window.SociogramExcelPack.downloadLeerlingHtml(
      state,
      packageMode()
    );
    save();
    showCodesPreview();
    $("pack-status").textContent =
      "Gedownload: HTML-invulpagina + DOCENT-GEHEIM-codes.csv. Deel alleen de HTML (bijv. via Teams). Geef elke leerling privé de eigen code.";
  });

  $("btn-gen-excel").addEventListener("click", function () {
    if (!requireStudents()) return;
    state.students = window.SociogramExcelPack.downloadExcelPack(
      state,
      packageMode()
    );
    save();
    showCodesPreview();
    $("pack-status").textContent =
      "Gedownload: Excel (.xls) met tabblad per code + DOCENT-GEHEIM-codes.csv. Deel het .xls-bestand; codes privé houden.";
  });

  function applyImport(result) {
    var status = $("import-status");
    var warnUl = $("import-warnings");
    warnUl.innerHTML = "";

    if (!result || !result.ok) {
      status.textContent = "Import mislukt.";
      ((result && result.warnings) || ["Onbekend bestandsformaat"]).forEach(function (w) {
        var li = document.createElement("li");
        li.textContent = w;
        warnUl.appendChild(li);
      });
      return;
    }

    state.nominations = result.nominations;
    if (result.students) state.students = result.students;

    var matched = {};
    (result.matchedQuestionIds || []).forEach(function (id) {
      matched[id] = true;
    });
    state.questions.forEach(function (q) {
      q.enabled = !!matched[q.id];
    });

    save();
    renderStudents();
    renderQuestions();
    refreshVizFilter();

    status.textContent =
      "Geïmporteerd: " +
      result.imported +
      " respondent(en)" +
      (result.studentsAdded ? ", +" + result.studentsAdded + " namen" : "") +
      (result.matchedQuestions && result.matchedQuestions.length
        ? " · in beeld: " + result.matchedQuestions.join(", ")
        : "") +
      ". Open Beeld.";

    (result.warnings || []).forEach(function (w) {
      var li = document.createElement("li");
      li.textContent = w;
      warnUl.appendChild(li);
    });
  }

  function mergeImports(results) {
    var merged = {
      ok: false,
      imported: 0,
      warnings: [],
      nominations: Object.assign({}, state.nominations),
      students: state.students,
      matchedQuestionIds: [],
      matchedQuestions: [],
      studentsAdded: 0,
    };
    var matched = {};
    results.forEach(function (result) {
      if (!result || !result.ok) {
        merged.warnings = merged.warnings.concat(
          (result && result.warnings) || ["Bestand overgeslagen"]
        );
        return;
      }
      merged.ok = true;
      merged.imported += result.imported || 0;
      merged.studentsAdded += result.studentsAdded || 0;
      merged.warnings = merged.warnings.concat(result.warnings || []);
      if (result.students) merged.students = result.students;
      Object.keys(result.nominations || {}).forEach(function (sid) {
        merged.nominations[sid] = Object.assign(
          {},
          merged.nominations[sid] || {},
          result.nominations[sid]
        );
      });
      (result.matchedQuestionIds || []).forEach(function (id) {
        matched[id] = true;
      });
    });
    merged.matchedQuestionIds = Object.keys(matched);
    merged.matchedQuestions = state.questions
      .filter(function (q) {
        return matched[q.id];
      })
      .map(function (q) {
        return q.label;
      });
    return merged;
  }

  function runImportText(text) {
    var normalized = String(text || "");
    if (!normalized.trim()) return { ok: false, warnings: ["Lege inhoud"] };
    if (normalized.indexOf("\t") !== -1 && normalized.indexOf(",") === -1 && normalized.indexOf(";") === -1) {
      normalized = normalized
        .split(/\r?\n/)
        .map(function (line) {
          return line
            .split("\t")
            .map(function (cell) {
              if (/[";,\n]/.test(cell)) return '"' + cell.replace(/"/g, '""') + '"';
              return cell;
            })
            .join(";");
        })
        .join("\n");
    }

    if (/^\s*<\?xml|^\s*<Workbook/i.test(normalized)) {
      return window.SociogramExcelPack.importWorkbookXml(normalized, state);
    }

    var answer = window.SociogramExcelPack.importAnswerCsv(normalized, state);
    if (answer) return answer;
    return window.SociogramFormsExcel.importCsv(normalized, state);
  }

  $("btn-import-csv").addEventListener("click", function () {
    var fileInput = $("csv-file");
    var pasted = $("csv-paste").value;
    var files = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];

    if (!files.length) {
      applyImport(runImportText(pasted));
      return;
    }

    var pending = files.length;
    var results = [];
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        results.push(runImportText(reader.result));
        pending--;
        if (pending === 0) applyImport(mergeImports(results));
      };
      reader.readAsText(file, "UTF-8");
    });
  });

  $("csv-file").addEventListener("change", function () {
    if (!$("csv-file").files[0]) return;
    if ($("csv-file").files.length === 1) {
      var reader = new FileReader();
      reader.onload = function () {
        $("csv-paste").value = reader.result;
      };
      reader.readAsText($("csv-file").files[0], "UTF-8");
    }
  });

  /* ---------- visualization ---------- */
  function refreshVizFilter() {
    var sel = $("viz-question-filter");
    var current = sel.value || "all";
    sel.innerHTML = '<option value="all">Alle actieve vragen</option>';
    window.SociogramQuestions.activeQuestions(state.questions).forEach(function (q) {
      var opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent = (q.polarity === "positive" ? "+ " : "− ") + q.label;
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

  /* ---------- helpers ---------- */
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
  renderQuestions();
  renderStudents();
  refreshVizFilter();
})();
