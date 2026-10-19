import {
  requireUserPage,
  logoutUser
} from "../core/auth.js";


import {
  getWordStatsCloud,
  getGameHistoryCloud
} from "../core/cloud-data.js";


/* =========================================================
   VOCAB ONNY
   USER DATA

   Phase 3
========================================================= */


/* =========================================================
   AUTH SESSION
========================================================= */

export async function getSessionCompat() {

  const context =
    await requireUserPage(
      {
        loginPath:
          "../index.html",

        adminPath:
          "../admin/index.html"
      }
    );


  if (
    !context
  ) {

    return null;

  }


  const {
    user,
    profile,
    role
  } =
    context;


  const name =

    profile?.displayName ||

    user.displayName ||

    user.email
      ?.split("@")[0] ||

    "Player";


  return {

    isLoggedIn:
      true,

    uid:
      user.uid,

    email:
      user.email || "",

    name,

    displayName:
      name,

    role,

    status:
      profile?.status ||
      "active",

    profile

  };

}


export async function waitForSession() {

  return await getSessionCompat();

}


export async function logoutCompat() {

  return await logoutUser();

}


/* =========================================================
   LEARNING DATA — CLOUD ONLY
   Firestore is the single source of truth.
========================================================= */

export async function readWordStats() {

  const session =
    await getSessionCompat();


  if (
    !session?.uid
  ) {

    return {};

  }


  const uid =
    session.uid;


  try {

    const cloudStats =
      await getWordStatsCloud(
        uid
      );


    if (
      !cloudStats ||
      typeof cloudStats !== "object" ||
      Array.isArray(cloudStats)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(cloudStats)
        .filter(function ([, stat]) {
          return (
            stat?.kind !== "grammar"
          );
        })
    );

  } catch (error) {

    console.warn("Could not read Word Stats from Firestore:", error);
    return {};

  }

}


export async function readGameHistory() {

  const session =
    await getSessionCompat();


  if (
    !session?.uid
  ) {

    return [];

  }


  const uid =
    session.uid;


  try {

    const cloudHistory =
      await getGameHistoryCloud(
        uid,
        {
          maxItems: 500
        }
      );


    return Array.isArray(
      cloudHistory
    )
      ? cloudHistory
      : [];

  } catch (error) {

    console.warn("Could not read Game History from Firestore:", error);
    return [];

  }

}


/* =========================================================
   NUMBER HELPERS
========================================================= */

