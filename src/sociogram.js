window.SociogramViz = (function () {
  function layoutNodes(students, width, height) {
    var n = students.length;
    var cx = width / 2;
    var cy = height / 2;
    var radius = Math.min(width, height) * 0.38;
    return students.map(function (s, i) {
      var angle = (Math.PI * 2 * i) / Math.max(n, 1) - Math.PI / 2;
      return {
        id: s.id,
        name: s.name,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }

  function edgeKey(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }

  function buildEdges(students, nominations, questions, questionFilterId) {
    var active = questions.filter(function (q) {
      if (!q.enabled) return false;
      if (questionFilterId && questionFilterId !== "all" && q.id !== questionFilterId) {
        return false;
      }
      return true;
    });

    var edges = [];
    var seen = {};

    active.forEach(function (q) {
      students.forEach(function (from) {
        var answers = (nominations[from.id] && nominations[from.id][q.id]) || [];
        answers.forEach(function (toId) {
          if (!toId || toId === from.id) return;
          var key = from.id + ">" + toId + ">" + q.id;
          if (seen[key]) return;
          seen[key] = true;

          var reverse =
            (nominations[toId] &&
              nominations[toId][q.id] &&
              nominations[toId][q.id].indexOf(from.id) !== -1) ||
            false;

          edges.push({
            from: from.id,
            to: toId,
            questionId: q.id,
            polarity: q.polarity,
            mutual: reverse,
          });
        });
      });
    });

    return edges;
  }

  function computeSignals(students, nominations, questions) {
    var active = questions.filter(function (q) {
      return q.enabled;
    });
    var posQs = active.filter(function (q) {
      return q.polarity === "positive";
    });
    var receivedPos = {};
    var givenPos = {};

    students.forEach(function (s) {
      receivedPos[s.id] = 0;
      givenPos[s.id] = 0;
    });

    posQs.forEach(function (q) {
      students.forEach(function (from) {
        var answers = (nominations[from.id] && nominations[from.id][q.id]) || [];
        givenPos[from.id] += answers.length;
        answers.forEach(function (toId) {
          if (receivedPos[toId] !== undefined) receivedPos[toId] += 1;
        });
      });
    });

    var littleNamed = students
      .filter(function (s) {
        return receivedPos[s.id] === 0 && posQs.length > 0;
      })
      .map(function (s) {
        return s.name;
      });

    var mostNamed = students
      .slice()
      .sort(function (a, b) {
        return receivedPos[b.id] - receivedPos[a.id];
      })
      .filter(function (s) {
        return receivedPos[s.id] > 0;
      })
      .slice(0, 3)
      .map(function (s) {
        return s.name + " (" + receivedPos[s.id] + ")";
      });

    return {
      littleNamed: littleNamed,
      mostNamed: mostNamed,
      activeCount: active.length,
    };
  }

  function draw(svg, students, nominations, questions, questionFilterId) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var width = 900;
    var height = 560;
    var nodes = layoutNodes(students, width, height);
    var byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });

    var edges = buildEdges(students, nominations, questions, questionFilterId);
    var ns = "http://www.w3.org/2000/svg";

    var defs = document.createElementNS(ns, "defs");
    ["pos", "neg"].forEach(function (kind) {
      var marker = document.createElementNS(ns, "marker");
      marker.setAttribute("id", "arrow-" + kind);
      marker.setAttribute("markerWidth", "8");
      marker.setAttribute("markerHeight", "8");
      marker.setAttribute("refX", "6");
      marker.setAttribute("refY", "3");
      marker.setAttribute("orient", "auto");
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M0,0 L6,3 L0,6 Z");
      path.setAttribute("fill", kind === "pos" ? "#2f6f4e" : "#a85a3a");
      marker.appendChild(path);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    edges.forEach(function (e) {
      var a = byId[e.from];
      var b = byId[e.to];
      if (!a || !b) return;
      var line = document.createElementNS(ns, "line");
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var inset = 28;
      var x1 = a.x + (dx / len) * inset;
      var y1 = a.y + (dy / len) * inset;
      var x2 = b.x - (dx / len) * inset;
      var y2 = b.y - (dy / len) * inset;
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute(
        "stroke",
        e.polarity === "positive" ? "#2f6f4e" : "#a85a3a"
      );
      line.setAttribute("stroke-width", e.mutual ? "3.2" : "1.6");
      line.setAttribute("stroke-opacity", "0.85");
      line.setAttribute(
        "marker-end",
        e.polarity === "positive" ? "url(#arrow-pos)" : "url(#arrow-neg)"
      );
      svg.appendChild(line);
    });

    nodes.forEach(function (n) {
      var g = document.createElementNS(ns, "g");
      var circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", n.x);
      circle.setAttribute("cy", n.y);
      circle.setAttribute("r", "22");
      circle.setAttribute("fill", "#f3efe6");
      circle.setAttribute("stroke", "#1c2a24");
      circle.setAttribute("stroke-width", "1.5");
      g.appendChild(circle);

      var text = document.createElementNS(ns, "text");
      text.setAttribute("x", n.x);
      text.setAttribute("y", n.y + 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-family", "Source Sans 3, sans-serif");
      text.setAttribute("fill", "#1c2a24");
      var shortName = n.name.length > 10 ? n.name.slice(0, 9) + "…" : n.name;
      text.textContent = shortName;
      g.appendChild(text);
      svg.appendChild(g);
    });

    if (!students.length) {
      var empty = document.createElementNS(ns, "text");
      empty.setAttribute("x", width / 2);
      empty.setAttribute("y", height / 2);
      empty.setAttribute("text-anchor", "middle");
      empty.setAttribute("fill", "#5c6b63");
      empty.setAttribute("font-size", "16");
      empty.textContent = "Voeg eerst leerlingen toe onder Klas.";
      svg.appendChild(empty);
    }

    return computeSignals(students, nominations, questions);
  }

  return { draw: draw, computeSignals: computeSignals, edgeKey: edgeKey };
})();
