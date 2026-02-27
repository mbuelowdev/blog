(function () {
  var toggle = document.getElementById('nav-toggle');
  var sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('open');
  });

  // Close drawer when a nav link is clicked (mobile)
  sidebar.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      sidebar.classList.remove('open');
    });
  });
})();
