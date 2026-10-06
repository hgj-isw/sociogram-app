window.SociogramFormsExcel = (function () {
  var META_HEADERS = {
    id: true,
    starttime: true,
    completiontime: true,
    email: true,
    name: true,
    "last name": true,
    "first name": true,
    voornaam: true,
    achternaam: true,
    leerling: true,
    respondent: true,
    "naam leerling": true,
  };

  function normalizeHeader(h) {
    return String(h || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase();
  }

  function activeQuestions(state) {
    return state.questions.filter(function (q) {
      return q.enabled;
    });
  }

  function questionsForPackage(state, mode) {
    return window.SociogramQuestions.packageQuestions(state.questions, mode || "positive");
  }

  function buildCopilotPrompt(state, mode) {
    var pack = questionsForPackage(state, mode);
    var classLabel = state.className || "klas";
    var names = state.students.map(function (s) {
      return s.name;
    });
    var lines = [];
    lines.push(
      "Maak in Microsoft Forms een nieuw formulier voor een klassensociogram."
    );
    lines.push("Titel: Sociogram " + classLabel);
    lines.push(
      "Beschrijving: Dit sociogram geeft de mentor inzicht in de groepsdynamiek. Antwoorden zijn vertrouwelijk en alleen voor de mentor. Vul eerlijk in."
    );
    lines.push("");
    lines.push("BELANGRIJK over limieten:");
    lines.push(
      "- Forms kan GEEN harde limiet 'max 2/3 antwoorden' op één meerkeuzevraag."
    );
    lines.push(
      "- Oplossing: maak per sociogram-onderwerp AFZONDERLIJKE keuzelijst-vragen (één antwoord per vraag): keuze 1, keuze 2, …"
    );
    lines.push(
      "- Gebruik exact de vraagtitels hieronder (inclusief '(keuze N)'), anders faalt de Excel-import in onze app."
    );
    lines.push("");
    lines.push("Eisen:");
    lines.push(
      "1) Eerste vraag: 'Wat is je naam?' als keuzelijst (één antwoord) met exact deze opties:"
    );
    if (names.length) {
      names.forEach(function (n) {
        lines.push("   • " + n);
      });
    } else {
      lines.push("   • (vul hier de klaslijst in)");
    }
    lines.push(
      "2) Daarna voor elk onderdeel hieronder: aparte keuzelijst-vragen (ÉÉN antwoord), opties = dezelfde namen."
    );
    lines.push(
      "3) Verzamelen van reacties: alleen personen in mijn organisatie; bij voorkeur één reactie per persoon; deel de koppeling met de klas."
    );
    lines.push("");
    lines.push("Vragen (letterlijke titels):");
    pack.forEach(function (q, i) {
      lines.push("");
      lines.push(
        "Onderdeel " +
          (i + 1) +
          " [" +
          (q.polarity === "positive" ? "positief" : "negatief") +
          "] — basis: " +
          q.text
      );
      for (var k = 1; k <= q.maxChoices; k++) {
        lines.push(
          "   - Titel exact: " +
            q.text +
            " (keuze " +
            k +
            ")"
        );
        lines.push(
          "     Type: Keuze / Dropdown · één antwoord · opties = alle leerlingennamen"
        );
      }
    });
    lines.push("");
    lines.push(
      "Maak het formulier klaar om te delen binnen de school (Office 365)."
    );
    return lines.join("\n");
  }

  function buildFormsGuide(state, mode) {
    var pack = questionsForPackage(state, mode);
    var classLabel = state.className || "klas";
    var lines = [];
    lines.push("SOCIOGRAM — Microsoft Forms bouwhandleiding");
    lines.push("Klas: " + classLabel);
    lines.push("Pakket: " + (mode || "positive"));
    lines.push("Gegenereerd: " + new Date().toLocaleString("nl-NL"));
    lines.push("");
    lines.push("Geen database nodig. Forms + CSV-import volstaat.");
    lines.push("");
    lines.push("Limiet max N keuzes: gebruik aparte vragen '(keuze 1)' … '(keuze N)'.");
    lines.push("");
    lines.push("=== VRAGEN (exacte titels) ===");
    pack.forEach(function (q, i) {
      lines.push("");
      lines.push(i + 1 + ". " + q.text + " · id=" + q.id);
      for (var k = 1; k <= q.maxChoices; k++) {
        lines.push("   " + q.text + " (keuze " + k + ")");
      }
    });
    lines.push("");
    lines.push("=== LEERLINGEN ===");
    if (!state.students.length) {
      lines.push("(nog geen leerlingen — vul eerst Klas)");
    } else {
      state.students.forEach(function (s) {
        lines.push(s.name);
      });
    }
    return lines.join("\r\n");
  }

  function studentNamesList(state) {
    return state.students
      .map(function (s) {
        return s.name;
      })
      .join("\r\n");
  }

  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /** Minimal CSV parser (handles quotes) */
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var i = 0;
    var inQuotes = false;
    text = String(text).replace(/^\uFEFF/, "");
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        cell += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.length > 1 || (row[0] && row[0].trim() !== "")) rows.push(row);
        row = [];
        i++;
        continue;
      }
      cell += ch;
      i++;
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function splitNames(cell) {
    return String(cell || "")
      .split(/[;\n|/]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function findStudentByName(students, name) {
    var key = String(name || "")
      .trim()
      .toLowerCase();
    if (!key) return null;
    for (var i = 0; i < students.length; i++) {
      if (students[i].name.toLowerCase() === key) return students[i];
    }
    // partial: "Anna" matches "Anna de Vries" if unique
    var partial = students.filter(function (s) {
      return (
        s.name.toLowerCase().indexOf(key) === 0 ||
        key.indexOf(s.name.toLowerCase()) === 0
      );
    });
    if (partial.length === 1) return partial[0];
    return null;
  }

  function stripChoiceSuffix(header) {
    return String(header || "")
      .replace(/\s*[\(\[]\s*keuze\s*\d+\s*[\)\]]\s*$/i, "")
      .replace(/\s*[-–—:]\s*keuze\s*\d+\s*$/i, "")
      .replace(/\s*[\(\[]\s*choice\s*\d+\s*[\)\]]\s*$/i, "")
      .replace(/\s*[-–—:]\s*choice\s*\d+\s*$/i, "")
      .replace(/\s+\d+\s*$/, "")
      .trim();
  }

  function matchQuestion(header, questions) {
    var raw = String(header || "").trim();
    var h = normalizeHeader(raw);
    var hBase = normalizeHeader(stripChoiceSuffix(raw));
    if (!h || META_HEADERS[h] || META_HEADERS[hBase]) return null;
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var qt = normalizeHeader(q.text);
      var ql = normalizeHeader(q.label);
      var qid = normalizeHeader(q.id);
      if (h === qid || hBase === qid) return q;
      if (h === qt || hBase === qt) return q;
      if (h === ql || hBase === ql) return q;
      if (h.indexOf(qt) === 0 || hBase.indexOf(qt) === 0) return q;
    }
    return null;
  }

  function detectRespondentColumn(headers) {
    var preferred = [
      "name",
      "naam",
      "leerling",
      "respondent",
      "naam leerling",
      "wat is je naam?",
      "wat is je naam",
    ];
    for (var i = 0; i < headers.length; i++) {
      var h = normalizeHeader(headers[i]);
      if (preferred.indexOf(h) !== -1) return i;
    }
    // email as fallback then map via display name if needed
    for (var j = 0; j < headers.length; j++) {
      if (normalizeHeader(headers[j]) === "email") return j;
    }
    return -1;
  }

  /**
   * Import Forms/Excel CSV into nominations.
   * Returns { ok, imported, skipped, warnings, nominations, studentsAdded }
   */
  function importCsv(text, state) {
    var rows = parseCsv(text);
    var warnings = [];
    if (rows.length < 2) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        warnings: ["Geen datarijen gevonden. Upload een CSV met kopregel."],
        nominations: state.nominations,
        studentsAdded: 0,
      };
    }

    var headers = rows[0];
    var respondentCol = detectRespondentColumn(headers);
    if (respondentCol < 0) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        warnings: [
          "Geen kolom 'Name' / 'Naam' / 'Leerling' gevonden. Voeg in Forms een naamvraag toe.",
        ],
        nominations: state.nominations,
        studentsAdded: 0,
      };
    }

    var colQuestions = [];
    headers.forEach(function (h, idx) {
      if (idx === respondentCol) return;
      var q = matchQuestion(h, state.questions);
      if (q) colQuestions.push({ idx: idx, q: q });
    });

    if (!colQuestions.length) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        warnings: [
          "Geen vraagkolommen herkend. Zorg dat kolomkoppen gelijk zijn aan de vraagtekst in de app.",
        ],
        nominations: state.nominations,
        studentsAdded: 0,
      };
    }

    var students = state.students.slice();
    var nominations = Object.assign({}, state.nominations);
    Object.keys(nominations).forEach(function (k) {
      nominations[k] = Object.assign({}, nominations[k]);
    });

    var studentsAdded = 0;
    var imported = 0;
    var skipped = 0;

    function ensureStudent(name) {
      var found = findStudentByName(students, name);
      if (found) return found;
      var student = {
        id: "s-" + Math.random().toString(36).slice(2, 9),
        name: String(name).trim(),
      };
      students.push(student);
      studentsAdded++;
      return student;
    }

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var rawName = (row[respondentCol] || "").trim();
      if (!rawName) {
        skipped++;
        continue;
      }
      // If email column used, try before @ as weak name — warn
      if (rawName.indexOf("@") !== -1) {
        warnings.push(
          "Rij " + (r + 1) + ": e-mail als respondent (" + rawName + "). Zet liever namen in Forms."
        );
      }

      var from = ensureStudent(rawName);
      if (!nominations[from.id]) nominations[from.id] = {};

      // Meerdere kolommen per vraag (keuze 1/2/3) samenvoegen
      var byQuestion = {};
      colQuestions.forEach(function (cq) {
        if (!byQuestion[cq.q.id]) byQuestion[cq.q.id] = { q: cq.q, idxs: [] };
        byQuestion[cq.q.id].idxs.push(cq.idx);
      });

      Object.keys(byQuestion).forEach(function (qid) {
        var group = byQuestion[qid];
        var ids = [];
        group.idxs.forEach(function (idx) {
          splitNames(row[idx]).forEach(function (n) {
            var to = findStudentByName(students, n);
            if (!to) to = ensureStudent(n);
            if (to.id !== from.id && ids.indexOf(to.id) === -1) {
              ids.push(to.id);
            }
          });
        });
        if (ids.length > group.q.maxChoices) {
          ids = ids.slice(0, group.q.maxChoices);
          warnings.push(
            from.name +
              ": meer keuzes dan max bij '" +
              group.q.label +
              "' — afgekapt tot " +
              group.q.maxChoices
          );
        }
        nominations[from.id][qid] = ids;
      });
      imported++;
    }

    return {
      ok: true,
      imported: imported,
      skipped: skipped,
      warnings: warnings,
      nominations: nominations,
      students: students,
      studentsAdded: studentsAdded,
      matchedQuestions: (function () {
        var seen = {};
        var labels = [];
        colQuestions.forEach(function (c) {
          if (seen[c.q.id]) return;
          seen[c.q.id] = true;
          labels.push(c.q.label);
        });
        return labels;
      })(),
      matchedQuestionIds: (function () {
        var seen = {};
        var ids = [];
        colQuestions.forEach(function (c) {
          if (seen[c.q.id]) return;
          seen[c.q.id] = true;
          ids.push(c.q.id);
        });
        return ids;
      })(),
    };
  }

  return {
    buildFormsGuide: buildFormsGuide,
    buildCopilotPrompt: buildCopilotPrompt,
    questionsForPackage: questionsForPackage,
    studentNamesList: studentNamesList,
    downloadText: downloadText,
    parseCsv: parseCsv,
    importCsv: importCsv,
    activeQuestions: activeQuestions,
  };
})();
