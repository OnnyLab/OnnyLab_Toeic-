/* =========================================================
   ONNYLAB — SHARED ADMIN SIDEBAR V2
========================================================= */

function getCurrentPage() {
  const fileName =
    window.location.pathname
      .split("/")
      .pop()
      .toLowerCase();

  if (
    fileName === "" ||
    fileName === "index.html"
  ) {
    return "dashboard";
  }

  const pageMap = {
    "vocabulary.html": "vocabulary",
    "grammar.html": "grammar",
    "users.html": "users",
    "settings.html": "settings",
    "data.html": "data"
  };

  return pageMap[fileName] || "";
}


function navClass(page) {
  return (
    getCurrentPage() === page
      ? "admin-nav-item active"
      : "admin-nav-item"
  );
}


function createNavItem({
  page,
  href,
  icon,
  label,
  mobilePrimary = false
}) {
  const classes = [
    navClass(page),
    mobilePrimary
      ? "admin-mobile-primary"
      : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <a
      href="${href}"
      class="${classes}"
    >
      <span class="admin-nav-icon">
        ${icon}
      </span>
      <span class="admin-nav-label">
        ${label}
      </span>
    </a>
  `;
}


function createSidebar() {
  return `
    <a
      href="./index.html"
      class="admin-brand-v2"
      aria-label="Onnylab Admin Home"
    >
      <img
        src="../assets/brand/logo.png"
        alt="Onnylab"
        class="admin-brand-v2-logo"
      >
      <div class="admin-brand-v2-copy">
        <strong>Onnylab</strong>
        <span>ADMIN CONSOLE</span>
      </div>
    </a>

    <div class="admin-profile-v2">
      <div
        id="adminAvatar"
        class="admin-avatar-v2"
      >
        A
      </div>

      <div class="admin-profile-v2-copy">
        <span>Administrator</span>
        <strong id="adminName">
          Loading...
        </strong>
        <small id="adminEmail"></small>
      </div>
    </div>

    <nav class="admin-nav-v2">

      <div class="admin-nav-group">
        <span class="admin-nav-group-label">
          OVERVIEW
        </span>

        ${createNavItem({
          page: "dashboard",
          href: "./index.html",
          icon: "▦",
          label: "Dashboard",
          mobilePrimary: true
        })}
      </div>

      <div class="admin-nav-group">
        <span class="admin-nav-group-label">
          CONTENT
        </span>

        ${createNavItem({
          page: "vocabulary",
          href: "./vocabulary.html",
          icon: "Aa",
          label: "Vocabulary",
          mobilePrimary: true
        })}

        ${createNavItem({
          page: "grammar",
          href: "./grammar.html",
          icon: "Gr",
          label: "Grammar",
          mobilePrimary: true
        })}
      </div>

      <div class="admin-nav-group">
        <span class="admin-nav-group-label">
          MANAGEMENT
        </span>

        ${createNavItem({
          page: "users",
          href: "./users.html",
          icon: "◎",
          label: "User Management",
          mobilePrimary: true
        })}
      </div>

      <div class="admin-nav-group">
        <span class="admin-nav-group-label">
          SYSTEM
        </span>

        ${createNavItem({
          page: "settings",
          href: "./settings.html?v=20261001-6",
          icon: "⚙",
          label: "Game Settings"
        })}

        ${createNavItem({
          page: "data",
          href: "./data.html",
          icon: "⇅",
          label: "Data Management"
        })}
      </div>

    </nav>

    <button
      id="adminMobileMoreBtn"
      class="admin-mobile-more ${["settings","data"].includes(getCurrentPage()) ? "is-current-system" : ""}"
      type="button"
      aria-expanded="false"
      aria-controls="adminMobileMoreMenu"
    >
      <span class="admin-nav-icon">•••</span>
      <span class="admin-nav-label">More</span>
    </button>

    <div
      id="adminMobileMoreMenu"
      class="admin-mobile-more-menu"
      aria-hidden="true"
    >
      <a href="./settings.html?v=20261001-6">⚙ <span>Game Settings</span></a>
      <a href="./data.html">⇅ <span>Data Management</span></a>
      <a href="../user/dashboard.html">↗ <span>Open User App</span></a>
      <button id="adminMobileLogoutBtn" class="danger" type="button">
        ⇥ <span>Log out</span>
      </button>
    </div>

    <div class="admin-sidebar-bottom-v2">
      <a
        href="../user/dashboard.html"
        class="admin-open-user-app"
      >
        <span>↗</span>
        <span>Open User App</span>
      </a>

      <button
        id="logoutBtn"
        class="admin-logout-v2"
        type="button"
      >
        <span>⇥</span>
        <span>Log out</span>
      </button>
    </div>
  `;
}


function renderSidebar() {
  const sidebar =
    document.getElementById(
      "adminSidebar"
    );

  if (!sidebar) {
    console.warn(
      "ไม่พบ #adminSidebar"
    );
    return;
  }

  sidebar.innerHTML =
    createSidebar();

  bindMobileMore();
}


function bindMobileMore() {
  const button =
    document.getElementById(
      "adminMobileMoreBtn"
    );

  const menu =
    document.getElementById(
      "adminMobileMoreMenu"
    );

  if (!button || !menu) {
    return;
  }

  const closeMenu = () => {
    menu.classList.remove("show");
    button.setAttribute(
      "aria-expanded",
      "false"
    );
    menu.setAttribute(
      "aria-hidden",
      "true"
    );
  };

  button.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();

      const open =
        !menu.classList.contains(
          "show"
        );

      menu.classList.toggle(
        "show",
        open
      );

      button.setAttribute(
        "aria-expanded",
        String(open)
      );

      menu.setAttribute(
        "aria-hidden",
        String(!open)
      );
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        !menu.contains(event.target) &&
        event.target !== button
      ) {
        closeMenu();
      }
    }
  );

  document
    .getElementById(
      "adminMobileLogoutBtn"
    )
    ?.addEventListener(
      "click",
      () => {
        document
          .getElementById("logoutBtn")
          ?.click();
      }
    );
}


renderSidebar();


function setupAdminLiveRegions() {
  [
    "dataMessage",
    "settingsMessage",
    "userMessage",
    "grammarImportMessage",
    "vocabImportMessage"
  ].forEach((id) => {
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
}

setupAdminLiveRegions();


function syncAdminMobileMoreVisibility() {
  const button =
    document.getElementById("adminMobileMoreBtn");
  const menu =
    document.getElementById("adminMobileMoreMenu");

  if (!button || !menu) {
    return;
  }

  const isMobile =
    window.matchMedia("(max-width: 700px)").matches;

  if (!isMobile) {
    button.style.setProperty("display", "none", "important");
    button.style.setProperty("visibility", "hidden", "important");
    menu.style.setProperty("display", "none", "important");
    menu.style.setProperty("visibility", "hidden", "important");
    menu.classList.remove("show");
    button.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    return;
  }

  button.style.removeProperty("display");
  button.style.removeProperty("visibility");
  menu.style.removeProperty("display");
  menu.style.removeProperty("visibility");
}

syncAdminMobileMoreVisibility();

window.addEventListener(
  "resize",
  syncAdminMobileMoreVisibility
);


/* =========================================================
   CANONICAL ADMIN SIDEBAR DIMENSIONS
   Runtime lock so page-specific CSS cannot resize it.
========================================================= */
function syncAdminSidebarDimensions() {
  const sidebar =
    document.getElementById("adminSidebar");

  const main =
    document.querySelector(".admin-main");

  if (!sidebar || !main) {
    return;
  }

  const mobile =
    window.matchMedia("(max-width: 700px)").matches;

  if (mobile) {
    sidebar.style.setProperty("position", "fixed", "important");
    sidebar.style.setProperty("top", "auto", "important");
    sidebar.style.setProperty("left", "0", "important");
    sidebar.style.setProperty("right", "0", "important");
    sidebar.style.setProperty("bottom", "0", "important");
    sidebar.style.setProperty("width", "100%", "important");
    sidebar.style.setProperty("min-width", "100%", "important");
    sidebar.style.setProperty("max-width", "100%", "important");
    sidebar.style.setProperty("height", "72px", "important");
    sidebar.style.setProperty("min-height", "72px", "important");
    sidebar.style.setProperty("box-sizing", "border-box", "important");

    main.style.setProperty("margin-left", "0", "important");
    main.style.setProperty("width", "100%", "important");
    return;
  }

  sidebar.style.setProperty("position", "fixed", "important");
  sidebar.style.setProperty("top", "0", "important");
  sidebar.style.setProperty("left", "0", "important");
  sidebar.style.setProperty("right", "auto", "important");
  sidebar.style.setProperty("bottom", "0", "important");
  sidebar.style.setProperty("width", "236px", "important");
  sidebar.style.setProperty("min-width", "236px", "important");
  sidebar.style.setProperty("max-width", "236px", "important");
  sidebar.style.setProperty("height", "100vh", "important");
  sidebar.style.setProperty("min-height", "100vh", "important");
  sidebar.style.setProperty("box-sizing", "border-box", "important");
  sidebar.style.setProperty("flex", "0 0 236px", "important");

  main.style.setProperty("margin-left", "236px", "important");
  main.style.setProperty("width", "auto", "important");
  main.style.setProperty("min-width", "0", "important");
}

syncAdminSidebarDimensions();

window.addEventListener(
  "resize",
  syncAdminSidebarDimensions
);
