/**
 * Excel-pakket + codes — zonder Node/database.
 * Genereert SpreadsheetML (.xls dat Excel/Excel Online opent) met tabblad per code.
 */
window.SociogramExcelPack = (function () {
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function makeCode(existing) {
    var code = "";
    do {
      code = "";
      for (var i = 0; i < 4; i++) {
        code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
      }
    } while (existing[code]);
    existing[code] = true;
    return code;
  }

  function ensureCodes(students) {
    var used = {};
    students.forEach(function (s) {
      if (s.code) used[String(s.code).toUpperCase()] = true;
    });
    students.forEach(function (s) {
      if (!s.code) s.code = makeCode(used);
      else {
        s.code = String(s.code).toUpperCase();
        used[s.code] = true;
      }
    });
    return students;
  }

  function packageQuestions(state, mode) {
    return window.SociogramQuestions.packageQuestions(
      state.questions,
      mode || "positive"
    );
  }

  function sheetName(code) {
    return String(code)
      .toUpperCase()
      .replace(/[:\\/?*\[\]]/g, "")
      .slice(0, 31);
  }

  function cellString(value) {
    return (
      '<Cell><Data ss:Type="String">' + escapeXml(value) + "</Data></Cell>"
    );
  }

  function row(cellsXml) {
    return "<Row>" + cellsXml + "</Row>";
  }

  function buildStudentSheetRows(qPack, classmateNames) {
    var rows = [];
    rows.push(
      row(
        cellString("Veld") +
          cellString("Jouw antwoord (typ of plak exacte klassenaam)")
      )
    );
    rows.push(
      row(
        cellString("Instructie") +
          cellString(
            "Vul alleen DIT tabblad in. Kies klasgenoten uit de lijst hieronder. Maximaal één naam per keuze-regel."
          )
      )
    );
    rows.push(row(cellString("Klasgenoten") + cellString(classmateNames.join(" | "))));
    rows.push(row(cellString("") + cellString("")));

    qPack.forEach(function (q) {
      for (var k = 1; k <= q.maxChoices; k++) {
        var label = q.text + " (keuze " + k + ")";
        rows.push(row(cellString(label) + cellString("")));
      }
    });
    return rows.join("");
  }

  function buildWorkbookXml(state, mode) {
    var students = ensureCodes(state.students.slice());
    var qPack = packageQuestions(state, mode);
    var names = students.map(function (s) {
      return s.name;
    });
    var classLabel = state.className || "klas";

    var parts = [];
    parts.push('<?xml version="1.0"?>');
    parts.push('<?mso-application progid="Excel.Sheet"?>');
    parts.push(
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
        ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
        ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
        ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
    );

    // Instructies (eerste tab)
    parts.push('<Worksheet ss:Name="LEES_MIJ"><Table>');
    parts.push(
      row(
        cellString(
          "Sociogram " +
            classLabel +
            " — vul ALLEEN het tabblad met JOUW persoonlijke code in."
        )
      )
    );
    parts.push(
      row(
        cellString(
          "Je krijgt de code van je mentor. Andere tabbladen niet openen/wijzigen."
        )
      )
    );
    parts.push(
      row(
        cellString(
          "Let op: Excel deelt het hele bestand; privacy berust op jouw code (niet op een kluis). Deel codes niet."
        )
      )
    );
    parts.push(
      row(
        cellString(
          "Na invullen: mentor downloadt het bestand en importeert het in de Sociogram-app."
        )
      )
    );
    parts.push("</Table></Worksheet>");

    students.forEach(function (s) {
      var others = names.filter(function (n) {
        return n !== s.name;
      });
      parts.push('<Worksheet ss:Name="' + escapeXml(sheetName(s.code)) + '"><Table>');
      parts.push(buildStudentSheetRows(qPack, others));
      parts.push("</Table></Worksheet>");
    });

    parts.push("</Workbook>");
    return { xml: parts.join(""), students: students, questions: qPack };
  }

  function buildDocentKeyCsv(students, className) {
    var lines = ["Klas;Naam;Code;Tabblad"];
    students.forEach(function (s) {
      lines.push(
        [className || "", s.name, s.code, sheetName(s.code)]
          .map(function (v) {
            return '"' + String(v).replace(/"/g, '""') + '"';
          })
          .join(";")
      );
    });
    return lines.join("\r\n");
  }

  function buildPakket(state, mode) {
    var students = ensureCodes(state.students.slice());
    var qPack = packageQuestions(state, mode);
    return {
      version: 1,
      className: state.className || "",
      createdAt: new Date().toISOString(),
      questions: qPack.map(function (q) {
        return {
          id: q.id,
          text: q.text,
          label: q.label,
          polarity: q.polarity,
          maxChoices: q.maxChoices,
        };
      }),
      students: students.map(function (s) {
        return { id: s.id, name: s.name, code: s.code };
      }),
    };
  }

  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function downloadText(filename, text, mime) {
    downloadBlob(filename, new Blob([text], { type: mime || "text/plain;charset=utf-8" }));
  }

  function downloadExcelPack(state, mode) {
    var built = buildWorkbookXml(state, mode);
    var safe = (state.className || "klas").replace(/\s+/g, "-");
    downloadBlob(
      "sociogram-invul-" + safe + ".xls",
      new Blob([built.xml], { type: "application/vnd.ms-excel" })
    );
    downloadText(
      "DOCENT-GEHEIM-codes-" + safe + ".csv",
      buildDocentKeyCsv(built.students, state.className),
      "text/csv;charset=utf-8"
    );
    return built.students;
  }

  /**
   * Parse SpreadsheetML / eenvoudige XML workbook terug naar nominaties.
   * Verwacht tabbladen = codes, kolom A = veldlabel, kolom B = antwoord.
   */
  function importWorkbookXml(xmlText, state) {
    var warnings = [];
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) {
      return {
        ok: false,
        warnings: ["Kon Excel-XML niet lezen. Sla op als Excel 2003 XML / .xls uit deze app, of gebruik CSV."],
      };
    }

    var ns = "urn:schemas-microsoft-com:office:spreadsheet";
    var sheets = doc.getElementsByTagNameNS
      ? doc.getElementsByTagNameNS(ns, "Worksheet")
      : doc.getElementsByTagName("Worksheet");
    if (!sheets.length) {
      sheets = doc.getElementsByTagName("ss:Worksheet");
    }

    var codeToStudent = {};
    ensureCodes(state.students).forEach(function (s) {
      codeToStudent[sheetName(s.code)] = s;
      codeToStudent[String(s.code).toUpperCase()] = s;
    });

    var nominations = Object.assign({}, state.nominations);
    Object.keys(nominations).forEach(function (k) {
      nominations[k] = Object.assign({}, nominations[k]);
    });

    var imported = 0;
    var matchedIds = {};

    function rowCells(rowEl) {
      var cells = rowEl.getElementsByTagNameNS
        ? rowEl.getElementsByTagNameNS(ns, "Cell")
        : rowEl.getElementsByTagName("Cell");
      if (!cells.length) cells = rowEl.getElementsByTagName("ss:Cell");
      var values = [];
      for (var i = 0; i < cells.length; i++) {
        var data = cells[i].getElementsByTagNameNS
          ? cells[i].getElementsByTagNameNS(ns, "Data")
          : cells[i].getElementsByTagName("Data");
        if (!data.length) data = cells[i].getElementsByTagName("ss:Data");
        values.push(data.length ? (data[0].textContent || "").trim() : "");
      }
      return values;
    }

    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      var name =
        sheet.getAttribute("ss:Name") ||
        sheet.getAttribute("Name") ||
        "";
      if (!name || name === "LEES_MIJ" || name.indexOf("DOCENT") === 0) continue;

      var student = codeToStudent[name.toUpperCase()];
      if (!student) {
        warnings.push("Onbekend tabblad/code: " + name);
        continue;
      }

      var rows = sheet.getElementsByTagNameNS
        ? sheet.getElementsByTagNameNS(ns, "Row")
        : sheet.getElementsByTagName("Row");
      if (!rows.length) rows = sheet.getElementsByTagName("ss:Row");

      var bag = {};
      for (var r = 0; r < rows.length; r++) {
        var vals = rowCells(rows[r]);
        if (vals.length < 2) continue;
        var label = vals[0];
        var answer = vals[1];
        if (!answer || label === "Veld" || label === "Instructie" || label === "Klasgenoten")
          continue;

        var q = window.SociogramFormsExcel
          ? null
          : null;
        // match via forms-excel helper if available
        if (window.SociogramFormsExcel && window.SociogramFormsExcel.matchQuestionPublic) {
          q = window.SociogramFormsExcel.matchQuestionPublic(label, state.questions);
        } else {
          q = matchQuestionLocal(label, state.questions);
        }
        if (!q) continue;
        matchedIds[q.id] = true;
        if (!bag[q.id]) bag[q.id] = [];
        var other = findByName(state.students, answer);
        if (other && other.id !== student.id && bag[q.id].indexOf(other.id) === -1) {
          bag[q.id].push(other.id);
        } else if (!other && answer) {
          warnings.push(name + ": naam niet herkend: " + answer);
        }
      }

      nominations[student.id] = bag;
      imported++;
    }

    return {
      ok: imported > 0,
      imported: imported,
      warnings: warnings,
      nominations: nominations,
      students: state.students,
      matchedQuestionIds: Object.keys(matchedIds),
      matchedQuestions: state.questions
        .filter(function (q) {
          return matchedIds[q.id];
        })
        .map(function (q) {
          return q.label;
        }),
      studentsAdded: 0,
    };
  }

  function matchQuestionLocal(header, questions) {
    var h = String(header || "")
      .replace(/\s*[\(\[]\s*keuze\s*\d+\s*[\)\]]\s*$/i, "")
      .trim()
      .toLowerCase();
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].text.toLowerCase() === h) return questions[i];
      if (header.toLowerCase().indexOf(questions[i].text.toLowerCase()) === 0)
        return questions[i];
    }
    return null;
  }

  function findByName(students, name) {
    var key = String(name || "")
      .trim()
      .toLowerCase();
    for (var i = 0; i < students.length; i++) {
      if (students[i].name.toLowerCase() === key) return students[i];
    }
    return null;
  }

  function buildLeerlingHtml(pakket) {
    var json = JSON.stringify(pakket).replace(/</g, "\\u003c");
    return (
      "<!DOCTYPE html>\n<html lang=\"nl\"><head><meta charset=\"UTF-8\"/>" +
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
      "<title>Sociogram invullen · " +
      escapeXml(pakket.className || "") +
      "</title>" +
      "<style>" +
      "body{font-family:Segoe UI,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;background:#e8ebe4;color:#1c2a24}" +
      "h1{font-size:1.5rem} .card{background:#f7f4ee;border:1px solid #c5cec4;border-radius:12px;padding:16px;margin:12px 0}" +
      "label{display:block;font-weight:600;margin:10px 0 4px} input,select{width:100%;padding:10px;border-radius:8px;border:1px solid #c5cec4;font:inherit}" +
      "button{background:#1f5c4d;color:#fff;border:0;padding:12px 16px;border-radius:10px;font-weight:700;cursor:pointer;margin-top:12px}" +
      ".hint{color:#5c6b63;font-size:.92rem} .err{color:#a85a3a}" +
      "</style></head><body>" +
      "<h1>Sociogram" +
      (pakket.className ? " · " + escapeXml(pakket.className) : "") +
      "</h1>" +
      "<p class=\"hint\">Vul je persoonlijke code in (van je mentor). Je ziet alleen jouw formulier.</p>" +
      "<div class=\"card\" id=\"gate\">" +
      "<label for=\"code\">Persoonlijke code</label>" +
      "<input id=\"code\" autocomplete=\"off\" placeholder=\"bijv. K4P9\"/>" +
      "<button type=\"button\" id=\"go\">Open mijn formulier</button>" +
      "<p class=\"err\" id=\"gate-err\"></p></div>" +
      "<div class=\"card\" id=\"form\" hidden></div>" +
      "<script>window.SOCIO_PAKKET=" +
      json +
      ";" +
      "document.getElementById('go').onclick=function(){" +
      "var code=(document.getElementById('code').value||'').trim().toUpperCase();" +
      "var p=window.SOCIO_PAKKET;var me=null;" +
      "for(var i=0;i<p.students.length;i++){if(String(p.students[i].code).toUpperCase()===code){me=p.students[i];break;}}" +
      "var err=document.getElementById('gate-err');" +
      "if(!me){err.textContent='Code niet gevonden. Check bij je mentor.';return;}" +
      "document.getElementById('gate').hidden=true;" +
      "var box=document.getElementById('form');box.hidden=false;box.innerHTML='';" +
      "var h=document.createElement('h2');h.textContent='Hallo '+me.name;box.appendChild(h);" +
      "var hint=document.createElement('p');hint.className='hint';hint.textContent='Kies klasgenoten. Andere tabbladen/codes niet gebruiken.';box.appendChild(hint);" +
      "var others=p.students.filter(function(s){return s.id!==me.id;});" +
      "p.questions.forEach(function(q){" +
      "var block=document.createElement('div');" +
      "var t=document.createElement('h3');t.textContent=q.text;block.appendChild(t);" +
      "for(var k=1;k<=q.maxChoices;k++){" +
      "var lab=document.createElement('label');lab.textContent='Keuze '+k;" +
      "var sel=document.createElement('select');sel.dataset.qid=q.id;sel.dataset.k=k;" +
      "var o0=document.createElement('option');o0.value='';o0.textContent='—';sel.appendChild(o0);" +
      "others.forEach(function(s){var o=document.createElement('option');o.value=s.name;o.textContent=s.name;sel.appendChild(o);});" +
      "block.appendChild(lab);block.appendChild(sel);}" +
      "box.appendChild(block);});" +
      "var btn=document.createElement('button');btn.textContent='Download mijn antwoorden (CSV)';" +
      "btn.onclick=function(){" +
      "var lines=['Code;Naam;VraagId;Vraag;KeuzeNr;Gekozen'];" +
      "p.questions.forEach(function(q){" +
      "for(var k=1;k<=q.maxChoices;k++){" +
      "var sel=box.querySelector('select[data-qid=\"'+q.id+'\"][data-k=\"'+k+'\"]');" +
      "var val=sel?sel.value:'';" +
      "lines.push([code,me.name,q.id,q.text,k,val].map(function(v){return '\"'+String(v).replace(/\"/g,'\"\"')+'\"';}).join(';'));" +
      "}});" +
      "var blob=new Blob([lines.join('\\r\\n')],{type:'text/csv;charset=utf-8'});" +
      "var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='antwoord-'+code+'.csv';a.click();" +
      "};box.appendChild(btn);" +
      "};</script></body></html>"
    );
  }

  function downloadLeerlingHtml(state, mode) {
    var pakket = buildPakket(state, mode);
    ensureCodes(pakket.students);
    // sync codes back — caller should save students
    var safe = (state.className || "klas").replace(/\s+/g, "-");
    downloadText(
      "sociogram-invullen-" + safe + ".html",
      buildLeerlingHtml(pakket),
      "text/html;charset=utf-8"
    );
    downloadText(
      "DOCENT-GEHEIM-codes-" + safe + ".csv",
      buildDocentKeyCsv(pakket.students, state.className),
      "text/csv;charset=utf-8"
    );
    return pakket.students;
  }

  function importAnswerCsv(text, state) {
    // Supports: Code;Naam;VraagId;Vraag;KeuzeNr;Gekozen  OR classic Forms CSV via FormsExcel
    var lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return { ok: false, warnings: ["Leeg CSV-bestand"] };
    }
    var sep = lines[0].indexOf(";") !== -1 ? ";" : ",";
    function splitLine(line) {
      var out = [];
      var cur = "";
      var q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
            continue;
          }
          if (ch === '"') {
            q = false;
            continue;
          }
          cur += ch;
          continue;
        }
        if (ch === '"') {
          q = true;
          continue;
        }
        if (ch === sep) {
          out.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      out.push(cur);
      return out;
    }

    var headers = splitLine(lines[0]).map(function (h) {
      return h.trim().toLowerCase();
    });
    var idxCode = headers.indexOf("code");
    var idxName = headers.indexOf("naam") !== -1 ? headers.indexOf("naam") : headers.indexOf("name");
    var idxQid = headers.indexOf("vraagid");
    var idxQtext = headers.indexOf("vraag");
    var idxChosen = headers.indexOf("gekozen");

    if (idxCode === -1 || idxChosen === -1) {
      return null; // not our format — let caller try Forms import
    }

    ensureCodes(state.students);
    var byCode = {};
    state.students.forEach(function (s) {
      byCode[String(s.code).toUpperCase()] = s;
    });

    var nominations = Object.assign({}, state.nominations);
    Object.keys(nominations).forEach(function (k) {
      nominations[k] = Object.assign({}, nominations[k]);
    });
    var matchedIds = {};
    var warnings = [];
    var touched = {};

    for (var r = 1; r < lines.length; r++) {
      var cols = splitLine(lines[r]);
      var code = (cols[idxCode] || "").trim().toUpperCase();
      var student = byCode[code];
      if (!student && idxName !== -1) {
        student = findByName(state.students, cols[idxName]);
      }
      if (!student) {
        warnings.push("Rij " + (r + 1) + ": onbekende code " + code);
        continue;
      }
      var chosen = (cols[idxChosen] || "").trim();
      if (!chosen) continue;

      var q = null;
      if (idxQid !== -1) {
        var qid = cols[idxQid];
        for (var i = 0; i < state.questions.length; i++) {
          if (state.questions[i].id === qid) q = state.questions[i];
        }
      }
      if (!q && idxQtext !== -1) q = matchQuestionLocal(cols[idxQtext], state.questions);
      if (!q) continue;

      matchedIds[q.id] = true;
      if (!nominations[student.id]) nominations[student.id] = {};
      if (!nominations[student.id][q.id]) nominations[student.id][q.id] = [];
      var other = findByName(state.students, chosen);
      if (other && other.id !== student.id) {
        if (nominations[student.id][q.id].indexOf(other.id) === -1) {
          nominations[student.id][q.id].push(other.id);
        }
      } else if (!other) {
        warnings.push(student.name + ": onbekende naam " + chosen);
      }
      touched[student.id] = true;
    }

    return {
      ok: Object.keys(touched).length > 0,
      imported: Object.keys(touched).length,
      warnings: warnings,
      nominations: nominations,
      students: state.students,
      matchedQuestionIds: Object.keys(matchedIds),
      matchedQuestions: state.questions
        .filter(function (q) {
          return matchedIds[q.id];
        })
        .map(function (q) {
          return q.label;
        }),
      studentsAdded: 0,
    };
  }

  return {
    ensureCodes: ensureCodes,
    downloadExcelPack: downloadExcelPack,
    downloadLeerlingHtml: downloadLeerlingHtml,
    importWorkbookXml: importWorkbookXml,
    importAnswerCsv: importAnswerCsv,
    buildPakket: buildPakket,
  };
})();
