/** Testklas Demo 2A — voor oefenen zonder echte klas */
window.SociogramDemo = (function () {
  function build() {
    var names = [
      "Anna",
      "Boris",
      "Carmen",
      "Daan",
      "Emma",
      "Finn",
      "Gwen",
      "Hugo",
    ];
    var students = names.map(function (name, i) {
      return { id: "demo-s-" + (i + 1), name: name };
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

    // Enkele voorbeeld-nominaties zodat Beeld meteen iets toont
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
      className: "Demo 2A",
      students: students,
      questions: questions,
      nominations: nominations,
      isDemo: true,
    };
  }

  return { build: build };
})();
