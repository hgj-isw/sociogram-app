(function () {
  var state = window.SociogramStorage.load();
  window.SociogramStorage.save(state);

  var currentClass = null;
  var currentStudent = null;
  var activeQuestions = [];
  var step = 0;
  /** antwoorden in geheugen — bewust leeg starten (niet vooringevuld) */
  var draft = {};

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

  function showWizard() {
    $("gate").hidden = true;
    $("form-wrap").hidden = false;
    $("hello").textContent = "Hallo " + currentStudent.name;
    $("class-label").textContent = currentClass.name
      ? "Klas " + currentClass.name
      : "";
    $("save-msg").textContent = "";
    step = 0;
    draft = {};
    activeQuestions = window.SociogramQuestions.activeQuestions(
      currentClass.questions
    );
    if (!activeQuestions.length) {
      $("question-step").innerHTML =
        '<p class="hint">Er staan geen vragen klaar. Vraag je mentor.</p>';
      $("btn-next").hidden = true;
      $("btn-prev").hidden = true;
      return;
    }
    renderStep();
    window.scrollTo(0, 0);
  }

  function renderStep() {
    var q = activeQuestions[step];
    var total = activeQuestions.length;
    $("step-indicator").textContent =
      "Vraag " + (step + 1) + " van " + total;
    $("btn-prev").hidden = step === 0;
    $("btn-next").textContent =
      step === total - 1 ? "Versturen" : "Volgende";

    var others = currentClass.students.filter(function (s) {
      return s.id !== currentStudent.id;
    });
    var selected = draft[q.id] || [];

    var html =
      "<h2 class=\"step-question\">" +
      escapeHtml(q.text) +
      "</h2>" +
      '<p class="hint">Maximaal ' +
      q.maxChoices +
      " keuzes</p>" +
      '<div class="choice-grid choice-grid-compact">';
    others.forEach(function (s) {
      html +=
        "<label><input type=\"checkbox\" value=\"" +
        escapeAttr(s.id) +
        '" ' +
        (selected.indexOf(s.id) !== -1 ? "checked" : "") +
        " /> " +
        escapeHtml(s.name) +
        "</label>";
    });
    html += "</div>";
    $("question-step").innerHTML = html;

    $("question-step")
      .querySelectorAll('input[type="checkbox"]')
      .forEach(function (cb) {
        cb.addEventListener("change", function () {
          var boxes = $("question-step").querySelectorAll(
            'input[type="checkbox"]:checked'
          );
          if (boxes.length > q.maxChoices) {
            cb.checked = false;
            alert("Maximaal " + q.maxChoices + " keuzes.");
          }
        });
      });

    window.scrollTo(0, 0);
  }

  function collectCurrentStep() {
    var q = activeQuestions[step];
    if (!q) return;
    var checked = Array.prototype.slice.call(
      $("question-step").querySelectorAll('input[type="checkbox"]:checked')
    );
    draft[q.id] = checked.map(function (el) {
      return el.value;
    });
  }

  function openWithCode(raw) {
    var hit = window.SociogramStorage.findByCode(state, raw);
    var err = $("gate-err");
    if (!hit) {
      err.textContent = "Code niet gevonden. Check bij je mentor.";
      return;
    }
    err.textContent = "";
    currentClass = hit.classObj;
    currentStudent = hit.student;
    showWizard();
  }

  $("btn-code-go").addEventListener("click", function () {
    openWithCode($("code-input").value);
  });

  $("code-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      openWithCode($("code-input").value);
    }
  });

  $("code-input").addEventListener("input", function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  $("btn-prev").addEventListener("click", function () {
    collectCurrentStep();
    if (step > 0) {
      step--;
      renderStep();
    }
  });

  $("btn-next").addEventListener("click", function () {
    collectCurrentStep();
    if (step < activeQuestions.length - 1) {
      step++;
      renderStep();
      return;
    }
    // versturen
    if (!currentClass.nominations[currentStudent.id]) {
      currentClass.nominations[currentStudent.id] = {};
    }
    activeQuestions.forEach(function (q) {
      currentClass.nominations[currentStudent.id][q.id] = draft[q.id] || [];
    });
    window.SociogramStorage.save(state);
    $("question-step").innerHTML =
      '<p class="lede">Bedankt. Je antwoorden zijn opgeslagen voor je mentor.</p>';
    $("btn-next").hidden = true;
    $("btn-prev").hidden = true;
    $("step-indicator").textContent = "Klaar";
    $("save-msg").textContent = "";
  });

  var preset = new URLSearchParams(location.search).get("code");
  if (preset) {
    $("code-input").value = String(preset).toUpperCase();
    openWithCode(preset);
  }
})();
