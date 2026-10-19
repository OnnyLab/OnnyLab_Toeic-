import {
  requireUserPage,
  logoutUser
} from "../core/auth.js";


import {
  getProfileDisplayName
} from "../core/user-service.js";

import {
  TOEIC_GRAMMAR_CHAPTERS,
  getGrammarChapter
} from "../core/grammar-curriculum.js";

import {
  db
} from "../core/firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


let practiceAvailabilityReady =
  false;

const practiceModeAvailability = {
  translation: true,
  meaning: true,
  synonym: true,
  weak: true,
  part5: true,
  fill: true,
  error: true,
  sentence: true
};

document.addEventListener(
  "DOMContentLoaded",
  initGames
);


/* =========================================================
   INIT
========================================================= */

async function initGames() {

  /*
    Bind Practice interactions immediately.
    Do not wait for Firebase auth/profile before
    allowing Vocabulary / Grammar selection.
  */
  setupPracticeHub();
  setupGameCards();

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

    return;

  }


  const {
    user,
    profile
  } =
    context;


  renderUser(
    user,
    profile
  );

  await loadPracticeModeAvailability();

  setupNavigation();

  setupLogout();

}


/* =========================================================
   USER UI
========================================================= */

function renderUser(
  user,
  profile
) {

  const name =
    getProfileDisplayName(
      profile,
      user
    );


  const email =
    user.email ||
    "";


  const initial =

    name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase()

    ||

    "U";


  setText(
    "playerName",
    name
  );


  setText(
    "sidebarPlayerName",
    name
  );


  setText(
    "profileName",
    name
  );


  setText(
    "sidebarUserEmail",
    email
  );


  setText(
    "profileEmail",
    email
  );


  setText(
    "sidebarAvatarInitial",
    initial
  );


  setText(
    "mobileAvatarInitial",
    initial
  );


  setText(
    "profileAvatarInitial",
    initial
  );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

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

    mobileProfileButton:
      "./profile.html",

    profileCardButton:
      "./profile.html",

    quickDashboardBtn:
      "./dashboard.html",

    quickHistoryBtn:
      "./history.html",

    quickProfileBtn:
      "./profile.html"

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

}


/* =========================================================
   GAME CARDS
========================================================= */

function setupGameCards() {

  document.addEventListener(
    "click",
    function (event) {

      const card =
        event.target.closest("[data-mode]");

      if (!card) {
        return;
      }

      openGame(
        card.dataset.mode
      );

    }
  );


  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key !== "Enter"
        && event.key !== " "
      ) {
        return;
      }

      const card =
        event.target.closest("[data-mode]");

      if (!card) {
        return;
      }

      event.preventDefault();

      openGame(
        card.dataset.mode
      );

    }
  );

}


function openGame(
  mode
) {

  const allowedModes = [

    "translation",

    "meaning",

    "synonym",

    "weak"

  ];


  if (
    !allowedModes.includes(
      mode
    )
  ) {

    return;

  }

  if (!practiceAvailabilityReady) {
    showPracticeToast(
      "กำลังโหลดการตั้งค่า Practice..."
    );
    return;
  }

  if (
    practiceModeAvailability[mode] ===
    false
  ) {
    showPracticeToast(
      "โหมดนี้ถูกปิดใช้งานชั่วคราว"
    );
    return;
  }


  /*
    Weak Words:
    ตอนนี้ให้เข้า Review Page ก่อน

    ตัว Weak Game จริง
    จะทำใน Phase 2 / 4
  */

  if (
    mode ===
    "weak"
  ) {

    window.location.href =
      "./review.html";


    return;

  }


  window.location.href =
    `./game.html?mode=${encodeURIComponent(mode)}`;

}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

  const logoutBtn =
    document.getElementById(
      "logoutBtn"
    );


  logoutBtn
    ?.addEventListener(

      "click",

      async function () {

        logoutBtn.disabled =
          true;


        const result =
          await logoutUser();


        if (
          !result.success
        ) {

          logoutBtn.disabled =
            false;


          alert(
            "ออกจากระบบไม่สำเร็จ"
          );


          return;

        }


        window.location.replace(
          "../index.html"
        );

      }

    );

}


