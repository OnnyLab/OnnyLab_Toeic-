import {

  getSessionCompat,

  readWordStats,

  readGameHistory,

  normalizeWordEntry,

  getWordStatus,

  getGameAccuracy,

  getHistoryTimestamp,

  formatModeName,

  formatDateTime,

  renderPlayerBasics,

  setupCommonNavigation,

  setText,

  toNumber,

  escapeHTML

} from "./user-data.js";

import {
  getGrammarStatsCloud
} from "../core/grammar-data.js";


let dashboardDailyGoal =
  10;

document.addEventListener(
  "DOMContentLoaded",
  initDashboard
);


/* =========================================================
   INIT
========================================================= */

async function initDashboard() {

  const session =
    await getSessionCompat();


  /*
    getSessionCompat()
    ตรวจ Firebase Auth และ Redirect อยู่แล้ว
  */

  if (
    !session
  ) {

    return;

  }


  renderPlayerBasics(
    session
  );

  dashboardDailyGoal =
    Math.max(
      10,
      Math.min(
        50,
        Number(
          session?.profile?.dailyGoal
        ) || 10
      )
    );

  setText(
    "dashboardWelcomeName",
    session.name || "Player"
  );


  setupCommonNavigation(
    {
      activePage:
        "dashboard"
    }
  );


  try {

    const [
      statsMap,
      history,
      grammarStats
    ] =
      await Promise.all(
        [

          readWordStats(),

          readGameHistory(),

          getGrammarStatsCloud(
            session.uid
          )

        ]
      );


    renderDashboard(

      statsMap ||
      {},

      Array.isArray(
        history
      )
        ? history
        : []

    );

    const grammarReviewCount =
      Object
        .values(
          grammarStats || {}
        )
        .filter(function (item) {
          return (
            Number(item.attempts || 0) >= 2
            && Number(item.accuracy || 0) < 80
          );
        })
        .length;

    setText(
      "dashboardGrammarTopics",
      grammarReviewCount
    );

    renderDashboardGrammarModes(
      grammarStats || {}
    );

  }

  catch (
    error
  ) {

    console.error(
      "Dashboard loading error:",
      error
    );


    /*
      Data Error
      ไม่ใช่ Authentication Error

      จึงแสดงค่า 0
      แทนการเตะกลับ Login
    */

    renderDashboard(
      {},
      []
    );

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard(
  statsMap,
  history
) {

  const words =
    Object
      .entries(
        statsMap ||
        {}
      )
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


  const practiced =
    words.filter(

      function (
        word
      ) {

        return (
          word.attempts >
          0
        );

      }

    );


  const totalCorrect =
    practiced.reduce(

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
    practiced.reduce(

      function (
        sum,
        word
      ) {

        return (
          sum +
          word.wrong
        );

      },

      0

    );


  const totalTimeout =
    practiced.reduce(

      function (
        sum,
        word
      ) {

        return (
          sum +
          word.timeout
        );

      },

      0

    );


  const totalAttempts =
    practiced.reduce(

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


  const totalResponseTime =
    practiced.reduce(

      function (
        sum,
        word
      ) {

        return (

          sum +

          toNumber(
            word.totalResponseTime
          )

        );

      },

      0

    );


  let averageResponse =
    0;


  if (
    totalResponseTime >
      0 &&

    totalAttempts >
      0
  ) {

    averageResponse =

      totalResponseTime /

      totalAttempts;

  }


  if (
    averageResponse ===
    0
  ) {

    averageResponse =
      calculateHistoryAverageResponse(
        history
      );

  }


  const overallAccuracy =

    totalAttempts >
    0

      ? Math.round(

          (
            totalCorrect /
            totalAttempts
          ) *
          100

        )

      : calculateHistoryAccuracy(
          history
        );


  const weakCount =
    words.filter(

      function (
        word
      ) {

        return (

          getWordStatus(
            word
          )

          ===

          "weak"

        );

      }

    ).length;


  const correctValue =

    totalCorrect

    ||

    sumHistory(
      history,
      "correct"
    );


  const wrongValue =

    totalWrong

    ||

    sumHistory(
      history,
      "wrong"
    );


  const timeoutValue =

    totalTimeout

    ||

    sumHistory(
      history,
      "timeout"
    );


  /* =======================================================
     ACCURACY
  ======================================================= */

  setText(
    "heroAccuracy",
    `${overallAccuracy}%`
  );


  setText(
    "accuracyValue",
    `${overallAccuracy}%`
  );


  setText(
    "overallAccuracy",
    `${overallAccuracy}%`
  );


  setText(
    "scoreAccuracy",
    `${overallAccuracy}%`
  );


  /* =======================================================
     SUMMARY
  ======================================================= */

  setText(
    "wordsLearnedValue",
    practiced.length
  );


  setText(
    "wordsLearned",
    practiced.length
  );


  setText(

    "questionsAnswered",

    totalAttempts

    ||

    calculateHistoryQuestions(
      history
    )

  );


  setText(
    "weakWordsValue",
    weakCount
  );


  setText(
    "weakWordsCount",
    weakCount
  );


  /* =======================================================
     ANSWERS
  ======================================================= */

  setText(
    "correctValue",
    correctValue
  );


  setText(
    "correctAnswers",
    correctValue
  );


  setText(
    "wrongValue",
    wrongValue
  );


  setText(
    "wrongAnswers",
    wrongValue
  );


  setText(
    "timeoutValue",
    timeoutValue
  );


  setText(
    "timeoutAnswers",
    timeoutValue
  );


  setText(
    "averageResponseValue",
    `${averageResponse.toFixed(1)}s`
  );


  setText(
    "averageResponse",
    `${averageResponse.toFixed(1)}s`
  );


  /* =======================================================
     STREAK / TODAY
  ======================================================= */

  setText(

    "streakValue",

    `${calculateStreak(history)} days`

  );


  setText(

    "todayGamesValue",

    calculateTodayGames(
      history
    )

  );


  renderModes(
    practiced,
    history
  );


  renderMastery(
    words
  );


  renderRecentActivity(
    history
  );

  renderDashboardV4({
    words,
    practiced,
    history,
    weakCount,
    totalCorrect,
    totalAttempts,
    overallAccuracy
  });

}


/* =========================================================
   HISTORY QUESTIONS
========================================================= */

function calculateHistoryQuestions(
  history
) {

  if (
    !Array.isArray(
      history
    )
  ) {

    return 0;

  }


  return history.reduce(

    function (
      sum,
      game
    ) {

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


      return (
        sum +
        total
      );

    },

    0

  );

}


/* =========================================================
   HISTORY ACCURACY
========================================================= */

function calculateHistoryAccuracy(
  history
) {

  if (
    !Array.isArray(
      history
    )

    ||

    history.length ===
      0
  ) {

    return 0;

  }


  let correct =
    0;


  let total =
    0;


  history.forEach(

    function (
      game
    ) {

      const gameTotal =

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


      correct +=
        toNumber(
          game.correct
        );


      total +=
        gameTotal;

    }

  );


  return total >
    0

      ? Math.round(

          (
            correct /
            total
          ) *
          100

        )

      : 0;

}


/* =========================================================
   AVERAGE RESPONSE
========================================================= */

function calculateHistoryAverageResponse(
  history
) {

  if (
    !Array.isArray(
      history
    )
  ) {

    return 0;

  }


  let total =
    0;


  let samples =
    0;


  history.forEach(

    function (
      game
    ) {

      const value =
        toNumber(

          game.averageResponse

          ||

          game.averageResponseTime

        );


      if (
        value >
        0
      ) {

        total +=
          value;


        samples +=
          1;

      }

    }

  );


  return samples >
    0

      ? total /
        samples

      : 0;

}


/* =========================================================
   SUM HISTORY
========================================================= */

function sumHistory(
  history,
  field
) {

  if (
    !Array.isArray(
      history
    )
  ) {

    return 0;

  }


  return history.reduce(

    function (
      sum,
      item
    ) {

      return (

        sum +

        toNumber(
          item[
            field
          ]
        )

      );

    },

    0

  );

}


/* =========================================================
   MODE PERFORMANCE
========================================================= */

function renderModes(
  words,
  history
) {

  [

    "translation",

    "meaning",

    "synonym"

  ].forEach(

    function (
      mode
    ) {

      let attempts =
        0;


      let correct =
        0;


      words.forEach(

        function (
          word
        ) {

          attempts +=
            toNumber(

              word[
                `${mode}Attempts`
              ]

            );


          correct +=
            toNumber(

              word[
                `${mode}Correct`
              ]

            );

        }

      );


      /*
        Fallback จาก History
      */

      if (
        attempts ===
          0 &&

        Array.isArray(
          history
        )
      ) {

        history
          .filter(

            function (
              game
            ) {

              return (
                game.practiceType !== "grammar"
                &&
                String(
                  game.mode ||
                  ""
                )
                  .toLowerCase()
                ===
                mode
              );

            }

          )
          .forEach(

            function (
              game
            ) {

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


              attempts +=
                total;


              correct +=
                toNumber(
                  game.correct
                );

            }

          );

      }


      const accuracy =

        attempts >
        0

          ? Math.round(

              (
                correct /
                attempts
              ) *
              100

            )

          : 0;


      setText(

        `${mode}Accuracy`,

        `${accuracy}%`

      );


      const progress =
        document.getElementById(

          `${mode}Progress`

        );


      if (
        progress
      ) {

        progress.style.width =
          `${accuracy}%`;

      }

    }

  );

}


/* =========================================================
   MASTERY
========================================================= */

function renderMastery(
  words
) {

  const counts = {

    new:
      0,

    learning:
      0,

    weak:
      0,

    familiar:
      0,

    mastered:
      0

  };


  words.forEach(

    function (
      word
    ) {

      const status =
        getWordStatus(
          word
        );


      if (
        counts[
          status
        ] !==
        undefined
      ) {

        counts[
          status
        ] +=
          1;

      }

    }

  );


  setText(
    "masteryNew",
    counts.new
  );


  setText(
    "masteryLearning",
    counts.learning
  );


  setText(
    "masteryWeak",
    counts.weak
  );


  setText(
    "masteryFamiliar",
    counts.familiar
  );


  setText(
    "masteryMastered",
    counts.mastered
  );


  /*
    Compatibility กับ ID เก่า
  */

  setText(
    "learningWords",
    counts.learning
  );


  setText(
    "weakWordsCount",
    counts.weak
  );


  setText(
    "masteredWords",
    counts.mastered
  );

}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderRecentActivity(
  history
) {

  const list =

    document.getElementById(
      "activityList"
    );


  const empty =
    document.getElementById(
      "activityEmptyState"
    );


  if (
    !list
  ) {

    return;

  }


  if (
    !Array.isArray(
      history
    )

    ||

    history.length ===
      0
  ) {

    list.innerHTML =
      "";


    if (
      empty
    ) {

      empty.hidden =
        false;

    }


    return;

  }


  if (
    empty
  ) {

    empty.hidden =
      true;

  }


  const latest =
    [
      ...history
    ]
      .sort(

        function (
          a,
          b
        ) {

          return (

            getHistoryTimestamp(
              b
            )

            -

            getHistoryTimestamp(
              a
            )

          );

        }

      )
      .slice(
        0,
        5
      );


  list.innerHTML =
    latest
      .map(

        function (
          game
        ) {

          const accuracy =
            getGameAccuracy(
              game
            );


          const mode =
            formatModeName(
              getDashboardEffectiveMode(
                game
              )
            );


          const date =
            formatDateTime(
              game
            );


          return `

            <div class="history-item">

              <div class="history-info">

                <strong>
                  ${escapeHTML(mode)}
                </strong>

                <span>
                  ${escapeHTML(date)}
                </span>

              </div>


              <strong class="history-score">
                ${accuracy}%
              </strong>

            </div>

          `;

        }

      )
      .join(
        ""
      );

}


/* =========================================================
   TODAY GAMES
========================================================= */

function calculateTodayGames(
  history
) {

  if (
    !Array.isArray(
      history
    )
  ) {

    return 0;

  }


  const today =
    new Date();


  return history.filter(

    function (
      game
    ) {

      const timestamp =
        getHistoryTimestamp(
          game
        );


      if (
        !timestamp
      ) {

        return false;

      }


      const date =
        new Date(
          timestamp
        );


      return (

        date.getFullYear() ===
          today.getFullYear()

        &&

        date.getMonth() ===
          today.getMonth()

        &&

        date.getDate() ===
          today.getDate()

      );

    }

  ).length;

}


/* =========================================================
   STREAK
========================================================= */

function calculateStreak(
  history
) {

  if (
    !Array.isArray(
      history
    )

    ||

    history.length ===
      0
  ) {

    return 0;

  }


  const daySet =
    new Set(

      history
        .map(
          getHistoryTimestamp
        )
        .filter(
          Boolean
        )
        .map(

          function (
            time
          ) {

            return createDateKey(

              new Date(
                time
              )

            );

          }

        )

    );


  let streak =
    0;


  const cursor =
    new Date();


  /*
    วันนี้ยังไม่เล่น
    ให้เริ่มเช็กจากเมื่อวาน
  */

  if (
    !daySet.has(
      createDateKey(
        cursor
      )
    )
  ) {

    cursor.setDate(

      cursor.getDate() -
      1

    );

  }


  for (
    let i = 0;
    i < 366;
    i += 1
  ) {

    const key =
      createDateKey(
        cursor
      );


    if (
      !daySet.has(
        key
      )
    ) {

      break;

    }


    streak +=
      1;


    cursor.setDate(

      cursor.getDate() -
      1

    );

  }


  return streak;

}


function createDateKey(
  date
) {

  return [

    date.getFullYear(),

    String(
      date.getMonth() +
      1
    )
      .padStart(
        2,
        "0"
      ),

    String(
      date.getDate()
    )
      .padStart(
        2,
        "0"
      )

  ].join(
    "-"
  );

}

/* =========================================================
   DASHBOARD V4
========================================================= */
function renderDashboardV4(data) {
  const history = Array.isArray(data.history) ? [...data.history] : [];
  const sortedHistory = history.sort(function (a, b) {
    return getHistoryTimestamp(b) - getHistoryTimestamp(a);
  });
  const todayKey = createDateKey(new Date());
  const todayHistory = sortedHistory.filter(function (game) {
    const timestamp = getHistoryTimestamp(game);
    if (!timestamp) return false;
    return createDateKey(new Date(timestamp)) === todayKey;
  });
  const todayQuestions = todayHistory.reduce(function (sum, game) {
    return sum + getDashboardGameTotal(game);
  }, 0);
  const todayCorrect = todayHistory.reduce(function (sum, game) {
    return sum + toNumber(game.correct);
  }, 0);
  const todayAccuracy = todayQuestions > 0
    ? Math.round((todayCorrect / todayQuestions) * 100)
    : 0;
  const streak = calculateStreak(history);

  setText("dashboardStreak", `${streak} days`);
  setText("dashboardTodayGames", todayHistory.length);
  setText("dashboardTodayGamesStat", todayHistory.length);
  setText("dashboardTodayAccuracy", `${todayAccuracy}%`);
  setText("dashboardTodayWords", todayQuestions);
  setText("dashboardTodayCorrect", todayCorrect);
  setText("dashboardWeakWords", data.weakCount || 0);

  renderDashboardGoal(todayQuestions);
  renderDashboardContinue(sortedHistory);
  renderDashboardWeekly(history);
  renderDashboardModesV4();
  renderDashboardRecentV4(sortedHistory);
}

function getDashboardGameTotal(game) {
  return toNumber(game?.totalQuestions) || (
    toNumber(game?.correct)
    + toNumber(game?.wrong)
    + toNumber(game?.timeout)
  );
}

function renderDashboardGoal(todayQuestions) {
  const goal =
    dashboardDailyGoal;
  const completed = Math.min(goal, Math.max(0, todayQuestions));
  const percent = Math.min(100, Math.round((completed / goal) * 100));
  const remaining = Math.max(0, goal - completed);

  setText("dashboardGoalCount", completed);
  setText("dashboardGoalTarget", goal);
  setText("dashboardGoalPercent", `${percent}%`);
  setText(
    "dashboardGoalText",
    remaining > 0
      ? `อีก ${remaining} ข้อ จะถึงเป้าหมายวันนี้`
      : "Daily goal completed! 🎉"
  );

  const bar = document.getElementById("dashboardGoalBar");
  if (bar) bar.style.width = `${percent}%`;
}

function renderDashboardContinue(history) {
  const latest = Array.isArray(history) ? history[0] : null;
  let title = "Translation";
  let href = "./game.html?mode=translation";
  let meta = "พร้อมเริ่มฝึกคำศัพท์รอบใหม่";

  if (latest) {
    const effectiveMode =
      getDashboardEffectiveMode(
        latest
      );

    const isWeak =
      effectiveMode === "weak";

    if (isWeak) {
      title = "Review Words";
      href = "./review.html";
      meta = "กลับไปทบทวนคำศัพท์ที่ยังไม่แม่น";
    } else if (
      effectiveMode.startsWith(
        "grammar-"
      )
    ) {
      const grammarMode =
        effectiveMode.replace(
          "grammar-",
          ""
        );

      title =
        formatModeName(
          effectiveMode
        );

      href =
        "./grammar-game.html?mode=" +
        encodeURIComponent(
          grammarMode
        );

      meta =
        `เล่นล่าสุด ${getGameAccuracy(latest)}% · ${formatDateTime(latest)}`;
    } else {
      const safeMode =
        [
          "translation",
          "meaning",
          "synonym"
        ].includes(
          effectiveMode
        )
          ? effectiveMode
          : "translation";

      title =
        formatModeName(
          safeMode
        );

      href =
        `./game.html?mode=${encodeURIComponent(safeMode)}`;

      meta =
        `เล่นล่าสุด ${getGameAccuracy(latest)}% · ${formatDateTime(latest)}`;
    }
  }

  setText("dashboardContinueMode", title);
  setText("dashboardContinueMeta", meta);
  const link = document.getElementById("dashboardContinueLink");
  if (link) link.href = href;
}

function renderDashboardWeekly(history) {
  const container = document.getElementById("dashboardWeeklyBars");
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  let weekCorrect = 0;
  let weekTotal = 0;

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = createDateKey(date);

    const games = history.filter(function (game) {
      const timestamp = getHistoryTimestamp(game);
      if (!timestamp) return false;
      return createDateKey(new Date(timestamp)) === key;
    });

    const correct = games.reduce(function (sum, game) {
      return sum + toNumber(game.correct);
    }, 0);

    const total = games.reduce(function (sum, game) {
      return sum + getDashboardGameTotal(game);
    }, 0);

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    weekCorrect += correct;
    weekTotal += total;

    days.push({
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      accuracy,
      games: games.length
    });
  }

  const weekAccuracy = weekTotal > 0
    ? Math.round((weekCorrect / weekTotal) * 100)
    : 0;

  setText("dashboardWeekAccuracy", `${weekAccuracy}%`);

  container.innerHTML = days.map(function (day) {
    const height = day.accuracy > 0 ? Math.max(8, day.accuracy) : 3;
    return `
      <div class="dash-week-day">
        <small>${day.accuracy}%</small>
        <div class="dash-week-bar-wrap">
          <div class="dash-week-bar" style="height:${height}%" title="${day.games} games · ${day.accuracy}%"></div>
        </div>
        <strong>${escapeHTML(day.label)}</strong>
      </div>
    `;
  }).join("");
}

function renderDashboardModesV4() {
  ["translation", "meaning", "synonym"].forEach(function (mode) {
    const source = document.getElementById(`${mode}Accuracy`);
    const value = source ? source.textContent : "0%";
    const cap = mode.charAt(0).toUpperCase() + mode.slice(1);

    setText(`dashboard${cap}Accuracy`, value);

    const accuracy = Math.max(0, Math.min(100, parseFloat(value) || 0));
    const bar = document.getElementById(`dashboard${cap}Bar`);
    if (bar) bar.style.width = `${accuracy}%`;
  });
}

function renderDashboardRecentV4(history) {
  const list = document.getElementById("dashboardRecentList");
  const empty = document.getElementById("dashboardRecentEmpty");
  if (!list) return;

  const latest = Array.isArray(history) ? history.slice(0, 3) : [];

  if (latest.length === 0) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = latest.map(function (game) {
    const effectiveMode =
      getDashboardEffectiveMode(
        game
      );

    const mode =
      formatModeName(
        effectiveMode
      );

    const initial =
      String(mode || "G")
        .charAt(0)
        .toUpperCase();

    return `
      <div class="dash-recent-item">
        <div class="dash-recent-icon">${escapeHTML(initial)}</div>
        <div class="dash-recent-info">
          <strong>${escapeHTML(mode)}</strong>
          <small>${escapeHTML(formatDateTime(game))}</small>
        </div>
        <div class="dash-recent-score">${getGameAccuracy(game)}%</div>
      </div>
    `;
  }).join("");
}

function getDashboardGrammarMasteryStatus(
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

function renderDashboardGrammarMastery(
  grammarStats
) {
  const counts = {
    learning: 0,
    weak: 0,
    familiar: 0,
    mastered: 0
  };

  Object.values(
    grammarStats || {}
  )
    .forEach(function (item) {
      const status =
        getDashboardGrammarMasteryStatus(
          item
        );

      if (
        counts[status] !==
        undefined
      ) {
        counts[status] += 1;
      }
    });

  setText(
    "dashboardGrammarMasteryLearning",
    counts.learning
  );
  setText(
    "dashboardGrammarMasteryWeak",
    counts.weak
  );
  setText(
    "dashboardGrammarMasteryFamiliar",
    counts.familiar
  );
  setText(
    "dashboardGrammarMasteryMastered",
    counts.mastered
  );
}

function renderDashboardGrammarModes(
  grammarStats
) {
  renderDashboardGrammarMastery(
    grammarStats
  );
  const modes = {
    part5: "Part5",
    fill: "Fill",
    error: "Error",
    sentence: "Sentence"
  };

  Object.entries(modes)
    .forEach(function ([mode, suffix]) {
      const stats =
        Object.values(
          grammarStats || {}
        )
        .filter(function (item) {
          const itemMode =
            String(item.mode || "")
              .toLowerCase();

          if (
            mode === "part5"
            && itemMode === "tenses"
          ) {
            return true;
          }

          return (
            itemMode === mode
          );
        });

      const attempts =
        stats.reduce(
          function (sum, item) {
            return (
              sum +
              Number(item.attempts || 0)
            );
          },
          0
        );

      const correct =
        stats.reduce(
          function (sum, item) {
            return (
              sum +
              Number(item.correct || 0)
            );
          },
          0
        );

      const accuracy =
        attempts > 0
          ? Math.round(
              (correct / attempts) * 100
            )
          : 0;

      setText(
        "dashboardGrammar" +
          suffix +
          "Accuracy",
        accuracy + "%"
      );

      const bar =
        document.getElementById(
          "dashboardGrammar" +
          suffix +
          "Bar"
        );

      if (bar) {
        bar.style.width =
          accuracy + "%";
      }
    });
}

function getDashboardEffectiveMode(
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

  if (
    game.practiceSource === "weak" ||
    String(game.mode || "")
      .toLowerCase() === "weak"
  ) {
    return "weak";
  }

  return String(
    game.mode || "practice"
  ).toLowerCase();
}
