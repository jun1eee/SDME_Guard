// Neo4j 그래프 시각화 (vis.js)
(function() {
  var _d = JSON.parse(document.getElementById('graph-data').textContent);
  var matched = _d.matched || [];
  var rawN = _d.nodes || [], rawE = _d.edges || [];

  var cMap = {vendor:'#e94560',region:'#3498db',district:'#00bcd4',tag:'#2ecc71',style:'#9b59b6',review:'#f39c12','package':'#1abc9c'};
  var sMap = {vendor:'dot',region:'diamond',district:'diamond',tag:'dot',style:'triangle',review:'square','package':'star'};
  var gLabel = {vendor:'업체',region:'지역',district:'동',tag:'태그',style:'스타일',review:'리뷰','package':'패키지'};

  function isM(l) {
    for (var i = 0; i < matched.length; i++) {
      if (l.indexOf(matched[i]) >= 0) return true;
    }
    return false;
  }

  var vn = rawN.map(function(n) {
    var g = n.group || 'tag', m = isM(n.label), sz = g === 'vendor' ? 35 : (m ? 20 : 13);
    return {
      id: n.id, label: n.label, group: g,
      color: {
        background: cMap[g] || '#95a5a6',
        border: m ? '#ff6b6b' : (cMap[g] || '#95a5a6'),
        highlight: {background: '#ff6b6b', border: '#ff0000'},
        hover: {background: cMap[g] || '#95a5a6', border: '#fff'}
      },
      shape: sMap[g] || 'dot', size: sz,
      borderWidth: m ? 4 : (g === 'vendor' ? 3 : 1),
      font: {size: g === 'vendor' ? 16 : (m ? 14 : 11), color: '#eee', strokeWidth: 3, strokeColor: '#1a1a2e'},
      shadow: m ? {enabled: true, color: '#ff6b6b', size: 15, x: 0, y: 0} : false,
      title: n.title || n.label, _g: g, _m: m
    };
  });

  var ve = rawE.map(function(e) {
    return {
      from: e.from, to: e.to, label: e.label || '', dashes: e.dashes || false,
      font: {size: 9, color: '#555', strokeWidth: 0},
      arrows: {to: {enabled: true, scaleFactor: 0.5}},
      color: {color: '#333', highlight: '#e94560', hover: '#666'},
      smooth: {type: 'continuous'}
    };
  });

  var nodes = new vis.DataSet(vn), edges = new vis.DataSet(ve);
  var net = new vis.Network(document.getElementById('graph'), {nodes: nodes, edges: edges}, {
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {gravitationalConstant: -50, centralGravity: 0.008, springLength: 140},
      stabilization: {iterations: 150}
    },
    interaction: {hover: true, tooltipDelay: 100, zoomView: true, dragView: true, hideEdgesOnDrag: true, hideEdgesOnZoom: true},
    layout: {improvedLayout: true}
  });

  var allN = nodes.getIds(), allE = edges.getIds();

  // 호버: 연결 하이라이트
  net.on('hoverNode', function(p) {
    var h = p.node, cn = net.getConnectedNodes(h), ce = net.getConnectedEdges(h);
    cn.push(h);
    var nu = [];
    allN.forEach(function(id) {
      if (cn.indexOf(id) === -1) {
        nu.push({id: id, opacity: 0.1, font: {color: 'rgba(255,255,255,0.05)'}});
      } else {
        var n = nodes.get(id);
        nu.push({id: id, opacity: 1, font: {color: '#eee', size: n._g === 'vendor' ? 16 : 13, strokeWidth: 3, strokeColor: '#1a1a2e'}});
      }
    });
    nodes.update(nu);
    var eu = [];
    allE.forEach(function(id) {
      if (ce.indexOf(id) === -1) {
        eu.push({id: id, color: {color: 'rgba(50,50,50,0.05)'}, font: {color: 'transparent'}});
      } else {
        eu.push({id: id, color: {color: '#e94560'}, font: {color: '#e94560', size: 11}, width: 2.5});
      }
    });
    edges.update(eu);
  });

  net.on('blurNode', function() {
    var nu = [];
    allN.forEach(function(id) {
      var n = nodes.get(id);
      nu.push({id: id, opacity: 1, font: {color: '#eee', size: n._g === 'vendor' ? 16 : (n._m ? 14 : 11), strokeWidth: 3, strokeColor: '#1a1a2e'}});
    });
    nodes.update(nu);
    var eu = [];
    allE.forEach(function(id) {
      eu.push({id: id, color: {color: '#333'}, font: {color: '#555', size: 9}, width: 1});
    });
    edges.update(eu);
  });

  // 클릭: 상세 패널
  net.on('click', function(p) {
    if (p.nodes.length === 0) { closeDetail(); return; }
    var id = p.nodes[0], n = nodes.get(id);
    if (!n) return;

    var connNodes = net.getConnectedNodes(id);
    var connEdges = net.getConnectedEdges(id);

    var html = '';
    var badge = '<span class="group-badge" style="background:' + cMap[n._g] + '">' + gLabel[n._g] + '</span>';
    if (n._m) badge += ' <span style="color:#ff6b6b;font-size:14px">&#9733; 쿼리 매칭</span>';
    html += badge;
    html += '<h2>' + n.label + '</h2>';
    if (n.title && n.title !== n.label) html += '<div class="info-row">' + n.title + '</div>';

    html += '<div class="connections"><h3>연결 (' + connNodes.length + '개)</h3>';
    var grouped = {};
    connEdges.forEach(function(eid) {
      var e = edges.get(eid);
      var otherId = (e.from === id) ? e.to : e.from;
      var other = nodes.get(otherId);
      if (!other) return;
      var rel = e.label || 'CONNECTED';
      if (!grouped[rel]) grouped[rel] = [];
      grouped[rel].push(other);
    });

    for (var rel in grouped) {
      html += '<div style="margin-top:8px;color:#888;font-size:11px">' + rel + '</div>';
      grouped[rel].forEach(function(other) {
        var c = cMap[other._g] || '#888';
        html += '<div class="conn-item" onclick="focusNode(\'' + other.id + '\')">'
          + '<span class="dot" style="background:' + c + '"></span> ' + other.label + '</div>';
      });
    }
    html += '</div>';

    document.getElementById('detail-body').innerHTML = html;
    document.getElementById('detail').style.display = 'block';
    net.focus(id, {scale: 1.2, animation: true});
  });

  window.closeDetail = function() { document.getElementById('detail').style.display = 'none'; };
  window.focusNode = function(id) { net.focus(id, {scale: 1.5, animation: true}); net.selectNodes([id]); };
})();
