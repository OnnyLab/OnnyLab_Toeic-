import {

  getSessionCompat,

  readWordStats,

  normalizeWordEntry,

  isWeakWord,

  renderPlayerBasics,

  setupCommonNavigation,

  setText,

  escapeHTML

} from "./user-data.js";

import {
  getGrammarStatsCloud
} from "../core/grammar-data.js";


let allWeakWords =
  [];

let allDueWords =
  [];

let grammarReviewTopics =
  [];

let allGrammarStats =
  [];



document.addEventListener(

  "DOMContentLoaded",

  initWeakWords

);



/* =========================================================
   INIT
========================================================= */

async function initWeakWords() {

  const session =
    await getSessionCompat();


  if (
    !session?.isLoggedIn
  ) {

    window.location.href =
      "../index.html";

    return;

  }


  if (
    session.role &&
    session.role !==
      "user"
  ) {

    window.location.href =
      "../admin/index.html";

    return;

  }


  renderPlayerBasics(
    session
  );


  setupCommonNavigation(
    {
      activePage:
        "weak"
    }
  );


  const [
    stats,
    grammarStats
  ] =
    await Promise.all([
      readWordStats(),
      getGrammarStatsCloud(
        session.uid
      )
    ]);


  allGrammarStats =
    Object.values(
      grammarStats || {}
    );

  grammarReviewTopics =
    allGrammarStats
      .filter(function (item) {
        return (
          Number(item.attempts || 0) >= 2
          && Number(item.accuracy || 0) < 80
        );
      })
      .sort(function (a, b) {
        return (
          Number(a.accuracy || 0)
          - Number(b.accuracy || 0)
        );
      });


  const allVocabularyWords =
    Object
      .entries(
        stats ||
        {}
      )
      .filter(function ([, stat]) {
        return stat?.kind !== "grammar";
      })
      .map(
        function (
          [
            id,
            stat
          ]
        ) {
          return normalizeWordEntry(
            id,
            stat
          );
        }
      );

  const now =
    Date.now();

  allDueWords =
    allVocabularyWords
      .filter(function (word) {
        if (
          Number(word.attempts || 0) <= 0
        ) {
          return false;
        }

        const nextReviewAt =
          word.nextReviewAt
            ? new Date(
                word.nextReviewAt
              ).getTime()
            : 0;

        if (
          Number.isFinite(
            nextReviewAt
          ) &&
          nextReviewAt > 0
        ) {
          return (
            nextReviewAt <=
            now
          );
        }

        /*
          Legacy stats ที่ยังไม่มี schedule:
          ให้คำ Weak ถือเป็น Due ทันทีเพื่อ migrate
          เข้า Spaced Review แบบไม่ทำให้รายการหาย
        */
        return isWeakWord(
          word
        );
      })
      .sort(function (a, b) {
        const aTime =
          a.nextReviewAt
            ? new Date(
                a.nextReviewAt
              ).getTime()
            : 0;

        const bTime =
          b.nextReviewAt
            ? new Date(
                b.nextReviewAt
              ).getTime()
            : 0;

        return (
          aTime - bTime
        );
      });

  allWeakWords =
    allVocabularyWords

      .filter(
        isWeakWord
      )

      .sort(

        function (
          a,
          b
        ) {

          if (
            a.accuracy !==
            b.accuracy
          ) {

            return (
              a.accuracy -
              b.accuracy
            );

          }


          return (

            (
              b.wrong +
              b.timeout
            ) -

            (
              a.wrong +
              a.timeout
            )

          );

        }

      );


  renderSummary();


  renderWords(
    allWeakWords
  );


  setupFilters();


  setupPracticeButtons();

  setupReviewTabs();

}



