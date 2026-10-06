window.SociogramStorage = (function () {
  var KEY = "sociogram-mentor-v1";
  var BAD_PAUSE =
    "Met wie praat of hang je graag op in de pauze?";
  var GOOD_PAUSE = "Met wie praat je graag in de pauze?";

  function defaultState() {
    return {
      className: "",
      students: [],
      questions: window.SociogramQuestions.cloneDefaultQuestions(),
      nominations: {},
    };
  }

  function migrateQuestions(questions) {
    if (!Array.isArray(questions)) return window.SociogramQuestions.cloneDefaultQuestions();
    return questions.map(function (q) {
      var copy = window.SociogramQuestions.migrateQuestion(q);
      if (copy.id === "q-pauze" && copy.text === BAD_PAUSE) {
        copy.text = GOOD_PAUSE;
      }
      return copy;
    });
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return {
        className: parsed.className || "",
        students: Array.isArray(parsed.students) ? parsed.students : [],
        questions: migrateQuestions(parsed.questions),
        nominations:
          parsed.nominations && typeof parsed.nominations === "object"
            ? parsed.nominations
            : {},
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  return { load: load, save: save, defaultState: defaultState, KEY: KEY };
})();
