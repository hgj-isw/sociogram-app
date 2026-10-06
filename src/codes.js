window.SociogramCodes = (function () {
  var CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function makeCode(used) {
    var code = "";
    do {
      code = "";
      for (var i = 0; i < 4; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
      }
    } while (used[code]);
    used[code] = true;
    return code;
  }

  function ensureCodes(students, extraUsed) {
    var used = Object.assign({}, extraUsed || {});
    students.forEach(function (s) {
      if (s.code) used[String(s.code).toUpperCase()] = true;
    });
    students.forEach(function (s) {
      if (!s.code) s.code = makeCode(used);
      else s.code = String(s.code).toUpperCase();
    });
    return students;
  }

  function findByCode(students, code) {
    var key = String(code || "")
      .trim()
      .toUpperCase();
    if (!key) return null;
    for (var i = 0; i < students.length; i++) {
      if (String(students[i].code || "").toUpperCase() === key) {
        return students[i];
      }
    }
    return null;
  }

  return { makeCode: makeCode, ensureCodes: ensureCodes, findByCode: findByCode };
})();
