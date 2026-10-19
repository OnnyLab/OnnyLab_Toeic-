import {
  auth,
  db
} from "../core/firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getGrammarChapter
} from "../core/grammar-curriculum.js";


const $ = (id) =>
  document.getElementById(id);


const ONLINE_WINDOW_MS =
  2 * 60 * 1000;

const IDLE_WINDOW_MS =
  5 * 60 * 1000;

const REVIEW_ACCURACY_THRESHOLD =
  70;

let dashboardData = {
  learners: [],
  vocabulary: [],
  grammarQuestions: [],
  histories: [],
  wordStats: []
};

let refreshTimer = null;


onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      window.location.href =
        "../index.html";

      return;
    }

    try {
      const profileSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );

      if (!profileSnapshot.exists()) {
        window.location.href =
          "../user/dashboard.html";

        return;
      }

      const profile =
        profileSnapshot.data();

      if (profile.role !== "admin") {
        window.location.href =
          "../user/dashboard.html";

        return;
      }

      if (
        profile.status ===
        "disabled"
      ) {
        await signOut(auth);

        window.location.href =
          "../index.html";

        return;
      }

      renderAdminProfile(
        user,
        profile
      );

      bindLogout();
      bindDrawer();

      await loadDashboard();

      clearInterval(refreshTimer);

      refreshTimer =
        window.setInterval(
          loadDashboard,
          60 * 1000
        );

    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );

      setText(
        "dashboardSystemStatus",
        "Dashboard data error"
      );
    }
  }
);


async function loadDashboard() {
  try {
    setText(
      "dashboardSystemStatus",
      "Syncing learning data..."
    );

    const [
      usersSnapshot,
      vocabularySnapshot,
      gameSettingsSnapshot
    ] =
      await Promise.all([
        getDocs(
          collection(
            db,
            "users"
          )
        ),
        getDocs(
          collection(
            db,
            "vocabulary"
          )
        ),
        getDocs(
          collection(
            db,
            "gameSettings"
          )
        )
      ]);

    const userRows =
      usersSnapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }));

    const learners =
      userRows.filter(
        (item) =>
          item.role !== "admin"
      );

    const vocabulary =
      vocabularySnapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }));

    const grammarQuestions =
      gameSettingsSnapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }))
        .filter(
          (item) =>
            item.type ===
            "grammarQuestion"
        );

    const learnerBundles =
      await Promise.all(
        learners.map(
          loadLearnerBundle
        )
      );

    dashboardData = {
      learners:
        learnerBundles,
      vocabulary,
      grammarQuestions,
      histories:
        learnerBundles
          .flatMap(
            (item) =>
              item.history
          ),
      wordStats:
        learnerBundles
          .flatMap(
            (item) =>
              item.wordStats
          )
    };

    renderDashboard();

    setText(
      "dashboardSystemStatus",
      "Live · Updated " +
        formatClock(
          new Date()
        )
    );

  } catch (error) {
    console.error(
      "Load dashboard error:",
      error
    );

    setText(
      "dashboardSystemStatus",
      "Unable to sync data"
    );
  }
}


async function loadLearnerBundle(
  learner
) {
  try {
    const [
      historySnapshot,
      wordStatsSnapshot
    ] =
      await Promise.all([
        getDocs(
          collection(
            db,
            "users",
            learner.id,
            "history"
          )
        ),
        getDocs(
          collection(
            db,
            "users",
            learner.id,
            "wordStats"
          )
        )
      ]);

    const history =
      historySnapshot.docs
        .map((item) => ({
          id: item.id,
          learnerId:
            learner.id,
          learnerName:
            getLearnerName(
              learner
            ),
          ...item.data()
        }))
        .sort(
          (a, b) =>
            toMillis(
              b.completedAt
            ) -
            toMillis(
              a.completedAt
            )
        );

    const wordStats =
      wordStatsSnapshot.docs
        .map((item) => ({
          id: item.id,
          learnerId:
            learner.id,
          learnerName:
            getLearnerName(
              learner
            ),
          ...item.data()
        }));

    return {
      ...learner,
      history,
      wordStats,
      performance:
        calculateLearnerPerformance(
          history
        )
    };

  } catch (error) {
    console.warn(
      "Learner bundle error:",
      learner.id,
      error
    );

    return {
      ...learner,
      history: [],
      wordStats: [],
      performance:
        calculateLearnerPerformance(
          []
        )
    };
  }
}


function renderDashboard() {
  renderGreeting();
  renderKpis();
  renderLiveUsers();
  renderActivityChart();
  renderUserPerformance();
  renderDifficultGrammar();
  renderWeakVocabulary();
  renderRecentActivity();
  renderContentHealth();
}


