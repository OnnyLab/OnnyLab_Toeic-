/* =========================================================
   ONNYLAB — SHARED USER SIDEBAR
========================================================= */

(function () {
  function currentPage() {
    const file =
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    const map = {
      "dashboard.html": "dashboard",
      "practice.html": "practice",
      "review.html": "review",
      "history.html": "history",
      "profile.html": "profile"
    };

    return map[file] || "";
  }

  function activeClass(page) {
    return currentPage() === page
      ? "nav-item active"
      : "nav-item";
  }

  function navButton({
    id,
    page,
    icon,
    label
  }) {
    return `
      <button
        id="${id}"
        class="${activeClass(page)}"
        type="button"
      >
        <span class="nav-icon" aria-hidden="true">${icon}</span>
        <span>${label}</span>
      </button>
    `;
  }

  function markup() {
    return `
      <a
        href="./dashboard.html"
        class="sidebar-brand sidebar-brand-image"
        aria-label="OnnyLab Home"
      >
        <img
          src="../assets/brand/logo.png"
          alt="OnnyLab"
          class="sidebar-brand-logo-image"
        >
      </a>

      <button
        id="profileButton"
        class="sidebar-profile ${currentPage() === "profile" ? "is-current" : ""}"
        type="button"
        aria-label="Open profile"
      >
        <div class="sidebar-avatar">
          <span id="sidebarAvatarInitial">O</span>
        </div>

        <div class="sidebar-user">
          <strong id="sidebarPlayerName">Loading...</strong>
          <span id="sidebarUserEmail">Loading...</span>
        </div>

        <span class="profile-arrow" aria-hidden="true">›</span>
      </button>

      <nav class="sidebar-nav sidebar-nav-expanded" aria-label="Main navigation">
        <div class="sidebar-nav-group sidebar-nav-core">
          <p class="sidebar-nav-label">LEARN</p>

          ${navButton({
            id: "gamesBtn",
            page: "practice",
            icon: "▶",
            label: "Practice"
          })}

          ${navButton({
            id: "dashboardBtn",
            page: "dashboard",
            icon: "▦",
            label: "Dashboard"
          })}

          ${navButton({
            id: "weakWordsBtn",
            page: "review",
            icon: "⚡",
            label: "Review"
          })}
        </div>

        <div class="sidebar-nav-group">
          <p class="sidebar-nav-label">PROGRESS</p>

          ${navButton({
            id: "historyBtn",
            page: "history",
            icon: "◷",
            label: "History"
          })}
        </div>
      </nav>

      <button
        id="logoutBtn"
        class="logout-button"
        type="button"
      >
        <span aria-hidden="true">↪</span>
        <span>Log out</span>
      </button>
    `;
  }

  const sidebar =
    document.getElementById("userSidebar");

  if (!sidebar) {
    return;
  }

  sidebar.innerHTML = markup();
})();


/* Shared accessibility hooks for async UI states */
(function setupUserLiveRegions() {
  const ids = [
    "dashboardRecentEmpty",
    "profileMessage",
    "resultMessage",
    "gameMessage",
    "grammarFeedback"
  ];

  ids.forEach((id) => {
    const element =
      document.getElementById(id);

    if (!element) {
      return;
    }

    element.setAttribute(
      "role",
      "status"
    );

    element.setAttribute(
      "aria-live",
      "polite"
    );
  });
})();
