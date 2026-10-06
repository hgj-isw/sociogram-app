(function () {
  var state = window.SociogramStorage.load();
  window.SociogramCodes.ensureCodes(state.students);
  window.SociogramStorage.save(state);

  var currentStudent = null;

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

  function showForm(student) {
    currentStudent = student;
    $("gate").hidden = true;
    $("form-wrap").hidden = false;
    $("hello").textContent = "Hallo " + student.name;
    $("class-label").textContent = state.className
      ? "Klas " + state.className
      : "";
    $("save-msg").textContent = "";
    renderQuestions();
    window.scrollTo(0, 0);
  }

  function renderQuestions() {
    var form = $("leerling-form");
    form.innerHTML = "";
    var active = window.SociogramQuestions.activeQuestions(state.questions);
    if (!active.length) {
      form.innerHTML =
        '<p class="hint">Er staan geen vragen klaar. Vraag je mentor.</p>';
      return;
    }
    var saved = state.nominations[currentStudent.id] || {};
    var others = state.students.filter(function (s) {
      return s.id !== currentStudent.id;
    });

    active.forEach(function (q) {
      var block = document.createElement("div");
      block.className = "nomination-block";
      var selected = saved[q.id] || [];
      var html =
        "<h3>" +
        escapeHtml(q.text) +
        "</h3>" +
        '<p class="hint">Maximaal ' +
        q.maxChoices +
        " keuzes</p>" +
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
          var boxes = block.querySelectorAll('input[type="checkbox"]:checked');
          if (boxes.length > q.maxChoices) {
            cb.checked = false;
            alert("Maximaal " + q.maxChoices + " keuzes.");
          }
        });
      });
      form.appendChild(block);
    });
  }

  function openWithCode(raw) {
    var student = window.SociogramCodes.findByCode(state.students, raw);
    var err = $("gate-err");
    if (!student) {
      err.textContent = "Code niet gevonden. Check bij je mentor.";
      return;
    }
    err.textContent = "";
    showForm(student);
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

  $("btn-save").addEventListener("click", function () {
    if (!currentStudent) return;
    if (!state.nominations[currentStudent.id]) {
      state.nominations[currentStudent.id] = {};
    }
    var active = window.SociogramQuestions.activeQuestions(state.questions);
    active.forEach(function (q) {
      var checked = Array.prototype.slice.call(
        document.querySelectorAll(
          '#leerling-form input[data-qid="' + q.id + '"]:checked'
        )
      );
      state.nominations[currentStudent.id][q.id] = checked.map(function (el) {
        return el.value;
      });
    });
    window.SociogramStorage.save(state);
    $("save-msg").textContent = "Bedankt, je antwoorden zijn opgeslagen.";
  });

  // ?code=A3K7 in URL
  var params = new URLSearchParams(location.search);
  var preset = params.get("code");
  if (preset) {
    $("code-input").value = String(preset).toUpperCase();
    openWithCode(preset);
  }
})();
