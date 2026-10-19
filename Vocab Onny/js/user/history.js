import {

  getSessionCompat,

  readGameHistory,

  renderPlayerBasics,

  setupCommonNavigation,

  setText,

  toNumber,

  getGameAccuracy,

  getHistoryTimestamp,

  formatModeName,

  formatDateTime,

  escapeHTML

} from "./user-data.js";



let historyData =
  [];



document.addEventListener(

  "DOMContentLoaded",

  initHistory

);



/* =========================================================
   INIT
========================================================= */

async function initHistory() {

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
        "history"
    }
  );


  historyData =
    await readGameHistory();


  historyData =
    Array.isArray(
      historyData
    )
      ? historyData
      : [];


  renderSummary();


  setupFilter();


  renderHistory(
    historyData
  );

}



/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

  setText(
    "totalGames",
    historyData.length
  );


  const totalQuestions =
    historyData.reduce(

      function (
        sum,
        game
      ) {

        return (

          sum +

          (
            toNumber(
              game.totalQuestions
            ) ||

            (
              toNumber(
                game.correct
              ) +

              toNumber(
                game.wrong
              ) +

              toNumber(
                game.timeout
              )
            )
          )

        );

      },

      0

    );


  const averageAccuracy =
    historyData.length > 0

      ? Math.round(

          historyData.reduce(

            function (
              sum,
              game
            ) {

              return (
                sum +
                getGameAccuracy(
                  game
                )
              );

            },

            0

          ) /
          historyData.length

        )

      : 0;


  setText(
    "historyQuestions",
    totalQuestions
  );


  setText(
    "historyAccuracy",
    `${averageAccuracy}%`
  );


  setText(
    "bestMode",
    calculateBestMode()
  );

}



/* =========================================================
   BEST MODE
========================================================= */

function calculateBestMode() {

  const map =
    new Map();


  historyData.forEach(

    function (
      game
    ) {

      const mode =
        getEffectiveHistoryMode(
          game
        );


      if (
        !map.has(
          mode
        )
      ) {

        map.set(
          mode,
          []
        );

      }


      map
        .get(
          mode
        )
        .push(
          getGameAccuracy(
            game
          )
        );

    }

  );


  let best =
    null;


  let bestAverage =
    -1;


  for (
    const [
      mode,
      values
    ]
    of map.entries()
  ) {

    const average =
      values.reduce(

        function (
          a,
          b
        ) {

          return (
            a +
            b
          );

        },

        0

      ) /
      values.length;


    if (
      average >
      bestAverage
    ) {

      bestAverage =
        average;


      best =
        mode;

    }

  }


  return best
    ? formatModeName(
        best
      )
    : "-";

}



/* =========================================================
   FILTER / SORT
========================================================= */

function setupFilter() {

  const mode =
    document.getElementById(
      "historyModeFilter"
    );


  const sort =
    document.getElementById(
      "historySort"
    );


  const update =
    function () {

      let list =
        [
          ...historyData
        ];


      if (
        mode?.value &&
        mode.value !==
          "all"
      ) {

        list =
          list.filter(

            function (
              item
            ) {

              return (
                getEffectiveHistoryMode(
                  item
                ) ===
                mode.value
              );

            }

          );

      }


      if (
        sort?.value ===
        "oldest"
      ) {

        list.sort(

          function (
            a,
            b
          ) {

            return (

              getHistoryTimestamp(
                a
              ) -

              getHistoryTimestamp(
                b
              )

            );

          }

        );

      }

      else if (
        sort?.value ===
        "accuracy"
      ) {

        list.sort(

          function (
            a,
            b
          ) {

            return (

              getGameAccuracy(
                b
              ) -

              getGameAccuracy(
                a
              )

            );

          }

        );

      }

      else {

        list.sort(

          function (
            a,
            b
          ) {

            return (

              getHistoryTimestamp(
                b
              ) -

              getHistoryTimestamp(
                a
              )

            );

          }

        );

      }


      renderHistory(
        list
      );

    };


  mode
    ?.addEventListener(
      "change",
      update
    );


  sort
    ?.addEventListener(
      "change",
      update
    );

}



/* =========================================================
   RENDER HISTORY
========================================================= */

function renderHistory(
  items
) {

  const container =
    document.getElementById(
      "historyList"
    );


  const empty =
    document.getElementById(
      "historyEmptyState"
    );


  if (
    !container ||
    !empty
  ) {

    return;

  }


  if (
    items.length === 0
  ) {

    container.innerHTML =
      "";


    empty.hidden =
      false;


    return;

  }


  empty.hidden =
    true;


  container.innerHTML =
    items
      .map(

        function (
          game
        ) {

          const accuracy =
            getGameAccuracy(
              game
            );


          const correct =
            toNumber(
              game.correct
            );


          const wrong =
            toNumber(
              game.wrong
            );


          const timeout =
            toNumber(
              game.timeout
            );


          const total =

            toNumber(
              game.totalQuestions
            ) ||

            (
              correct +
              wrong +
              timeout
            );


          const accuracyClass =

            accuracy < 60

              ? "danger"

              : accuracy >= 80

                ? "success"

                : "";


          return `

            <article class="history-card">


              <div class="history-mode-icon">

                ${getModeIcon(
                  getEffectiveHistoryMode(game)
                )}

              </div>


              <div class="history-card-main">


                <div class="history-card-heading">


                  <div>

                    <span class="history-date">

                      ${
                        escapeHTML(
                          formatDateTime(
                            game
                          )
                        )
                      }

                    </span>


                    <h3>

                      ${
                        escapeHTML(
                          formatModeName(
                            getEffectiveHistoryMode(
                              game
                            )
                          )
                        )
                      }

                    </h3>

                  </div>


                  <strong
                    class="
                      history-accuracy
                      ${accuracyClass}
                    "
                  >

                    ${accuracy}%

                  </strong>


                </div>



                <div class="history-metrics">


                  <span>

                    <strong>
                      ${total}
                    </strong>

                    Questions

                  </span>


                  <span class="correct">

                    <strong>
                      ${correct}
                    </strong>

                    Correct

                  </span>


                  <span class="wrong">

                    <strong>
                      ${wrong}
                    </strong>

                    Wrong

                  </span>


                  <span class="timeout">

                    <strong>
                      ${timeout}
                    </strong>

                    Timeout

                  </span>


                </div>


              </div>


            </article>

          `;

        }

      )

      .join(
        ""
      );

}



/* =========================================================
   EFFECTIVE HISTORY MODE
========================================================= */

function getEffectiveHistoryMode(
  game = {}
) {
  if (
    game.practiceType === "grammar"
  ) {
    const grammarMode =
      String(
        game.grammarMode || ""
      )
        .trim()
        .toLowerCase();

    if (grammarMode) {
      return (
        grammarMode === "tenses"
          ? "grammar-part5"
          : "grammar-" +
            grammarMode
      );
    }

    if (game.displayMode) {
      return String(
        game.displayMode
      ).toLowerCase();
    }
  }

  return String(
    game.mode || "practice"
  ).toLowerCase();
}


/* =========================================================
   MODE ICON
========================================================= */

function getModeIcon(
  mode
) {

  const map = {

    translation:
      "文",

    meaning:
      "Aa",

    synonym:
      "≈",

    weak:
      "!",

    "grammar-part5":
      "⑤",

    "grammar-tenses":
      "⑤",

    "grammar-fill":
      "▢",

    "grammar-error":
      "✓",

    "grammar-sentence":
      "▦"

  };


  return (
    map[
      String(
        mode ||
        ""
      )
        .toLowerCase()
    ] ||
    "✓"
  );

}