/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

  setText(
    "weakCount",
    allWeakWords.length
  );

  setText(
    "dueTodayCount",
    allDueWords.length
  );

  const dueButton =
    document.getElementById(
      "startDueReviewBtn"
    );

  if (dueButton) {
    dueButton.disabled =
      allDueWords.length === 0;

    dueButton.textContent =
      allDueWords.length > 0
        ? "Start Due Review (" +
          allDueWords.length +
          ") →"
        : "Nothing Due Today ✓";
  }


  const totalAttempts =
    allWeakWords.reduce(

      function (
        sum,
        word
      ) {

        return (
          sum +
          word.attempts
        );

      },

      0

    );


  const totalCorrect =
    allWeakWords.reduce(

      function (
        sum,
        word
      ) {

        return (
          sum +
          word.correct
        );

      },

      0

    );


  const totalWrong =
    allWeakWords.reduce(

      function (
        sum,
        word
      ) {

        return (

          sum +

          word.wrong +

          word.timeout

        );

      },

      0

    );


  const accuracy =
    totalAttempts > 0

      ? Math.round(
          (
            totalCorrect /
            totalAttempts
          ) *
          100
        )

      : 0;


  setText(
    "weakAccuracy",
    `${accuracy}%`
  );


  setText(
    "mistakeCount",
    totalWrong
  );

}



/* =========================================================
   FILTER / SORT
========================================================= */

function setupFilters() {

  const search =
    document.getElementById(
      "weakSearch"
    );


  const sort =
    document.getElementById(
      "weakSort"
    );


  const update =
    function () {

      const keyword =
        String(
          search?.value ||
          ""
        )
          .trim()
          .toLowerCase();


      let list =
        allWeakWords.filter(

          function (
            word
          ) {

            return [

              word.word,

              word.thai,

              word.meaning

            ]

              .join(
                " "
              )

              .toLowerCase()

              .includes(
                keyword
              );

          }

        );


      if (
        sort?.value ===
        "mistakes"
      ) {

        list =
          [
            ...list
          ]
            .sort(

              function (
                a,
                b
              ) {

                return (

                  (
                    b.wrong +
                    b.timeout
                  ) -

                  (
                    a.wrong +
                    a.timeout
                  )

                );

              }

            );

      }

      else if (
        sort?.value ===
        "attempts"
      ) {

        list =
          [
            ...list
          ]
            .sort(

              function (
                a,
                b
              ) {

                return (
                  b.attempts -
                  a.attempts
                );

              }

            );

      }

      else {

        list =
          [
            ...list
          ]
            .sort(

              function (
                a,
                b
              ) {

                return (
                  a.accuracy -
                  b.accuracy
                );

              }

            );

      }


      renderWords(
        list
      );

    };


  search
    ?.addEventListener(
      "input",
      update
    );


  sort
    ?.addEventListener(
      "change",
      update
    );

}



/* =========================================================
   RENDER WORDS
========================================================= */

function renderWords(
  words
) {

  const grid =
    document.getElementById(
      "weakWordsList"
    );


  const empty =
    document.getElementById(
      "weakEmptyState"
    );


  if (
    !grid ||
    !empty
  ) {

    return;

  }


  if (
    words.length === 0
  ) {

    grid.innerHTML =
      "";


    empty.hidden =
      false;


    return;

  }


  empty.hidden =
    true;


  grid.innerHTML =
    words
      .map(

        function (
          word
        ) {

          return `

            <article class="weak-word-card">

              <div class="weak-word-top">

                <div>

                  <span class="weak-badge">
                    NEEDS REVIEW
                  </span>

                  <h3>
                    ${escapeHTML(word.word)}
                  </h3>

                  <p class="weak-thai">
                    ${escapeHTML(word.thai)}
                  </p>

                </div>


                <div
                  class="
                    accuracy-ring
                    ${
                      word.accuracy < 50
                        ? "danger"
                        : "warning"
                    }
                  "
                >
                  ${word.accuracy}%
                </div>

              </div>


              ${
                word.meaning

                  ? `
                    <p class="weak-meaning">
                      ${escapeHTML(word.meaning)}
                    </p>
                  `

                  : ""
              }


              <div class="weak-stats-row">

                <span>

                  <strong>
                    ${word.attempts}
                  </strong>

                  Attempts

                </span>


                <span>

                  <strong>
                    ${word.correct}
                  </strong>

                  Correct

                </span>


                <span>

                  <strong>
                    ${
                      word.wrong +
                      word.timeout
                    }
                  </strong>

                  Mistakes

                </span>

              </div>


              <button
                class="practice-word-button"
                type="button"
                data-word-id="${escapeHTML(word.id)}"
              >
                Practice this word →
              </button>

            </article>

          `;

        }

      )

      .join(
        ""
      );

}