function renderGreeting() {
  const hour =
    new Date().getHours();

  const period =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";

  const name =
    $("adminName")
      ?.textContent
      ?.trim() ||
    "Administrator";

  setText(
    "dashboardGreeting",
    period +
      ", " +
      name +
      "."
  );
}


function renderKpis() {
  const learners =
    dashboardData.learners;

  const online =
    learners.filter(
      (item) =>
        getPresenceState(
          item
        ) === "online"
    );

  const activeToday =
    learners.filter(
      (item) =>
        isToday(
          item.lastActivityAt ||
          item.lastSeenAt
        )
    );

  const todayHistory =
    dashboardData.histories
      .filter(
        (item) =>
          isToday(
            item.completedAt
          )
      );

  const questionsToday =
    todayHistory.reduce(
      (sum, item) =>
        sum +
        number(
          item.totalQuestions
        ),
      0
    );

  const accuracy =
    calculateHistoryAccuracy(
      dashboardData.histories
    );

  const needsReview =
    learners.filter(
      (item) =>
        item.performance.sessions > 0
        &&
        item.performance.accuracy <
          REVIEW_ACCURACY_THRESHOLD
    );

  setText(
    "kpiOnlineNow",
    online.length
  );

  setText(
    "kpiOnlineNowMeta",
    online.length === 1
      ? "learner active now"
      : "learners active now"
  );

  setText(
    "kpiActiveToday",
    activeToday.length
  );

  setText(
    "kpiSessionsToday",
    todayHistory.length
  );

  setText(
    "kpiQuestionsToday",
    questionsToday
  );

  setText(
    "kpiAccuracy",
    accuracy + "%"
  );

  setText(
    "kpiNeedsReview",
    needsReview.length
  );
}


function renderLiveUsers() {
  const container =
    $("liveUsersList");

  if (!container) return;

  const learners =
    [...dashboardData.learners]
      .sort(
        comparePresence
      );

  const onlineCount =
    learners.filter(
      (item) =>
        getPresenceState(
          item
        ) === "online"
    ).length;

  setText(
    "liveUsersBadge",
    onlineCount +
      " ONLINE"
  );

  if (!learners.length) {
    container.innerHTML =
      emptyState(
        "ยังไม่มีผู้เรียนในระบบ"
      );

    return;
  }

  container.innerHTML =
    learners
      .slice(0, 7)
      .map(
        renderLiveUserRow
      )
      .join("");

  bindLearnerButtons(
    container
  );
}


function renderLiveUserRow(
  learner
) {
  const state =
    getPresenceState(
      learner
    );

  const latest =
    learner.history[0];

  const liveActivity =
    getFreshCurrentActivity(
      learner
    );

  const activity =
    liveActivity
      ? describeCurrentActivity(
          liveActivity
        )
      : latest
        ? describeHistory(
            latest
          )
        : "No practice yet";

  const score =
    liveActivity
      ? (
          "Q" +
          number(
            liveActivity.question
          ) +
          "/" +
          number(
            liveActivity.totalQuestions
          )
        )
      : latest
        ? number(
            latest.accuracy
          ) + "%"
        : "—";

  return (
    '<button class="live-user-row" type="button" data-learner-id="' +
      escapeAttribute(
        learner.id
      ) +
    '">' +
      '<span class="presence-dot ' +
        state +
      '"></span>' +
      '<span class="live-user-avatar">' +
        escapeHtml(
          getLearnerInitial(
            learner
          )
        ) +
      '</span>' +
      '<span class="live-user-copy">' +
        '<strong>' +
          escapeHtml(
            getLearnerName(
              learner
            )
          ) +
        '</strong>' +
        '<small>' +
          escapeHtml(
            activity
          ) +
        '</small>' +
      '</span>' +
      '<span class="live-user-score">' +
        '<b>' +
          score +
        '</b>' +
        '<small>' +
          escapeHtml(
            formatPresenceText(
              learner
            )
          ) +
        '</small>' +
      '</span>' +
    '</button>'
  );
}


