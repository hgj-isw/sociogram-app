window.SociogramStorage = (function () {
  var KEY = "sociogram-mentor-v2";
  var KEY_OLD = "sociogram-mentor-v1";
  var BAD_PAUSE = "Met wie praat of hang je graag op in de pauze?";
  var GOOD_PAUSE = "Met wie praat je graag in de pauze?";

  function uid(prefix) {
    return (prefix || "c") + "-" + Math.random().toString(36).slice(2, 10);
  }

  function migrateQuestions(questions) {
    if (!Array.isArray(questions)) {
      return window.SociogramQuestions.cloneDefaultQuestions();
    }
    return questions.map(function (q) {
      var copy = window.SociogramQuestions.migrateQuestion(q);
      if (copy.id === "q-pauze" && copy.text === BAD_PAUSE) {
        copy.text = GOOD_PAUSE;
      }
      return copy;
    });
  }

  function normalizeClass(c) {
    var students = Array.isArray(c.students) ? c.students : [];
    if (window.SociogramCodes) window.SociogramCodes.ensureCodes(students);
    return {
      id: c.id || uid("c"),
      name: c.name || "",
      students: students,
      questions: migrateQuestions(c.questions),
      nominations:
        c.nominations && typeof c.nominations === "object" ? c.nominations : {},
      isDemo: !!c.isDemo,
      createdAt: c.createdAt || new Date().toISOString(),
    };
  }

  function wrapClasses(classes, activeClassId) {
    var list = (classes || []).map(normalizeClass);
    if (!list.length && window.SociogramDemo) {
      list = [normalizeClass(window.SociogramDemo.buildClass())];
    }
    var active = activeClassId;
    if (!active || !list.some(function (c) { return c.id === active; })) {
      active = list.length ? list[0].id : null;
    }
    return { version: 2, activeClassId: active, classes: list };
  }

  function defaultState() {
    return wrapClasses(
      window.SociogramDemo ? [window.SociogramDemo.buildClass()] : [],
      null
    );
  }

  function migrateFromV1(parsed) {
    if (!parsed) return null;
    if (parsed.version === 2 && Array.isArray(parsed.classes)) {
      return wrapClasses(parsed.classes, parsed.activeClassId);
    }
    // oude single-class
    if (parsed.students || parsed.className || parsed.questions) {
      if (parsed.isDemo && window.SociogramDemo) {
        return wrapClasses([window.SociogramDemo.buildClass()], null);
      }
      return wrapClasses(
        [
          {
            id: uid("c"),
            name: parsed.className || "Klas",
            students: parsed.students || [],
            questions: parsed.questions,
            nominations: parsed.nominations || {},
            isDemo: !!parsed.isDemo,
          },
        ],
        null
      );
    }
    return null;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        var old = localStorage.getItem(KEY_OLD);
        if (old) {
          var migrated = migrateFromV1(JSON.parse(old));
          if (migrated) {
            save(migrated);
            return migrated;
          }
        }
        return defaultState();
      }
      var parsed = JSON.parse(raw);
      var state = migrateFromV1(parsed);
      return state || defaultState();
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function getActive(state) {
    if (!state || !state.classes || !state.classes.length) return null;
    for (var i = 0; i < state.classes.length; i++) {
      if (state.classes[i].id === state.activeClassId) return state.classes[i];
    }
    return state.classes[0];
  }

  function setActive(state, classId) {
    state.activeClassId = classId;
    return getActive(state);
  }

  function allCodesUsed(state) {
    var used = {};
    (state.classes || []).forEach(function (c) {
      (c.students || []).forEach(function (s) {
        if (s.code) used[String(s.code).toUpperCase()] = true;
      });
    });
    return used;
  }

  function findByCode(state, code) {
    var key = String(code || "")
      .trim()
      .toUpperCase();
    if (!key) return null;
    for (var i = 0; i < state.classes.length; i++) {
      var c = state.classes[i];
      for (var j = 0; j < c.students.length; j++) {
        if (String(c.students[j].code || "").toUpperCase() === key) {
          return { classObj: c, student: c.students[j] };
        }
      }
    }
    return null;
  }

  return {
    KEY: KEY,
    load: load,
    save: save,
    defaultState: defaultState,
    getActive: getActive,
    setActive: setActive,
    allCodesUsed: allCodesUsed,
    findByCode: findByCode,
    uid: uid,
    normalizeClass: normalizeClass,
  };
})();