/* =========================================================
   PRACTICE BUTTONS
========================================================= */

let pendingWeakPracticeIds =
  [];


function openWeakModePicker(
  ids
) {

  const picker =
    document.getElementById(
      "weakModePicker"
    );


  pendingWeakPracticeIds =
    [
      ...new Set(
        (ids || [])
          .map(
            function (
              id
            ) {

              return String(
                id ||
                ""
              ).trim();

            }
          )
          .filter(
            Boolean
          )
      )
    ];


  if (
    !picker ||
    pendingWeakPracticeIds.length ===
      0
  ) {

    return;

  }


  picker.hidden =
    false;

  picker.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "weak-mode-picker-open"
  );

}


function closeWeakModePicker() {

  const picker =
    document.getElementById(
      "weakModePicker"
    );


  if (
    !picker
  ) {

    return;

  }


  picker.hidden =
    true;

  picker.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "weak-mode-picker-open"
  );

}


function startWeakPractice(
  mode
) {

  if (
    ![
      "translation",
      "meaning",
      "synonym"
    ].includes(
      mode
    ) ||
    pendingWeakPracticeIds.length ===
      0
  ) {

    return;

  }


  sessionStorage.setItem(
    "vocabOnnyWeakWordIds",
    JSON.stringify(
      pendingWeakPracticeIds
    )
  );


  window.location.href =
    "./game.html?mode=" +
    encodeURIComponent(
      mode
    ) +
    "&source=weak";

}


function setupPracticeButtons() {

  document
    .getElementById(
      "startDueReviewBtn"
    )
    ?.addEventListener(
      "click",
      function () {
        if (
          allDueWords.length ===
          0
        ) {
          return;
        }

        openWeakModePicker(
          allDueWords.map(
            function (word) {
              return word.id;
            }
          )
        );
      }
    );

  document
    .getElementById(
      "practiceAllBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        openWeakModePicker(
          allWeakWords.map(
            function (
              word
            ) {

              return word.id;

            }
          )
        );

      }
    );


  document
    .getElementById(
      "weakWordsList"
    )
    ?.addEventListener(
      "click",
      function (
        event
      ) {

        const button =
          event.target.closest(
            "[data-word-id]"
          );


        if (
          !button
        ) {

          return;

        }


        openWeakModePicker(
          [
            button.dataset
              .wordId
          ]
        );

      }
    );


  document
    .getElementById(
      "weakModePicker"
    )
    ?.addEventListener(
      "click",
      function (
        event
      ) {

        const closeButton =
          event.target.closest(
            "[data-close-weak-picker]"
          );


        if (
          closeButton
        ) {

          closeWeakModePicker();

          return;

        }


        const modeButton =
          event.target.closest(
            "[data-weak-game-mode]"
          );


        if (
          !modeButton
        ) {

          return;

        }


        startWeakPractice(
          modeButton.dataset
            .weakGameMode
        );

      }
    );


  document.addEventListener(
    "keydown",
    function (
      event
    ) {

      if (
        event.key ===
        "Escape"
      ) {

        closeWeakModePicker();

      }

    }
  );

}
/* =========================================================
   REVIEW HUB
========================================================= */
function setupReviewTabs() {

  const grammarPanel =
    document.getElementById("grammarReviewPanel");

  const vocabularyContent =
    document.querySelectorAll(".review-vocabulary-only");

  const buttons =
    document.querySelectorAll("[data-review-type]");

  setText(
    "reviewVocabularyCount",
    `${allWeakWords.length} ${allWeakWords.length === 1 ? "word" : "words"}`
  );

  setText(
    "reviewGrammarCount",
    `${grammarReviewTopics.length} ${grammarReviewTopics.length === 1 ? "topic" : "topics"}`
  );

  renderGrammarMasterySummary();
  renderGrammarReviewTopics();

  buttons.forEach(function (button) {

    button.addEventListener(
      "click",
      function () {

        const type =
          button.dataset.reviewType;

        buttons.forEach(function (item) {
          item.classList.toggle(
            "active",
            item === button
          );
        });

        const grammarActive =
          type === "grammar";

        vocabularyContent.forEach(function (element) {
          element.hidden = grammarActive;
        });

        if (grammarPanel) {
          grammarPanel.hidden = !grammarActive;
        }

      }
    );

  });

}