function renderActivityChart() {
  const container =
    $("learningActivityChart");

  if (!container) return;

  const days =
    getLastDays(7);

  const rows =
    days.map(
      (day) => {
        const dayHistory =
          dashboardData.histories
            .filter(
              (item) =>
                getDateId(
                  item.completedAt
                ) ===
                day.id
            );

        const grammar =
          dayHistory.filter(
            isGrammarHistory
          ).length;

        const vocabulary =
          dayHistory.length -
          grammar;

        return {
          ...day,
          grammar,
          vocabulary,
          total:
            grammar +
            vocabulary
        };
      }
    );

  const max =
    Math.max(
      1,
      ...rows.map(
        (item) =>
          item.total
      )
    );

  container.innerHTML =
    '<div class="activity-legend">' +
      '<span><i class="vocab"></i>Vocabulary</span>' +
      '<span><i class="grammar"></i>Grammar</span>' +
    '</div>' +
    '<div class="activity-bars">' +
      rows.map(
        (item) =>
          '<div class="activity-day">' +
            '<div class="activity-bar-stack" title="' +
              item.total +
              ' sessions">' +
              '<i class="grammar" style="height:' +
                Math.round(
                  (
                    item.grammar /
                    max
                  ) * 100
                ) +
              '%"></i>' +
              '<i class="vocab" style="height:' +
                Math.round(
                  (
                    item.vocabulary /
                    max
                  ) * 100
                ) +
              '%"></i>' +
            '</div>' +
            '<b>' +
              item.total +
            '</b>' +
            '<span>' +
              item.label +
            '</span>' +
          '</div>'
      ).join("") +
    '</div>';
}


function renderUserPerformance() {
  const container =
    $("userPerformanceList");

  if (!container) return;

  const rows =
    [...dashboardData.learners]
      .sort(
        (a, b) =>
          b.performance.sessions -
          a.performance.sessions
      )
      .slice(
        0,
        6
      );

  if (!rows.length) {
    container.innerHTML =
      emptyState(
        "ยังไม่มีข้อมูลการฝึก"
      );

    return;
  }

  container.innerHTML =
    rows.map(
      (learner) => {
        const p =
          learner.performance;

        return (
          '<button class="user-performance-row" type="button" data-learner-id="' +
            escapeAttribute(
              learner.id
            ) +
          '">' +
            '<span class="performance-avatar">' +
              escapeHtml(
                getLearnerInitial(
                  learner
                )
              ) +
            '</span>' +
            '<span class="performance-copy">' +
              '<strong>' +
                escapeHtml(
                  getLearnerName(
                    learner
                  )
                ) +
              '</strong>' +
              '<small>' +
                p.sessions +
                ' sessions · ' +
                p.questions +
                ' questions' +
              '</small>' +
            '</span>' +
            '<span class="performance-bar">' +
              '<i style="width:' +
                p.accuracy +
              '%"></i>' +
            '</span>' +
            '<b>' +
              p.accuracy +
              '%' +
            '</b>' +
          '</button>'
        );
      }
    ).join("");

  bindLearnerButtons(
    container
  );
}


function renderDifficultGrammar() {
  const container =
    $("difficultGrammarList");

  if (!container) return;

  const map =
    new Map();

  dashboardData.wordStats
    .filter(
      (item) =>
        item.kind === "grammar"
    )
    .forEach(
      (item) => {
        const key =
          item.topic ||
          item.chapterTitle ||
          "Grammar";

        const current =
          map.get(key) ||
          {
            label: key,
            attempts: 0,
            correct: 0
          };

        current.attempts +=
          number(
            item.attempts
          );

        current.correct +=
          number(
            item.correct
          );

        map.set(
          key,
          current
        );
      }
    );

  const rows =
    [...map.values()]
      .filter(
        (item) =>
          item.attempts >= 2
      )
      .map(
        (item) => ({
          ...item,
          accuracy:
            item.attempts > 0
              ? Math.round(
                  (
                    item.correct /
                    item.attempts
                  ) * 100
                )
              : 0
        })
      )
      .sort(
        (a, b) =>
          a.accuracy -
          b.accuracy
      )
      .slice(
        0,
        6
      );

  renderDifficultyRows(
    container,
    rows,
    "ยังไม่มี Grammar stats"
  );
}


function renderWeakVocabulary() {
  const container =
    $("weakVocabularyList");

  if (!container) return;

  const map =
    new Map();

  dashboardData.wordStats
    .filter(
      (item) =>
        item.kind !== "grammar"
    )
    .forEach(
      (item) => {
        const key =
          item.word ||
          item.wordText ||
          item.id ||
          "Word";

        const current =
          map.get(key) ||
          {
            label: key,
            attempts: 0,
            correct: 0
          };

        current.attempts +=
          number(
            item.attempts
          );

        current.correct +=
          number(
            item.correct
          );

        map.set(
          key,
          current
        );
      }
    );

  const rows =
    [...map.values()]
      .filter(
        (item) =>
          item.attempts >= 2
      )
      .map(
        (item) => ({
          ...item,
          accuracy:
            item.attempts > 0
              ? Math.round(
                  (
                    item.correct /
                    item.attempts
                  ) * 100
                )
              : 0
        })
      )
      .sort(
        (a, b) =>
          a.accuracy -
          b.accuracy
      )
      .slice(
        0,
        6
      );

  renderDifficultyRows(
    container,
    rows,
    "ยังไม่มี Vocabulary stats"
  );
}