export function toNumber(
  value
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


export function clamp(
  value,
  min = 0,
  max = 100
) {

  return Math.min(

    Math.max(
      toNumber(
        value
      ),
      min
    ),

    max

  );

}


/* =========================================================
   WORD STATS
========================================================= */

export function getWordAttempts(
  stat
) {

  const direct =
    toNumber(
      stat?.attempts
    );


  if (
    direct > 0
  ) {

    return direct;

  }


  return (

    toNumber(
      stat?.translationAttempts
    )

    +

    toNumber(
      stat?.meaningAttempts
    )

    +

    toNumber(
      stat?.synonymAttempts
    )

    +

    toNumber(
      stat?.weakAttempts
    )

  );

}


export function getWordCorrect(
  stat
) {

  if (
    stat?.correct !==
    undefined
  ) {

    return toNumber(
      stat.correct
    );

  }


  return (

    toNumber(
      stat?.translationCorrect
    )

    +

    toNumber(
      stat?.meaningCorrect
    )

    +

    toNumber(
      stat?.synonymCorrect
    )

    +

    toNumber(
      stat?.weakCorrect
    )

  );

}


export function getWordWrong(
  stat
) {

  return toNumber(
    stat?.wrong
  );

}


export function getWordTimeout(
  stat
) {

  return toNumber(
    stat?.timeout
  );

}


export function getWordAccuracy(
  stat
) {

  if (
    stat?.accuracy !==
    undefined &&
    stat?.accuracy !==
    null
  ) {

    return clamp(
      Math.round(
        toNumber(
          stat.accuracy
        )
      )
    );

  }


  const attempts =
    getWordAttempts(
      stat
    );


  if (
    attempts <= 0
  ) {

    return 0;

  }


  return clamp(
    Math.round(
      (
        getWordCorrect(
          stat
        )
        /
        attempts
      )
      *
      100
    )
  );

}


/* =========================================================
   STATUS
========================================================= */

export function getWordStatus(
  stat
) {

  const attempts =
    getWordAttempts(
      stat
    );


  const accuracy =
    getWordAccuracy(
      stat
    );


  const mistakes =

    getWordWrong(
      stat
    )

    +

    getWordTimeout(
      stat
    );


  if (
    attempts <= 0
  ) {

    return "new";

  }


  if (
    attempts >= 5 &&
    accuracy >= 90
  ) {

    return "mastered";

  }


  if (
    attempts >= 3 &&
    (
      accuracy < 60 ||
      mistakes >= 3
    )
  ) {

    return "weak";

  }


  if (
    accuracy >= 75
  ) {

    return "familiar";

  }


  return "learning";

}


/* =========================================================
   WEAK WORD
========================================================= */

export function isWeakWord(
  stat
) {

  if (
    getWordStatus(
      stat
    ) ===
    "weak"
  ) {

    return true;

  }


  const attempts =
    getWordAttempts(
      stat
    );


  const mistakes =

    getWordWrong(
      stat
    )

    +

    getWordTimeout(
      stat
    );


  const accuracy =
    getWordAccuracy(
      stat
    );


  return (

    attempts >= 2 &&

    mistakes >= 2 &&

    accuracy < 70

  );

}


/* =========================================================
   NORMALIZE WORD
========================================================= */

export function normalizeWordEntry(
  id,
  stat = {}
) {

  return {

    id,

    ...stat,

    word:
      stat.word ||
      stat.english ||
      stat.term ||
      id,

    thai:
      stat.thai ||
      stat.translation ||
      stat.thaiMeaning ||
      "-",

    meaning:
      stat.meaning ||
      stat.definition ||
      "",

    attempts:
      getWordAttempts(
        stat
      ),

    correct:
      getWordCorrect(
        stat
      ),

    wrong:
      getWordWrong(
        stat
      ),

    timeout:
      getWordTimeout(
        stat
      ),

    accuracy:
      getWordAccuracy(
        stat
      ),

    status:
      getWordStatus(
        stat
      )

  };

}


/* =========================================================
   HISTORY
========================================================= */

export function getHistoryTimestamp(
  game = {}
) {

  const raw =

    game.completedAt ||

    game.date ||

    game.createdAt ||

    game.timestamp;


  if (
    !raw
  ) {

    return 0;

  }


  if (
    typeof raw ===
    "number"
  ) {

    return raw;

  }


  if (
    raw?.seconds
  ) {

    return raw.seconds *
      1000;

  }


  if (
    typeof raw?.toDate ===
    "function"
  ) {

    return raw
      .toDate()
      .getTime();

  }


  const timestamp =
    new Date(
      raw
    ).getTime();


  return Number.isNaN(
    timestamp
  )
    ? 0
    : timestamp;

}


export function getGameAccuracy(
  game = {}
) {

  if (
    game.accuracy !==
    undefined &&
    game.accuracy !==
    null
  ) {

    return clamp(
      Math.round(
        toNumber(
          game.accuracy
        )
      )
    );

  }


  const total =

    toNumber(
      game.totalQuestions
    )

    ||

    (
      toNumber(
        game.correct
      )

      +

      toNumber(
        game.wrong
      )

      +

      toNumber(
        game.timeout
      )
    );


  if (
    total <= 0
  ) {

    return 0;

  }


  return clamp(
    Math.round(
      (
        toNumber(
          game.correct
        )
        /
        total
      )
      *
      100
    )
  );

}


/* =========================================================
   DISPLAY
========================================================= */

export function formatModeName(
  mode
) {

  const map = {

    translation:
      "Translation",

    meaning:
      "Meaning",

    synonym:
      "Synonym",

    weak:
      "Weak Words",

    "grammar-part5":
      "Grammar · TOEIC Part 5",

    "grammar-tenses":
      "Grammar · TOEIC Part 5",

    "grammar-fill":
      "Grammar · Fill Blank",

    "grammar-error":
      "Grammar · Error Detection",

    "grammar-sentence":
      "Grammar · Sentence Building"

  };


  return (

    map[
      String(
        mode || ""
      )
        .toLowerCase()
    ]

    ||

    "Practice"

  );

}


export function formatDateTime(
  game
) {

  const timestamp =
    getHistoryTimestamp(
      game
    );


  if (
    !timestamp
  ) {

    return "Recent";

  }


  return new Date(
    timestamp
  )
    .toLocaleString(
      "th-TH",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    );

}


/* =========================================================
   SECURITY
========================================================= */

export function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   UI
========================================================= */

export function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (
    element
  ) {

    element.textContent =
      value;

  }

}


