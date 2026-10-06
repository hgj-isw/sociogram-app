/** Testklas Demo 2A — vaste codes voor oefenen */
window.SociogramDemo = (function () {
  function buildClass() {
    var roster = [
      { name: "Anna", code: "A3K7" },
      { name: "Boris", code: "B2M9" },
      { name: "Carmen", code: "C8P4" },
      { name: "Daan", code: "D5R1" },
      { name: "Emma", code: "E6T2" },
      { name: "Finn", code: "F7V3" },
      { name: "Gwen", code: "G9W5" },
      { name: "Hugo", code: "H4X8" },
    ];
    var students = roster.map(function (row, i) {
      return { id: "demo-s-" + (i + 1), name: row.name, code: row.code };
    });
    var byName = {};
    students.forEach(function (s) {
      byName[s.name] = s.id;
    });

    var questions = window.SociogramQuestions.cloneDefaultQuestions();
    questions.forEach(function (q) {
      q.enabled =
        q.id === "q-samenwerken" || q.id === "q-zitten" || q.id === "q-pauze";
    });

    // Voorbeelddata alleen voor docent-beeld — leerlingen starten leeg bij invullen
    var nominations = {};
    function pick(from, qid, toNames) {
      var fid = byName[from];
      if (!nominations[fid]) nominations[fid] = {};
      nominations[fid][qid] = toNames.map(function (n) {
        return byName[n];
      });
    }
    pick("Anna", "q-samenwerken", ["Boris", "Carmen", "Emma"]);
    pick("Boris", "q-samenwerken", ["Anna", "Daan"]);
    pick("Carmen", "q-samenwerken", ["Anna", "Emma", "Gwen"]);
    pick("Daan", "q-samenwerken", ["Boris", "Finn"]);
    pick("Emma", "q-samenwerken", ["Anna", "Carmen"]);
    pick("Finn", "q-samenwerken", ["Daan", "Hugo"]);
    pick("Gwen", "q-samenwerken", ["Carmen", "Emma"]);
    pick("Hugo", "q-samenwerken", ["Finn", "Daan"]);
    pick("Anna", "q-zitten", ["Emma", "Carmen"]);
    pick("Boris", "q-zitten", ["Daan", "Anna"]);
    pick("Carmen", "q-zitten", ["Anna", "Gwen"]);
    pick("Emma", "q-zitten", ["Anna", "Carmen"]);

    return {
      id: "demo-class-2a",
      name: "Demo 2A",
      students: students,
      questions: questions,
      nominations: nominations,
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
  }

  return { buildClass: buildClass };
})();