function renderDifficultyRows(
  container,
  rows,
  emptyMessage
) {
  if (!rows.length) {
    container.innerHTML =
      emptyState(
        emptyMessage
      );

    return;
  }

  container.innerHTML =
    rows.map(
      (item, index) =>
        '<div class="difficulty-row">' +
          '<span class="difficulty-rank">' +
            (index + 1) +
          '</span>' +
          '<span class="difficulty-copy">' +
            '<strong>' +
              escapeHtml(
                item.label
              ) +
            '</strong>' +
            '<small>' +
              item.attempts +
              ' attempts' +
            '</small>' +
          '</span>' +
          '<span class="difficulty-meter">' +
            '<i style="width:' +
              item.accuracy +
            '%"></i>' +
          '</span>' +
          '<b>' +
            item.accuracy +
            '%' +
          '</b>' +
        '</div>'
    ).join("");
}


function renderRecentActivity() {
  const container =
    $("recentActivityList");

  if (!container) return;

  const rows =
    [...dashboardData.histories]
      .sort(
        (a, b) =>
          toMillis(
            b.completedAt
          ) -
          toMillis(
            a.completedAt
          )
      )
      .slice(
        0,
        9
      );

  setText(
    "recentActivityMeta",
    rows.length +
      " latest sessions"
  );

  if (!rows.length) {
    container.innerHTML =
      emptyState(
        "ยังไม่มี Practice history"
      );

    return;
  }

  container.innerHTML =
    rows.map(
      (item) =>
        '<button class="recent-activity-row" type="button" data-learner-id="' +
          escapeAttribute(
            item.learnerId
          ) +
        '">' +
          '<span class="recent-mode-icon ' +
            (
              isGrammarHistory(
                item
              )
                ? "grammar"
                : "vocab"
            ) +
          '">' +
            (
              isGrammarHistory(
                item
              )
                ? "Gr"
                : "Aa"
            ) +
          '</span>' +
          '<span class="recent-copy">' +
            '<strong>' +
              escapeHtml(
                item.learnerName ||
                "Learner"
              ) +
            '</strong>' +
            '<small>' +
              escapeHtml(
                describeHistory(
                  item
                )
              ) +
            '</small>' +
          '</span>' +
          '<span class="recent-score">' +
            '<b>' +
              number(
                item.correct
              ) +
              '/' +
              number(
                item.totalQuestions
              ) +
            '</b>' +
            '<small>' +
              number(
                item.accuracy
              ) +
              '% · ' +
              formatRelativeTime(
                item.completedAt
              ) +
            '</small>' +
          '</span>' +
        '</button>'
    ).join("");

  bindLearnerButtons(
    container
  );
}


function renderContentHealth() {
  const vocabulary =
    dashboardData.vocabulary;

  const grammar =
    dashboardData.grammarQuestions;

  const activeVocabulary =
    vocabulary.filter(
      (item) =>
        item.active !== false
    ).length;

  const activeGrammar =
    grammar.filter(
      (item) =>
        item.active !== false
    );

  const chapterIds =
    new Set(
      activeGrammar
        .map(
          (item) =>
            item.chapterId
        )
        .filter(Boolean)
    );

  setText(
    "contentVocabularyCount",
    vocabulary.length
  );

  setText(
    "contentVocabularyMeta",
    activeVocabulary +
      " active words"
  );

  setText(
    "contentGrammarCount",
    grammar.length
  );

  setText(
    "contentGrammarMeta",
    activeGrammar.length +
      " active questions"
  );

  setText(
    "contentGrammarChapters",
    chapterIds.size +
      " / 16"
  );

  setText(
    "contentUsersCount",
    dashboardData.learners.length
  );
}


function openLearnerDrawer(
  learnerId
) {
  const learner =
    dashboardData.learners
      .find(
        (item) =>
          item.id === learnerId
      );

  if (!learner) return;

  const drawer =
    $("learnerDrawer");

  const backdrop =
    $("learnerDrawerBackdrop");

  const content =
    $("learnerDrawerContent");

  if (
    !drawer ||
    !backdrop ||
    !content
  ) {
    return;
  }

  content.innerHTML =
    renderLearnerDetail(
      learner
    );

  backdrop.hidden = false;

  drawer.classList.add(
    "open"
  );

  drawer.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "learner-drawer-open"
  );
}