/* =========================================================
   HELPERS
========================================================= */

function setText(
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
/* =========================================================
   PRACTICE HUB — 2 STEP SELECTION
========================================================= */
function setupPracticeHub() {

  const selector =
    document.getElementById("practiceTypeSelector");

  const vocabularyPanel =
    document.getElementById("vocabularyPracticePanel");

  const grammarPanel =
    document.getElementById("grammarPracticePanel");

  const grammarChapterGrid =
    document.getElementById("grammarChapterGrid");

  const grammarChapterStep =
    document.getElementById("grammarChapterStep");

  const grammarModeStep =
    document.getElementById("grammarModeStep");

  let selectedGrammarChapter =
    "mixed";

  const openPanel =
    function (type) {

      if (!selector || !vocabularyPanel || !grammarPanel) {
        return;
      }

      selector.hidden = true;

      vocabularyPanel.hidden =
        type !== "vocabulary";

      grammarPanel.hidden =
        type !== "grammar";

      vocabularyPanel.classList.toggle(
        "is-active",
        type === "vocabulary"
      );

      grammarPanel.classList.toggle(
        "is-active",
        type === "grammar"
      );

      const target =
        type === "grammar"
          ? grammarPanel
          : vocabularyPanel;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    };

  document
    .querySelectorAll("[data-practice-type]")
    .forEach(function (button) {

      button.addEventListener(
        "click",
        function () {
          openPanel(
            button.dataset.practiceType
          );
        }
      );

    });

  document
    .querySelectorAll("[data-change-practice]")
    .forEach(function (button) {

      button.addEventListener(
        "click",
        function () {

          if (!selector || !vocabularyPanel || !grammarPanel) {
            return;
          }

          selector.hidden = false;
          vocabularyPanel.hidden = true;
          grammarPanel.hidden = true;

          vocabularyPanel.classList.remove(
            "is-active"
          );

          grammarPanel.classList.remove(
            "is-active"
          );

          selector.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        }
      );

    });


  if (grammarChapterGrid) {
    grammarChapterGrid.innerHTML =
      TOEIC_GRAMMAR_CHAPTERS
        .map(function (chapter) {
          return (
            '<button class="grammar-chapter-card" type="button" data-grammar-chapter="' +
              chapter.id +
            '">' +
              '<span class="grammar-chapter-no">' +
                chapter.no +
              '</span>' +
              '<div>' +
                '<strong>' +
                  chapter.title +
                '</strong>' +
                '<small>' +
                  chapter.thai +
                '</small>' +
              '</div>' +
              '<b>→</b>' +
            '</button>'
          );
        })
        .join("");
  }

  const showGrammarModes =
    function (chapterId) {
      selectedGrammarChapter =
        chapterId || "mixed";

      const isMixed =
        selectedGrammarChapter === "mixed";

      const chapter =
        isMixed
          ? null
          : getGrammarChapter(
              selectedGrammarChapter
            );

      if (
        !grammarChapterStep ||
        !grammarModeStep
      ) {
        return;
      }

      grammarChapterStep.hidden = true;
      grammarModeStep.hidden = false;

      setText(
        "grammarSelectedChapterNumber",
        isMixed
          ? "ALL CHAPTERS"
          : "CHAPTER " + chapter.no
      );

      setText(
        "grammarSelectedChapterTitle",
        isMixed
          ? "Mixed TOEIC Grammar"
          : chapter.title
      );

      setText(
        "grammarSelectedChapterDescription",
        isMixed
          ? "สุ่มโจทย์จากทุกบท เพื่อจำลองการเจอ Grammar หลายหัวข้อแบบข้อสอบ TOEIC"
          : chapter.description
      );

      grammarModeStep.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

  grammarPanel
    ?.querySelectorAll(
      "[data-grammar-chapter]"
    )
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          showGrammarModes(
            button.dataset.grammarChapter
          );
        }
      );
    });

  document
    .getElementById(
      "grammarBackToChapters"
    )
    ?.addEventListener(
      "click",
      function () {
        if (
          !grammarChapterStep ||
          !grammarModeStep
        ) {
          return;
        }

        grammarModeStep.hidden = true;
        grammarChapterStep.hidden = false;

        grammarChapterStep.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    );

  if (
    window.location.hash === "#grammar-practice"
    || window.location.hash === "#grammarPracticePanel"
  ) {
    openPanel("grammar");
  }

  grammarPanel
    ?.querySelectorAll("[data-grammar-mode]")
    .forEach(function (card) {

      const openGrammar =
        function () {
          const mode =
            card.dataset.grammarMode || "part5";

          if (!practiceAvailabilityReady) {
            showPracticeToast(
              "กำลังโหลดการตั้งค่า Practice..."
            );
            return;
          }

          if (
            practiceModeAvailability[mode] ===
            false
          ) {
            showPracticeToast(
              "โหมด Grammar นี้ถูกปิดใช้งานชั่วคราว"
            );
            return;
          }

          const params =
            new URLSearchParams({
              mode
            });

          if (
            selectedGrammarChapter &&
            selectedGrammarChapter !== "mixed"
          ) {
            params.set(
              "chapter",
              selectedGrammarChapter
            );
          }

          window.location.href =
            "./grammar-game.html?" +
            params.toString();
        };

      card.addEventListener(
        "click",
        openGrammar
      );

      card.addEventListener(
        "keydown",
        function (event) {
          if (
            event.key !== "Enter"
            && event.key !== " "
          ) {
            return;
          }

          event.preventDefault();
          openGrammar();
        }
      );

    });

}


