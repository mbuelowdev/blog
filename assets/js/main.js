(function () {
  var toggle = document.getElementById('nav-toggle');
  var sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    sidebar.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        sidebar.classList.remove('open');
      });
    });
  }

  // Dynamic ?cat= view: fetch .md and render ls + cat block
  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getPromptFromPathname() {
    var pathname = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '') || '';
    var segments = pathname.split('/').filter(Boolean);
    var segment = segments.length ? segments[segments.length - 1] : '';
    return segment ? 'mbuelow@dev:~/' + segment + '$ ' : 'mbuelow@dev:~$ ';
  }

  function parseFrontMatter(text) {
    var match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: text };
    var meta = {};
    match[1].split('\n').forEach(function (line) {
      var colon = line.indexOf(':');
      if (colon > 0) {
        meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
      }
    });
    return { meta: meta, body: match[2] };
  }

  function formatLsDate(d) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var m = months[d.getMonth()];
    var day = String(d.getDate()).padStart(2, ' ');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return m + ' ' + day + ' ' + h + ':' + min;
  }

  function renderCatBlock(prompt, filename, content, size, mtime) {
    var errHtml = '<div class="home-terminal">\n<pre class="home-terminal-session"><span class="home-terminal-prompt">' + prompt + '</span>ls -al ' + escapeHtml(filename) + '\nls: cannot access \'' + escapeHtml(filename) + '\': No such file or directory\n<span class="home-terminal-prompt">' + prompt + '</span><span class="home-terminal-cursor"></span></pre>\n</div>';
    if (!content) return errHtml;
    var lsLine = size != null && mtime != null
      ? '-rw-r--r--  1 mbuelow mbuelow ' + String(size).padStart(5) + ' ' + formatLsDate(mtime) + ' <a href="?cat=' + escapeHtml(filename) + '" class="home-terminal-file-link">' + escapeHtml(filename) + '</a>'
      : null;
    var body = escapeHtml(content);
    var middle = lsLine != null
      ? lsLine + '\n<span class="home-terminal-prompt">' + prompt + '</span>cat ' + escapeHtml(filename) + '\n' + body
      : '<span class="home-terminal-prompt">' + prompt + '</span>cat ' + escapeHtml(filename) + '\n' + body;
    return '<div class="home-terminal">\n<pre class="home-terminal-session"><span class="home-terminal-prompt">' + prompt + '</span>ls -al ' + escapeHtml(filename) + '\n' + middle + '\n<span class="home-terminal-prompt">' + prompt + '</span><span class="home-terminal-cursor"></span></pre>\n</div>';
  }

  var params = new URLSearchParams(window.location.search);
  var catFile = params.get('cat');
  if (catFile) {
    var prompt = getPromptFromPathname();
    var container = document.querySelector('.content');
    fetch(catFile)
      .then(function (res) {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(function (text) {
        var parsed = parseFrontMatter(text);
        var title = parsed.meta.title || catFile.replace(/\.md$/, '');
        if (document.title.indexOf('|') > -1) {
          document.title = title + ' | mbuelow.dev';
        }
        var size = new Blob([text]).size;
        var mtime = new Date();
        var block = renderCatBlock(prompt, catFile, parsed.body, size, mtime);
        if (container) {
          container.innerHTML = block;
        }
      })
      .catch(function () {
        var block = renderCatBlock(prompt, catFile, null);
        if (container) {
          container.innerHTML = block;
        }
      });
  }
})();