function renderLearnerDetail(
  learner
) {
  const p =
    learner.performance;

  const currentActivity =
    getFreshCurrentActivity(
      learner
    );

  const latestHistory =
    learner.history
      .slice(
        0,
        8
      );

  const grammarStats =
    learner.wordStats
      .filter(
        (item) =>
          item.kind === "grammar"
      )
      .sort(
        (a, b) =>
          number(a.accuracy) -
          number(b.accuracy)
      )
      .slice(
        0,
        6
      );

  const weakWords =
    learner.wordStats
      .filter(
        (item) =>
          item.kind !== "grammar"
          &&
          number(
            item.attempts
          ) >= 2
      )
      .sort(
        (a, b) =>
          calculateStatAccuracy(a) -
          calculateStatAccuracy(b)
      )
      .slice(
        0,
        6
      );

  return (
    '<section class="learner-detail-head">' +
      '<span class="presence-dot ' +
        getPresenceState(
          learner
        ) +
      '"></span>' +
      '<div class="learner-detail-avatar">' +
        escapeHtml(
          getLearnerInitial(
            learner
          )
        ) +
      '</div>' +
      '<div>' +
        '<span>LEARNER PROFILE</span>' +
        '<h2>' +
          escapeHtml(
            getLearnerName(
              learner
            )
          ) +
        '</h2>' +
        '<p>' +
          escapeHtml(
            learner.email || ""
          ) +
        '</p>' +
      '</div>' +
    '</section>' +

    '<div class="learner-presence-line">' +
      '<strong>' +
        escapeHtml(
          capitalize(
            getPresenceState(
              learner
            )
          )
        ) +
      '</strong>' +
      '<span>' +
        escapeHtml(
          formatPresenceText(
            learner
          )
        ) +
      '</span>' +
    '</div>' +

    (
      currentActivity
        ? (
            '<section class="learner-current-activity">' +
              '<span>CURRENTLY PRACTICING</span>' +
              '<strong>' +
                escapeHtml(
                  describeCurrentActivity(
                    currentActivity
                  )
                ) +
              '</strong>' +
              '<small>' +
                'Question ' +
                number(
                  currentActivity.question
                ) +
                ' / ' +
                number(
                  currentActivity.totalQuestions
                ) +
                ' · ' +
                number(
                  currentActivity.correct
                ) +
                ' correct · ' +
                number(
                  currentActivity.wrong
                ) +
                ' wrong' +
              '</small>' +
            '</section>'
          )
        : ""
    ) +

    '<section class="learner-detail-kpis">' +
      drawerKpi(
        p.sessions,
        "Sessions"
      ) +
      drawerKpi(
        p.questions,
        "Questions"
      ) +
      drawerKpi(
        p.accuracy + "%",
        "Accuracy"
      ) +
      drawerKpi(
        p.grammarAccuracy + "%",
        "Grammar"
      ) +
    '</section>' +

    '<section class="learner-detail-section">' +
      '<div class="drawer-section-head">' +
        '<span>PERFORMANCE</span>' +
        '<h3>Vocabulary vs Grammar</h3>' +
      '</div>' +
      renderPerformanceCompare(
        p
      ) +
    '</section>' +

    '<section class="learner-detail-section">' +
      '<div class="drawer-section-head">' +
        '<span>GRAMMAR REVIEW</span>' +
        '<h3>Weak grammar topics</h3>' +
      '</div>' +
      (
        grammarStats.length
          ? grammarStats.map(
              (item) =>
                drawerStatRow(
                  item.topic ||
                  item.chapterTitle ||
                  "Grammar",
                  number(
                    item.attempts
                  ),
                  calculateStatAccuracy(
                    item
                  )
                )
            ).join("")
          : emptyState(
              "ยังไม่มี Grammar stats"
            )
      ) +
    '</section>' +

    '<section class="learner-detail-section">' +
      '<div class="drawer-section-head">' +
        '<span>VOCABULARY REVIEW</span>' +
        '<h3>Weak vocabulary</h3>' +
      '</div>' +
      (
        weakWords.length
          ? weakWords.map(
              (item) =>
                drawerStatRow(
                  item.word ||
                  item.wordText ||
                  item.id,
                  number(
                    item.attempts
                  ),
                  calculateStatAccuracy(
                    item
                  )
                )
            ).join("")
          : emptyState(
              "ยังไม่มี Weak vocabulary"
            )
      ) +
    '</section>' +

    '<section class="learner-detail-section">' +
      '<div class="drawer-section-head">' +
        '<span>RECENT HISTORY</span>' +
        '<h3>Latest practice sessions</h3>' +
      '</div>' +
      (
        latestHistory.length
          ? latestHistory.map(
              (item) =>
                '<div class="drawer-history-row">' +
                  '<div>' +
                    '<strong>' +
                      escapeHtml(
                        describeHistory(
                          item
                        )
                      ) +
                    '</strong>' +
                    '<small>' +
                      formatDateTime(
                        item.completedAt
                      ) +
                    '</small>' +
                  '</div>' +
                  '<b>' +
                    number(
                      item.correct
                    ) +
                    '/' +
                    number(
                      item.totalQuestions
                    ) +
                    ' · ' +
                    number(
                      item.accuracy
                    ) +
                    '%' +
                  '</b>' +
                '</div>'
            ).join("")
          : emptyState(
              "ยังไม่มี History"
            )
      ) +
    '</section>'
  );
}