export function renderPlayerBasics(
  session
) {

  if (
    !session
  ) {

    return;

  }


  const name =
    session.name ||
    "Player";


  const email =
    session.email ||
    "";


  const initial =

    name
      .charAt(0)
      .toUpperCase()

    ||

    "P";


  [
    "playerName",
    "sidebarPlayerName",
    "profileName",
    "heroPlayerName"
  ]
    .forEach(
      function (
        id
      ) {

        setText(
          id,
          name
        );

      }
    );


  [
    "sidebarUserEmail",
    "profileEmail",
    "heroEmail"
  ]
    .forEach(
      function (
        id
      ) {

        setText(
          id,
          email
        );

      }
    );


  [
    "sidebarAvatarInitial",
    "mobileAvatarInitial",
    "profileAvatarInitial"
  ]
    .forEach(
      function (
        id
      ) {

        setText(
          id,
          initial
        );

      }
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

export function setupCommonNavigation(
  {
    activePage
  } = {}
) {

  const routes = {

    gamesBtn:
      "./practice.html",

    dashboardBtn:
      "./dashboard.html",

    weakWordsBtn:
      "./review.html",

    historyBtn:
      "./history.html",

    profileButton:
      "./profile.html",

    profileCardButton:
      "./profile.html",

    mobileProfileButton:
      "./profile.html",

    quickProfileBtn:
      "./profile.html",

    quickDashboardBtn:
      "./dashboard.html",

    quickHistoryBtn:
      "./history.html"

  };


  Object.entries(
    routes
  )
    .forEach(
      function (
        [
          id,
          href
        ]
      ) {

        document
          .getElementById(
            id
          )
          ?.addEventListener(
            "click",
            function () {

              window.location.href =
                href;

            }
          );

      }
    );


  const activeId = {

    games:
      "gamesBtn",

    dashboard:
      "dashboardBtn",

    weak:
      "weakWordsBtn",

    history:
      "historyBtn",

    profile:
      "profileButton"

  }[
    activePage
  ];


  if (
    activeId
  ) {

    document
      .getElementById(
        activeId
      )
      ?.classList
      .add(
        "active"
      );

  }


  document
    .getElementById(
      "logoutBtn"
    )
    ?.addEventListener(
      "click",
      async function () {

        const result =
          await logoutUser();


        if (
          result.success
        ) {

          window.location.replace(
            "../index.html"
          );

        }

      }
    );

  document
    .querySelectorAll("[data-coming-soon]")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        showSidebarFeatureToast(
          button.dataset.comingSoon || "Feature"
        );
      });
    });

  document
    .querySelectorAll("[data-dashboard-anchor]")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        const anchor =
          button.dataset.dashboardAnchor || "";

        window.location.href =
          "./dashboard.html#" + encodeURIComponent(anchor);
      });
    });

}

function showSidebarFeatureToast(featureName) {

  let toast =
    document.getElementById("sidebarFeatureToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sidebarFeatureToast";
    toast.className = "sidebar-feature-toast";
    document.body.appendChild(toast);
  }

  toast.textContent =
    featureName + " กำลังเตรียมอยู่ ✨";

  toast.classList.add("show");

  window.clearTimeout(
    showSidebarFeatureToast.timer
  );

  showSidebarFeatureToast.timer =
    window.setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
}
