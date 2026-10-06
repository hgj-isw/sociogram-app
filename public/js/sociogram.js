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

  function draw(svg, students, edgeList) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var width = 900;
    var height = 560;
    var nodes = layoutNodes(students, width, height);
    var byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });
    var ns = "http://www.w3.org/2000/svg";

    edgeList.forEach(function (e) {
      var a = byId[e.from];
      var b = byId[e.to];
      if (!a || !b) return;
      var line = document.createElementNS(ns, "line");
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var inset = 28;
      line.setAttribute("x1", a.x + (dx / len) * inset);
      line.setAttribute("y1", a.y + (dy / len) * inset);
      line.setAttribute("x2", b.x - (dx / len) * inset);
      line.setAttribute("y2", b.y - (dy / len) * inset);
      line.setAttribute("stroke", e.polarity === "negative" ? "#a85a3a" : "#2f6f4e");
      line.setAttribute("stroke-width", e.mutual ? "3.2" : "1.6");
      line.setAttribute("stroke-opacity", "0.85");
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
      g.appendChild(circle);
      var text = document.createElementNS(ns, "text");
      text.setAttribute("x", n.x);
      text.setAttribute("y", n.y + 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "11");
      text.setAttribute("fill", "#1c2a24");
      text.textContent = n.name.length > 10 ? n.name.slice(0, 9) + "…" : n.name;
      g.appendChild(text);
      svg.appendChild(g);
    });
  }

  return { draw: draw };
})();