function renderPerformanceCompare(
  performance
) {
  return (
    '<div class="drawer-performance-row">' +
      '<span>Vocabulary</span>' +
      '<div><i style="width:' +
        performance.vocabularyAccuracy +
      '%"></i></div>' +
      '<b>' +
        performance.vocabularyAccuracy +
        '%' +
      '</b>' +
    '</div>' +
    '<div class="drawer-performance-row">' +
      '<span>Grammar</span>' +
      '<div><i style="width:' +
        performance.grammarAccuracy +
      '%"></i></div>' +
      '<b>' +
        performance.grammarAccuracy +
        '%' +
      '</b>' +
    '</div>'
  );
}


function drawerKpi(
  value,
  label
) {
  return (
    '<div>' +
      '<strong>' +
        escapeHtml(value) +
      '</strong>' +
      '<span>' +
        escapeHtml(label) +
      '</span>' +
    '</div>'
  );
}


function drawerStatRow(
  label,
  attempts,
  accuracy
) {
  return (
    '<div class="drawer-stat-row">' +
      '<div>' +
        '<strong>' +
          escapeHtml(
            label
          ) +
        '</strong>' +
        '<small>' +
          attempts +
          ' attempts' +
        '</small>' +
      '</div>' +
      '<span><i style="width:' +
        accuracy +
      '%"></i></span>' +
      '<b>' +
        accuracy +
        '%' +
      '</b>' +
    '</div>'
  );
}


function closeLearnerDrawer() {
  const drawer =
    $("learnerDrawer");

  const backdrop =
    $("learnerDrawerBackdrop");

  if (drawer) {
    drawer.classList.remove(
      "open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  if (backdrop) {
    backdrop.hidden = true;
  }

  document.body.classList.remove(
    "learner-drawer-open"
  );
}


function bindDrawer() {
  $("learnerDrawerClose")
    ?.addEventListener(
      "click",
      closeLearnerDrawer
    );

  $("learnerDrawerBackdrop")
    ?.addEventListener(
      "click",
      closeLearnerDrawer
    );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeLearnerDrawer();
      }
    }
  );
}


function bindLearnerButtons(
  container
) {
  container
    .querySelectorAll(
      "[data-learner-id]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openLearnerDrawer(
              button.dataset
                .learnerId
            );
          }
        );
      }
    );
}


function calculateLearnerPerformance(
  history
) {
  const vocabulary =
    history.filter(
      (item) =>
        !isGrammarHistory(
          item
        )
    );

  const grammar =
    history.filter(
      isGrammarHistory
    );

  const sessions =
    history.length;

  const questions =
    history.reduce(
      (sum, item) =>
        sum +
        number(
          item.totalQuestions
        ),
      0
    );

  return {
    sessions,
    questions,
    accuracy:
      calculateHistoryAccuracy(
        history
      ),
    vocabularySessions:
      vocabulary.length,
    grammarSessions:
      grammar.length,
    vocabularyAccuracy:
      calculateHistoryAccuracy(
        vocabulary
      ),
    grammarAccuracy:
      calculateHistoryAccuracy(
        grammar
      )
  };
}


function calculateHistoryAccuracy(
  history
) {
  const questions =
    history.reduce(
      (sum, item) =>
        sum +
        number(
          item.totalQuestions
        ),
      0
    );

  const correct =
    history.reduce(
      (sum, item) =>
        sum +
        number(
          item.correct
        ),
      0
    );

  return questions > 0
    ? Math.round(
        (
          correct /
          questions
        ) * 100
      )
    : 0;
}