async function loadPracticeModeAvailability() {
  const map = {
    translation: "translation",
    meaning: "meaning",
    synonym: "synonym",
    weak: "weak",
    part5: "grammar-part5",
    fill: "grammar-fill",
    error: "grammar-error",
    sentence: "grammar-sentence"
  };

  try {
    const entries =
      await Promise.all(
        Object.entries(map)
          .map(async function ([key, docId]) {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "gameSettings",
                  docId
                )
              );

            return [
              key,
              snapshot.exists()
                ? snapshot.data()?.enabled !== false
                : true
            ];
          })
      );

    entries.forEach(function ([key, enabled]) {
      practiceModeAvailability[key] =
        enabled;
    });
  } catch (error) {
    console.warn(
      "Practice availability load failed:",
      error
    );
  }

  practiceAvailabilityReady =
    true;

  document
    .querySelectorAll("[data-mode]")
    .forEach(function (card) {
      const mode =
        card.dataset.mode;

      const disabled =
        practiceModeAvailability[mode] ===
        false;

      card.classList.toggle(
        "is-disabled",
        disabled
      );

      card.setAttribute(
        "aria-disabled",
        disabled ? "true" : "false"
      );

      if (disabled) {
        const button =
          card.querySelector(
            ".game-start-button"
          );

        if (button) {
          button.disabled = true;
          button.querySelector("span") &&
            (button.querySelector("span").textContent =
              "Unavailable");
        }
      }
    });

  document
    .querySelectorAll("[data-grammar-mode]")
    .forEach(function (card) {
      const mode =
        card.dataset.grammarMode;

      const disabled =
        practiceModeAvailability[mode] ===
        false;

      card.classList.toggle(
        "is-disabled",
        disabled
      );

      card.setAttribute(
        "aria-disabled",
        disabled ? "true" : "false"
      );

      const button =
        card.querySelector("button");

      if (button) {
        button.disabled = disabled;

        if (disabled) {
          button.innerHTML =
            "Unavailable";
        }
      }
    });
}


function showPracticeToast(featureName) {

  let toast =
    document.getElementById("practiceHubToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "practiceHubToast";
    toast.className = "practice-hub-toast";
    document.body.appendChild(toast);
  }

  toast.textContent =
    featureName + " กำลังเตรียมอยู่ ✨";

  toast.classList.add("show");

  window.clearTimeout(
    showPracticeToast.timer
  );

  showPracticeToast.timer =
    window.setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);

}