function getGrammarMasteryStatus(
  item = {}
) {
  const attempts =
    Number(item.attempts || 0);

  const accuracy =
    Number(item.accuracy || 0);

  const mistakes =
    Number(item.wrong || 0) +
    Number(item.timeout || 0);

  if (attempts <= 0) {
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

  if (accuracy >= 75) {
    return "familiar";
  }

  return "learning";
}

function renderGrammarMasterySummary() {
  const counts = {
    learning: 0,
    weak: 0,
    familiar: 0,
    mastered: 0
  };

  allGrammarStats.forEach(
    function (item) {
      const status =
        getGrammarMasteryStatus(
          item
        );

      if (
        counts[status] !==
        undefined
      ) {
        counts[status] += 1;
      }
    }
  );

  setText(
    "grammarMasteryLearning",
    counts.learning
  );

  setText(
    "grammarMasteryWeak",
    counts.weak
  );

  setText(
    "grammarMasteryFamiliar",
    counts.familiar
  );

  setText(
    "grammarMasteryMastered",
    counts.mastered
  );
}


function renderGrammarReviewTopics() {
  const container =
    document.getElementById("grammarReviewList");

  if (!container) return;

  if (!grammarReviewTopics.length) {
    container.innerHTML =
      '<div class="grammar-review-topic-empty">' +
        '<strong>No grammar topics need review yet</strong>' +
        '<span>ฝึก Grammar เพิ่มอีกนิด แล้วระบบจะเริ่มวิเคราะห์หัวข้อให้</span>' +
      '</div>';

    return;
  }

  container.innerHTML =
    grammarReviewTopics.map(function (item) {
      const mode =
        String(item.mode || "tenses");

      return (
        '<article class="grammar-review-topic">' +
          '<div>' +
            '<span>' +
              escapeHTML(grammarModeLabel(mode)) +
            '</span>' +
            '<strong>' +
              escapeHTML(item.topic || "Grammar") +
            '</strong>' +
            '<small>' +
              Number(item.attempts || 0) +
              ' attempts · ' +
              Number(item.wrong || 0) +
              ' wrong' +
            '</small>' +
            '<em class="grammar-mastery-badge grammar-mastery-' +
              getGrammarMasteryStatus(item) +
            '">' +
              escapeHTML(
                getGrammarMasteryStatus(item)
              ) +
            '</em>' +
          '</div>' +
          '<div class="grammar-review-topic-score">' +
            '<b>' +
              Number(item.accuracy || 0) +
              '%' +
            '</b>' +
            '<a href="./grammar-game.html?mode=' +
              encodeURIComponent(mode) +
              (
                item.chapterId
                  ? '&chapter=' +
                    encodeURIComponent(
                      item.chapterId
                    )
                  : ''
              ) +
              '&topic=' +
              encodeURIComponent(
                item.topic || ""
              ) +
            '">Practice →</a>' +
          '</div>' +
        '</article>'
      );
    }).join("");
}


function grammarModeLabel(mode) {
  return {
    part5: "TOEIC Part 5",
    tenses: "TOEIC Part 5",
    fill: "Fill in the Blank",
    error: "Error Detection",
    sentence: "Sentence Building"
  }[mode] || "Grammar";
}