function calculateStatAccuracy(
  stat
) {
  if (
    Number.isFinite(
      Number(
        stat?.accuracy
      )
    )
  ) {
    return Math.round(
      Number(
        stat.accuracy
      )
    );
  }

  const attempts =
    number(
      stat?.attempts
    );

  return attempts > 0
    ? Math.round(
        (
          number(
            stat?.correct
          ) /
          attempts
        ) * 100
      )
    : 0;
}



function getFreshCurrentActivity(
  learner
) {
  const activity =
    learner?.currentActivity;

  if (
    !activity ||
    activity.active !== true
  ) {
    return null;
  }

  const age =
    Date.now() -
    toMillis(
      learner.currentActivityAt ||
      learner.lastActivityAt
    );

  if (
    !Number.isFinite(age) ||
    age > IDLE_WINDOW_MS
  ) {
    return null;
  }

  return activity;
}


function describeCurrentActivity(
  activity
) {
  if (
    activity.type === "grammar"
  ) {
    const mode =
      {
        part5:
          "TOEIC Part 5",
        tenses:
          "TOEIC Part 5",
        fill:
          "Fill in the Blank",
        error:
          "Error Detection",
        sentence:
          "Sentence Building"
      }[
        activity.mode
      ] ||
      activity.modeLabel ||
      "Grammar";

    const chapter =
      activity.chapterTitle ||
      activity.topic ||
      "";

    return chapter
      ? mode + " · " + chapter
      : mode;
  }

  if (
    activity.type === "vocabulary"
  ) {
    const mode =
      {
        translation:
          "Vocabulary · Translation",
        meaning:
          "Vocabulary · Meaning",
        synonym:
          "Vocabulary · Synonym",
        review:
          "Vocabulary · Review",
        weak:
          "Vocabulary · Review"
      }[
        String(
          activity.mode || ""
        ).toLowerCase()
      ] ||
      "Vocabulary Practice";

    return mode;
  }

  return "Learning activity";
}

function describeHistory(
  item
) {
  if (
    isGrammarHistory(
      item
    )
  ) {
    const mode =
      {
        part5:
          "TOEIC Part 5",
        tenses:
          "TOEIC Part 5",
        fill:
          "Fill in the Blank",
        error:
          "Error Detection",
        sentence:
          "Sentence Building"
      }[
        item.grammarMode
      ] ||
      "Grammar";

    const chapter =
      item.chapterTitle ||
      (
        item.chapterId
          ? getGrammarChapter(
              item.chapterId
            )?.shortTitle
          : ""
      ) ||
      (
        item.topic !== "Mixed"
          ? item.topic
          : ""
      );

    return chapter
      ? mode +
          " · " +
          chapter
      : mode;
  }

  const mode =
    {
      translation:
        "Vocabulary · Translation",
      meaning:
        "Vocabulary · Meaning",
      synonym:
        "Vocabulary · Synonym",
      weak:
        "Vocabulary · Review"
    }[
      String(
        item.mode || ""
      ).toLowerCase()
    ] ||
    "Vocabulary Practice";

  return item.practiceSource ===
    "weak"
      ? "Vocabulary · Review"
      : mode;
}


function isGrammarHistory(
  item
) {
  return (
    item?.practiceType ===
      "grammar"
    ||
    String(
      item?.displayMode || ""
    ).startsWith(
      "grammar-"
    )
  );
}


function getPresenceState(
  learner
) {
  if (
    learner.status ===
    "disabled"
  ) {
    return "offline";
  }

  const lastSeen =
    toMillis(
      learner.lastSeenAt ||
      learner.lastActivityAt
    );

  if (!lastSeen) {
    return "offline";
  }

  const age =
    Date.now() -
    lastSeen;

  if (
    learner.isOnline === true
    &&
    age <=
      ONLINE_WINDOW_MS
  ) {
    return "online";
  }

  if (
    age <=
    IDLE_WINDOW_MS
  ) {
    return "idle";
  }

  return "offline";
}


function comparePresence(
  a,
  b
) {
  const rank = {
    online: 0,
    idle: 1,
    offline: 2
  };

  const stateDiff =
    rank[
      getPresenceState(a)
    ] -
    rank[
      getPresenceState(b)
    ];

  if (stateDiff !== 0) {
    return stateDiff;
  }

  return (
    toMillis(
      b.lastSeenAt ||
      b.lastActivityAt
    ) -
    toMillis(
      a.lastSeenAt ||
      a.lastActivityAt
    )
  );
}


function formatPresenceText(
  learner
) {
  const state =
    getPresenceState(
      learner
    );

  if (state === "online") {
    return "Online now";
  }

  if (state === "idle") {
    return "Idle · " +
      formatRelativeTime(
        learner.lastSeenAt ||
        learner.lastActivityAt
      );
  }

  const source =
    learner.lastSeenAt ||
    learner.lastActivityAt;

  return source
    ? "Last seen " +
        formatRelativeTime(
          source
        )
    : "Never active";
}


function getLearnerName(
  learner
) {
  return (
    learner.displayName ||
    learner.email ||
    "Learner"
  );
}


function getLearnerInitial(
  learner
) {
  return getLearnerName(
    learner
  )
    .trim()
    .charAt(0)
    .toUpperCase() ||
    "U";
}


function getLastDays(
  count
) {
  const rows = [];

  for (
    let i = count - 1;
    i >= 0;
    i -= 1
  ) {
    const date =
      new Date();

    date.setHours(
      0,
      0,
      0,
      0
    );

    date.setDate(
      date.getDate() - i
    );

    rows.push({
      id:
        localDateId(
          date
        ),
      label:
        date.toLocaleDateString(
          "en-US",
          {
            weekday:
              "short"
          }
        )
    });
  }

  return rows;
}


function isToday(
  value
) {
  const date =
    toDate(
      value
    );

  if (!date) return false;

  return (
    localDateId(
      date
    ) ===
    localDateId(
      new Date()
    )
  );
}


function getDateId(
  value
) {
  const date =
    toDate(
      value
    );

  return date
    ? localDateId(
        date
      )
    : "";
}


function localDateId(
  date
) {
  const y =
    date.getFullYear();

  const m =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const d =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    y +
    "-" +
    m +
    "-" +
    d
  );
}


function toDate(
  value
) {
  if (!value) return null;

  if (
    value instanceof Date
  ) {
    return value;
  }

  if (
    typeof value?.toDate ===
    "function"
  ) {
    return value.toDate();
  }

  if (
    typeof value?.toMillis ===
    "function"
  ) {
    return new Date(
      value.toMillis()
    );
  }

  if (
    typeof value ===
    "number"
  ) {
    return new Date(
      value
    );
  }

  if (
    typeof value ===
    "string"
  ) {
    const parsed =
      new Date(value);

    return Number.isNaN(
      parsed.getTime()
    )
      ? null
      : parsed;
  }

  if (
    typeof value ===
      "object"
    &&
    typeof value.seconds ===
      "number"
  ) {
    return new Date(
      value.seconds *
      1000
    );
  }

  return null;
}


function toMillis(
  value
) {
  const date =
    toDate(
      value
    );

  return date
    ? date.getTime()
    : 0;
}


function formatRelativeTime(
  value
) {
  const time =
    toMillis(
      value
    );

  if (!time) {
    return "—";
  }

  const diff =
    Math.max(
      0,
      Date.now() -
      time
    );

  const minutes =
    Math.floor(
      diff /
      60000
    );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return (
      minutes +
      "m ago"
    );
  }

  const hours =
    Math.floor(
      minutes /
      60
    );

  if (hours < 24) {
    return (
      hours +
      "h ago"
    );
  }

  const days =
    Math.floor(
      hours /
      24
    );

  return (
    days +
    "d ago"
  );
}


function formatDateTime(
  value
) {
  const date =
    toDate(
      value
    );

  if (!date) return "—";

  return date.toLocaleString(
    "th-TH",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short"
    }
  );
}


function formatClock(
  date
) {
  return date.toLocaleTimeString(
    "th-TH",
    {
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  );
}


function renderAdminProfile(
  user,
  profile
) {
  const name =
    profile.displayName ||
    user.displayName ||
    "Administrator";

  setText(
    "adminName",
    name
  );

  setText(
    "adminEmail",
    profile.email ||
    user.email ||
    ""
  );

  setText(
    "adminAvatar",
    name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "A"
  );
}


function bindLogout() {
  const button =
    $("logoutBtn");

  if (!button) return;

  button.addEventListener(
    "click",
    async () => {
      clearInterval(
        refreshTimer
      );

      await signOut(
        auth
      );

      window.location.href =
        "../index.html";
    }
  );
}


function setText(
  id,
  value
) {
  const element =
    $(id);

  if (element) {
    element.textContent =
      value;
  }
}


function emptyState(
  message
) {
  return (
    '<div class="admin-dashboard-empty">' +
      escapeHtml(
        message
      ) +
    '</div>'
  );
}


function number(
  value
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function capitalize(
  value
) {
  const text =
    String(value || "");

  return text
    ? text.charAt(0)
        .toUpperCase() +
      text.slice(1)
    : "";
}


function escapeHtml(
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


function escapeAttribute(
  value
) {
  return escapeHtml(
    value
  );
}
