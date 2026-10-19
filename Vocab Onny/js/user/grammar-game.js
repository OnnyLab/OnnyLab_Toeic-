import {
  requireUserPage
} from "../core/auth.js";

import {
  db
} from "../core/firebase.js";

import {
  saveLastResult,
  getLastResult
} from "../core/transient-storage.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getGrammarQuestions,
  getGrammarStatsCloud,
  recordGrammarAttemptCloud
} from "../core/grammar-data.js?v=20261002-1";

import {
  getGrammarChapter,
  inferGrammarChapterId
} from "../core/grammar-curriculum.js";

import {
  saveGameHistoryCloud,
  recordDailyGameCloud
} from "../core/cloud-data.js";

import {
  setCurrentActivity,
  clearCurrentActivity
} from "../core/current-activity.js";

const MODE_INFO = {
  part5: {
    label: "TOEIC Part 5",
    historyMode: "grammar-part5"
  },
  fill: {
    label: "Fill in the Blank",
    historyMode: "grammar-fill"
  },
  error: {
    label: "Error Detection",
    historyMode: "grammar-error"
  },
  sentence: {
    label: "Sentence Building",
    historyMode: "grammar-sentence"
  }
};

let uid = "";
let mode = "part5";
let requestedTopic = "";
let requestedChapter = "";
let requestedSource = "all";
const DEFAULT_GRAMMAR_SETTINGS = {
  enabled: true,
  timePerQuestion: 30,
  questionsPerGame: 10,
  shuffleQuestions: true,
  showExplanation: true,
  wrongLimitEnabled: false,
  maxWrong: 5
};



const DEFAULT_GLOBAL_SETTINGS = {
  wrongFeedbackEnabled: true,
  wrongFeedbackImageEnabled: false,
  wrongFeedbackImage: "",
  wrongFeedbackSoundEnabled: false,
  wrongFeedbackSoundUrl: "../assets/sound/moo.mp3",
  wrongFeedbackDuration: 1200
};

let questions = [];
let index = 0;
let correct = 0;
let wrong = 0;
let timeout = 0;
let score = 0;
let locked = false;
let startedAt = Date.now();
let questionStartedAt = 0;
let questionElapsedBeforePauseMs = 0;
let totalResponseTimeMs = 0;
let timerInterval = null;
let timeRemaining = 0;
let gameFinishing = false;
let grammarPaused = false;
let grammarPauseUsed = false;
let grammarSettings = {
  ...DEFAULT_GRAMMAR_SETTINGS
};
let globalSettings = {
  ...DEFAULT_GLOBAL_SETTINGS
};
let stoppedByWrongLimit = false;
let mistakeQuestions = [];

const ACTIVE_GRAMMAR_SESSION_PREFIX =
  "vocabOnnyActiveGrammarSession:";

let grammarStatsCloudQueue =
  Promise.resolve();

const GRAMMAR_STAT_SYNC_RETRIES = 2;
const GRAMMAR_STAT_RETRY_DELAY_MS = 350;

function waitForGrammarCloudRetry(
  delayMs
) {
  return new Promise(
    (resolve) =>
      window.setTimeout(
        resolve,
        delayMs
      )
  );
}

async function recordGrammarAttemptWithRetry(
  payload
) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt <=
      GRAMMAR_STAT_SYNC_RETRIES;
    attempt += 1
  ) {
    try {
      return await recordGrammarAttemptCloud(
        uid,
        payload
      );
    } catch (error) {
      lastError = error;

      if (
        attempt <
        GRAMMAR_STAT_SYNC_RETRIES
      ) {
        await waitForGrammarCloudRetry(
          GRAMMAR_STAT_RETRY_DELAY_MS *
          (attempt + 1)
        );
      }
    }
  }

  throw lastError;
}

function queueGrammarAttempt(
  payload
) {
  grammarStatsCloudQueue =
    grammarStatsCloudQueue
      .catch(function(error) {
        console.warn(
          "Previous Grammar Stat write failed:",
          error
        );
      })
      .then(function() {
        return recordGrammarAttemptWithRetry(
          payload
        );
      });

  return grammarStatsCloudQueue;
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const context = await requireUserPage({
    loginPath: "../index.html",
    adminPath: "../admin/index.html"
  });

  if (!context) return;

  uid = context.user.uid;

  setupGrammarGameControls();

  const params = new URLSearchParams(
    window.location.search
  );

  const requestedMode =
    String(params.get("mode") || "part5")
      .toLowerCase();

  mode = MODE_INFO[requestedMode]
    ? requestedMode
    : "part5";

  requestedTopic =
    String(
      params.get("topic") || ""
    ).trim();

  requestedChapter =
    String(
      params.get("chapter") || ""
    ).trim();

  requestedSource =
    String(
      params.get("source") || "all"
    )
      .trim()
      .toLowerCase();

  renderModeShell();

  [
    grammarSettings,
    globalSettings
  ] =
    await Promise.all([
      loadGrammarModeSettings(
        mode
      ),
      loadGlobalSettings()
    ]);

  if (
    grammarSettings.enabled ===
    false
  ) {
    renderDisabledMode();
    return;
  }

  await loadQuestions();
}


async function loadGrammarModeSettings(
  selectedMode
) {
  const id =
    "grammar-" +
    selectedMode;

  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "gameSettings",
          id
        )
      );

    return {
      ...DEFAULT_GRAMMAR_SETTINGS,
      timePerQuestion: ({
        part5: 30,
        fill: 30,
        error: 40,
        sentence: 60
      })[selectedMode] || 30,
      ...(
        snapshot.exists()
          ? snapshot.data()
          : {}
      )
    };
  } catch (error) {
    console.warn(
      "Using default grammar settings:",
      error
    );

    return {
      ...DEFAULT_GRAMMAR_SETTINGS,
      timePerQuestion: ({
        part5: 30,
        fill: 30,
        error: 40,
        sentence: 60
      })[selectedMode] || 30
    };
  }
}


async function loadGlobalSettings() {
  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "gameSettings",
          "global"
        )
      );

    return {
      ...DEFAULT_GLOBAL_SETTINGS,
      ...(
        snapshot.exists()
          ? snapshot.data()
          : {}
      )
    };
  } catch (error) {
    console.warn(
      "Using default global settings:",
      error
    );

    return {
      ...DEFAULT_GLOBAL_SETTINGS
    };
  }
}


function renderDisabledMode() {
  updateProgress(0, 0);

  setTextById(
    "grammarModeQuestionCount",
    "—"
  );

  getArea().innerHTML =
    '<article class="grammar-empty-card">' +
      '<span class="grammar-mode-pill">GRAMMAR</span>' +
      '<h1>โหมดนี้ถูกปิดชั่วคราว</h1>' +
      '<p>ผู้ดูแลระบบปิดการใช้งานโหมดนี้อยู่ กรุณาเลือกโหมดอื่น</p>' +
      '<a class="grammar-next" href="./practice.html#grammar-practice">กลับหน้า Grammar Practice</a>' +
    '</article>';
}


function getActiveGrammarSessionKey() {
  return (
    ACTIVE_GRAMMAR_SESSION_PREFIX +
    uid +
    ":" +
    mode +
    ":" +
    (requestedChapter || "mixed") +
    ":" +
    (requestedTopic || "all") +
    ":" +
    requestedSource
  );
}

function saveActiveGrammarSession(
  nextIndex = index
) {
  if (
    !uid ||
    !Array.isArray(questions) ||
    questions.length === 0 ||
    gameFinishing
  ) {
    return;
  }

  const payload = {
    uid,
    mode,
    requestedChapter,
    requestedTopic,
    requestedSource,
    questions,
    index:
      Math.max(
        0,
        Math.min(
          nextIndex,
          questions.length
        )
      ),
    correct,
    wrong,
    timeout,
    score,
    totalResponseTimeMs,
    mistakeQuestions,
    startedAt,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(
      getActiveGrammarSessionKey(),
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn(
      "Could not save active Grammar session:",
      error
    );
  }
}

function loadActiveGrammarSession() {
  try {
    const raw =
      localStorage.getItem(
        getActiveGrammarSessionKey()
      );

    if (!raw) return null;

    const payload =
      JSON.parse(raw);

    const fresh =
      Number(payload?.savedAt || 0) >
      Date.now() -
      12 * 60 * 60 * 1000;

    const valid =
      payload?.uid === uid &&
      payload?.mode === mode &&
      payload?.requestedChapter ===
        requestedChapter &&
      payload?.requestedTopic ===
        requestedTopic &&
      payload?.requestedSource ===
        requestedSource &&
      Array.isArray(
        payload?.questions
      ) &&
      payload.questions.length > 0 &&
      fresh;

    if (!valid) {
      clearActiveGrammarSession();
      return null;
    }

    return payload;
  } catch (error) {
    console.warn(
      "Could not restore active Grammar session:",
      error
    );
    return null;
  }
}

function clearActiveGrammarSession() {
  try {
    localStorage.removeItem(
      getActiveGrammarSessionKey()
    );
  } catch (error) {}
}

function loadGrammarMistakeQuestions() {
  if (
    requestedSource !==
    "mistakes"
  ) {
    return [];
  }

  try {
    const rows =
      JSON.parse(
        sessionStorage.getItem(
          "vocabOnnyGrammarMistakeQuestions"
        ) || "[]"
      );

    return Array.isArray(rows)
      ? rows
      : [];
  } catch (error) {
    return [];
  }
}


function getGrammarMasteryStatus(
  stat = {}
) {
  const attempts =
    Number(stat.attempts || 0);

  const accuracy =
    Number(stat.accuracy || 0);

  const mistakes =
    Number(stat.wrong || 0) +
    Number(stat.timeout || 0);

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

function getGrammarAdaptiveScore(
  question,
  statsMap
) {
  const chapterId =
    question.chapterId ||
    inferGrammarChapterId(
      question.topic || ""
    );

  const topic =
    String(
      question.topic || ""
    )
      .trim()
      .toLowerCase();

  const matches =
    Object.values(
      statsMap || {}
    )
      .filter(function (stat) {
        const statMode =
          String(
            stat.mode ||
            stat.grammarMode ||
            ""
          )
            .trim()
            .toLowerCase();

        const sameMode =
          statMode === mode ||
          (
            mode === "part5" &&
            statMode === "tenses"
          );

        const sameChapter =
          !chapterId ||
          !stat.chapterId ||
          stat.chapterId ===
            chapterId;

        const sameTopic =
          !topic ||
          !stat.topic ||
          String(stat.topic)
            .trim()
            .toLowerCase() ===
            topic;

        return (
          sameMode &&
          sameChapter &&
          sameTopic
        );
      });

  if (!matches.length) {
    return 38 +
      Math.random() * 10;
  }

  const stat =
    matches[0];

  const status =
    getGrammarMasteryStatus(
      stat
    );

  const accuracy =
    Number(stat.accuracy || 0);

  const statusWeight = {
    weak: 70,
    learning: 48,
    new: 38,
    familiar: 22,
    mastered: 5
  }[status] || 30;

  return (
    statusWeight +
    Math.max(
      0,
      70 - accuracy
    ) +
    Math.random() * 10
  );
}

function adaptiveGrammarOrder(
  rows,
  statsMap
) {
  return [...rows]
    .sort(function (a, b) {
      return (
        getGrammarAdaptiveScore(
          b,
          statsMap
        ) -
        getGrammarAdaptiveScore(
          a,
          statsMap
        )
      );
    });
}


async function loadQuestions() {
  renderLoading();

  try {
    const [
      rows,
      grammarStats
    ] =
      await Promise.all([
        getGrammarQuestions({
          mode,
          activeOnly: true
        }),
        getGrammarStatsCloud(
          uid
        ).catch(function () {
          return {};
        })
      ]);

    const resume =
      loadActiveGrammarSession();

    if (
      resume &&
      window.confirm(
        "พบ Grammar Session ที่ยังเล่นไม่จบ\nกด OK เพื่อเล่นต่อ หรือ Cancel เพื่อเริ่มใหม่"
      )
    ) {
      questions =
        resume.questions;

      index =
        Math.min(
          Number(resume.index) || 0,
          Math.max(
            0,
            questions.length - 1
          )
        );

      correct =
        Number(resume.correct) || 0;

      wrong =
        Number(resume.wrong) || 0;

      timeout =
        Number(resume.timeout) || 0;

      score =
        Number(resume.score) || 0;

      totalResponseTimeMs =
        Number(
          resume.totalResponseTimeMs
        ) || 0;

      mistakeQuestions =
        Array.isArray(
          resume.mistakeQuestions
        )
          ? resume.mistakeQuestions
          : [];

      startedAt =
        Number(resume.startedAt) ||
        Date.now();
    } else if (
      requestedSource ===
      "mistakes"
    ) {
      if (resume) {
        clearActiveGrammarSession();
      }

      questions =
        loadGrammarMistakeQuestions();
    } else if (resume) {
      clearActiveGrammarSession();
    }

    let scopedRows =
      requestedTopic
        ? rows.filter(function (item) {
            return (
              String(item.topic || "")
                .trim()
                .toLowerCase()
              ===
              requestedTopic.toLowerCase()
            );
          })
        : rows;

    if (requestedChapter) {
      scopedRows =
        scopedRows.filter(function (item) {
          const chapterId =
            item.chapterId ||
            inferGrammarChapterId(
              item.topic || ""
            );

          return (
            chapterId ===
            requestedChapter
          );
        });
    }

    if (!questions.length) {
      const useAdaptiveOrder =
        !requestedChapter &&
        !requestedTopic &&
        requestedSource ===
          "all";

      const preparedRows =
        useAdaptiveOrder
          ? adaptiveGrammarOrder(
              scopedRows,
              grammarStats
            )
          : grammarSettings
              .shuffleQuestions
            ? shuffle(scopedRows)
            : [...scopedRows];

      questions =
        preparedRows.slice(
          0,
          Math.max(
            1,
            Number(
              grammarSettings
                .questionsPerGame
            ) || 10
          )
        );
    }

    setTextById(
      "grammarModeQuestionCount",
      questions.length
    );

    if (!questions.length) {
      renderEmpty();
      return;
    }

    clearGrammarTimer();

    const didResume =
      Boolean(
        resume &&
        questions ===
          resume.questions
      );

    if (!didResume) {
      startedAt = Date.now();
      questionStartedAt = 0;
      totalResponseTimeMs = 0;
      index = 0;
      correct = 0;
      wrong = 0;
      timeout = 0;
      score = 0;
      mistakeQuestions = [];
    }

    gameFinishing = false;
    grammarPaused = false;
    grammarPauseUsed = false;
    stoppedByWrongLimit = false;

    updateGrammarSessionStats();
    renderQuestion();

  } catch (error) {
    console.error("Grammar load error:", error);
    renderError(
      "โหลดโจทย์ Grammar ไม่สำเร็จ กรุณาลองใหม่"
    );
  }
}

function renderLoading() {
  getArea().innerHTML =
    '<article class="grammar-empty-card">' +
      '<h1>Loading Grammar Practice...</h1>' +
      '<p>กำลังเตรียมโจทย์ให้คุณ</p>' +
    '</article>';
}

function renderEmpty() {
  updateProgress(0, 0);

  getArea().innerHTML =
    '<article class="grammar-empty-card">' +
      '<span class="grammar-mode-pill">GRAMMAR</span>' +
      '<h1>ยังไม่มีโจทย์ในโหมดนี้</h1>' +
      '<p>ให้ Admin เพิ่มโจทย์หรือกด Seed Starter Questions ในหน้า Grammar Management ก่อน</p>' +
      '<a class="grammar-next" href="./practice.html#grammar-practice">กลับหน้า Practice</a>' +
    '</article>';
}

function renderError(message) {
  getArea().innerHTML =
    '<article class="grammar-empty-card">' +
      '<h1>Something went wrong</h1>' +
      '<p>' + escapeHtml(message) + '</p>' +
    '</article>';
}

function renderQuestion() {
  locked = false;

  const question = questions[index];

  saveActiveGrammarSession(
    index
  );

  const info = MODE_INFO[mode];
  const options = Array.isArray(question.options)
    ? question.options
    : [];

  updateProgress(index + 1, questions.length);

  setCurrentActivity(
    uid,
    {
      type: "grammar",
      mode,
      modeLabel:
        info.label,
      chapterId:
        requestedChapter || "",
      chapterTitle:
        requestedChapter
          ? (
              getGrammarChapter(
                requestedChapter
              )?.title || ""
            )
          : "Mixed TOEIC Grammar",
      topic:
        question.topic || "",
      question:
        index + 1,
      totalQuestions:
        questions.length,
      correct,
      wrong,
      timeout,
      score,
      startedAt
    }
  );

  if (mode === "sentence") {
    renderSentenceBuilder(
      question,
      info,
      options
    );
    return;
  }

  getArea().innerHTML =
    '<article class="grammar-question-card">' +
      '<div class="grammar-question-meta-row">' +
        '<span class="grammar-mode-pill">' +
          escapeHtml(info.label.toUpperCase()) +
        '</span>' +
        renderGrammarTimerMarkup() +
      '</div>' +
      '<p class="grammar-topic">' +
        escapeHtml(question.topic || "General Grammar") +
        ' · ' +
        escapeHtml(question.level || "General") +
      '</p>' +
      '<h1 class="grammar-question">' +
        escapeHtml(question.prompt || "") +
      '</h1>' +
      '<div class="grammar-choices" id="grammarChoices">' +
        options.map(function(option) {
          return (
            '<button class="grammar-choice" type="button" data-answer="' +
              escapeAttribute(option) +
            '">' +
              escapeHtml(option) +
            '</button>'
          );
        }).join("") +
      '</div>' +
      '<div id="grammarFeedback"></div>' +
    '</article>';

  document
    .querySelectorAll(".grammar-choice")
    .forEach(function(button) {
      button.addEventListener(
        "click",
        function() {
          handleAnswer(
            button.dataset.answer || "",
            button
          );
        }
      );
    });

  startGrammarTimer();
}

async function handleAnswer(answer, button, timedOut = false) {
  if (
    locked ||
    gameFinishing ||
    grammarPaused
  ) return;

  locked = true;
  clearGrammarTimer();

  const question = questions[index];
  const expected = String(
    question.correctAnswer || ""
  );

  const responseTimeMs =
    questionStartedAt > 0
      ? Math.max(
          0,
          questionElapsedBeforePauseMs +
          Date.now() -
          questionStartedAt
        )
      : 0;

  totalResponseTimeMs +=
    responseTimeMs;

  const isCorrect =
    !timedOut &&
    answer.trim() ===
      expected.trim();

  if (timedOut) {
    timeout += 1;
  } else if (isCorrect) {
    correct += 1;
    score += 100;
  } else {
    wrong += 1;
  }

  document
    .querySelectorAll(
      ".grammar-choice, .grammar-word-tile, .grammar-builder-action, .grammar-built-token"
    )
    .forEach(function(choice) {
      choice.disabled = true;

      const value =
        choice.dataset.answer || "";

      if (
        value &&
        value.trim() === expected.trim()
      ) {
        choice.classList.add("correct");
      }
    });

  if (
    !timedOut &&
    !isCorrect &&
    button
  ) {
    button.classList.add("wrong");
  }

  const reachedWrongLimit =
    Boolean(
      grammarSettings
        .wrongLimitEnabled
    )
    &&
    wrong >=
      Math.max(
        1,
        Number(
          grammarSettings
            .maxWrong
        ) || 1
      );

  if (reachedWrongLimit) {
    stoppedByWrongLimit = true;
  }

  updateGrammarSessionStats();

  const questionChapterId =
    question.chapterId ||
    requestedChapter ||
    inferGrammarChapterId(
      question.topic || ""
    );

  const chapter =
    getGrammarChapter(
      questionChapterId
    );

  const outcome =
    timedOut
      ? "timeout"
      : isCorrect
        ? "correct"
        : "wrong";

  if (!isCorrect) {
    mistakeQuestions.push(
      question
    );
  }

  saveActiveGrammarSession(
    index + 1
  );

  queueGrammarAttempt(
    {
      mode,
      chapterId:
        questionChapterId,
      chapterTitle:
        chapter?.title || "",
      topic:
        question.topic ||
        MODE_INFO[mode].label,
      outcome,
      responseTimeMs
    }
  );

  const feedback =
    document.getElementById(
      "grammarFeedback"
    );

  const feedbackEnabled =
    isCorrect ||
    timedOut ||
    globalSettings
      ?.wrongFeedbackEnabled !== false;

  if (feedback && feedbackEnabled) {
    const title =
      timedOut
        ? "◷ Time's up"
        : isCorrect
          ? "✓ Correct!"
          : "✕ Not quite";

    const feedbackClass =
      timedOut
        ? "timeout"
        : isCorrect
          ? "correct"
          : "wrong";

    const feedbackImage =
      !isCorrect &&
      globalSettings
        ?.wrongFeedbackImageEnabled === true &&
      globalSettings
        ?.wrongFeedbackImage
        ? (
            '<img class="grammar-feedback-image" src="' +
            escapeAttribute(
              globalSettings
                .wrongFeedbackImage
            ) +
            '" alt="">'
          )
        : "";

    feedback.innerHTML =
      '<div class="grammar-feedback ' +
        feedbackClass +
      '">' +
        feedbackImage +
        '<strong>' +
          title +
        '</strong>' +
        '<div>คำตอบ: ' +
          escapeHtml(expected) +
        '</div>' +
        (
          grammarSettings
            .showExplanation !== false &&
          question.explanation
            ? (
                '<div class="grammar-feedback-explanation">' +
                  escapeHtml(
                    question.explanation
                  ) +
                '</div>'
              )
            : ""
        ) +
        (
          reachedWrongLimit
            ? '<div class="grammar-feedback-limit">ถึงจำนวนตอบผิดสูงสุดของ Session แล้ว</div>'
            : ""
        ) +
      '</div>';
  } else if (feedback) {
    feedback.innerHTML = "";
  }

  if (
    !isCorrect ||
    timedOut
  ) {
    playGrammarWrongFeedbackSound();
  }

  scheduleGrammarNext(
    reachedWrongLimit
  );
}

function scheduleGrammarNext(
  reachedWrongLimit = false
) {
  const feedback =
    document.getElementById(
      "grammarFeedback"
    );

  if (!feedback) {
    if (
      reachedWrongLimit ||
      index + 1 >=
        questions.length
    ) {
      finishGame();
    } else {
      nextQuestion();
    }
    return;
  }

  const button =
    document.createElement(
      "button"
    );

  button.type = "button";
  button.className =
    "grammar-next grammar-feedback-next";

  button.textContent =
    reachedWrongLimit ||
    index + 1 >=
      questions.length
      ? "ดูผลลัพธ์ →"
      : "Next Question →";

  button.addEventListener(
    "click",
    function () {
      button.disabled = true;

      if (
        reachedWrongLimit ||
        index + 1 >=
          questions.length
      ) {
        finishGame();
        return;
      }

      nextQuestion();
    }
  );

  feedback.appendChild(
    button
  );

  button.focus({
    preventScroll: true
  });
}

function setupGrammarGameControls() {
  const pauseButton =
    document.getElementById(
      "grammarPauseBtn"
    );

  pauseButton
    ?.addEventListener(
      "click",
      toggleGrammarPause
    );

  document.addEventListener(
    "keydown",
    function (event) {
      const tag =
        String(
          event.target?.tagName || ""
        ).toLowerCase();

      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      ) {
        return;
      }

      const key =
        event.key.toLowerCase();

      if (key === "p") {
        event.preventDefault();
        toggleGrammarPause();
        return;
      }

      if (grammarPaused) {
        return;
      }

      if (
        event.key === "Enter"
      ) {
        const next =
          document.querySelector(
            ".grammar-feedback-next"
          );

        if (
          next &&
          !next.disabled
        ) {
          event.preventDefault();
          next.click();
          return;
        }
      }

      const map = {
        "1": 0,
        "a": 0,
        "2": 1,
        "b": 1,
        "3": 2,
        "c": 2,
        "4": 3,
        "d": 3,
        "5": 4,
        "e": 4,
        "6": 5,
        "f": 5
      };

      if (
        map[key] === undefined ||
        locked
      ) {
        return;
      }

      const choices =
        Array.from(
          document.querySelectorAll(
            ".grammar-choice"
          )
        );

      const choice =
        choices[
          map[key]
        ];

      if (
        choice &&
        !choice.disabled
      ) {
        event.preventDefault();
        choice.click();
      }
    }
  );
}

function toggleGrammarPause() {
  const button =
    document.getElementById(
      "grammarPauseBtn"
    );

  if (
    locked ||
    gameFinishing
  ) {
    return;
  }

  if (grammarPaused) {
    grammarPaused = false;

    document.body.classList.remove(
      "grammar-paused"
    );

    if (button) {
      button.textContent =
        "⏸ Pause";
      button.disabled =
        grammarPauseUsed;
    }

    startGrammarTimer(
      true
    );

    questionStartedAt =
      Date.now();

    return;
  }

  if (grammarPauseUsed) {
    return;
  }

  grammarPauseUsed = true;
  grammarPaused = true;

  if (questionStartedAt) {
    questionElapsedBeforePauseMs +=
      Math.max(
        0,
        Date.now() -
        questionStartedAt
      );
  }

  clearGrammarTimer();

  document.body.classList.add(
    "grammar-paused"
  );

  if (button) {
    button.textContent =
      "▶ Resume";
  }
}


function renderGrammarTimerMarkup() {
  return (
    '<div class="grammar-timer" id="grammarTimer">' +
      '<span class="grammar-timer-icon">◷</span>' +
      '<strong id="grammarTimerValue">--</strong>' +
      '<span>sec</span>' +
    '</div>'
  );
}

function startGrammarTimer(
  preserveRemaining = false
) {
  clearGrammarTimer();

  const seconds =
    Math.max(
      3,
      Number(
        grammarSettings
          ?.timePerQuestion
      ) || 30
    );

  if (!preserveRemaining) {
    timeRemaining = seconds;
  }
  questionStartedAt = Date.now();

  updateGrammarTimerUI();

  timerInterval =
    window.setInterval(
      function () {
        timeRemaining -= 1;
        updateGrammarTimerUI();

        if (
          timeRemaining <= 0
        ) {
          clearGrammarTimer();
          handleAnswer(
            "",
            null,
            true
          );
        }
      },
      1000
    );
}

function clearGrammarTimer() {
  if (timerInterval) {
    window.clearInterval(
      timerInterval
    );
    timerInterval = null;
  }
}

function updateGrammarTimerUI() {
  const value =
    document.getElementById(
      "grammarTimerValue"
    );

  const box =
    document.getElementById(
      "grammarTimer"
    );

  if (value) {
    value.textContent =
      Math.max(
        0,
        timeRemaining
      );
  }

  if (box) {
    box.classList.toggle(
      "warning",
      timeRemaining <= 10 &&
      timeRemaining > 5
    );

    box.classList.toggle(
      "danger",
      timeRemaining <= 5
    );
  }
}

function playGrammarWrongFeedbackSound() {
  if (
    globalSettings
      ?.wrongFeedbackSoundEnabled !==
      true
  ) {
    return;
  }

  const url =
    String(
      globalSettings
        ?.wrongFeedbackSoundUrl ||
      ""
    ).trim();

  if (!url) {
    return;
  }

  try {
    const audio =
      new Audio(url);

    audio.volume = .55;

    audio.play()
      .catch(function () {});
  } catch (error) {
    console.warn(
      "Grammar feedback sound error:",
      error
    );
  }
}

function nextQuestion() {
  index += 1;

  if (index >= questions.length) {
    finishGame();
    return;
  }

  renderQuestion();
}

async function finishGame() {
  if (gameFinishing) {
    return;
  }

  gameFinishing = true;
  clearGrammarTimer();

  clearCurrentActivity(
    uid
  );

  const answered =
    correct +
    wrong +
    timeout;

  const accuracy =
    answered > 0
      ? Math.round(
          (correct / answered) * 100
        )
      : 0;

  const averageResponseMs =
    answered > 0
      ? Math.round(
          totalResponseTimeMs /
          answered
        )
      : 0;

  const chapter =
    requestedChapter
      ? getGrammarChapter(
          requestedChapter
        )
      : null;

  const game = {
    practiceType:
      "grammar",

    /* Keep legacy history compatibility. */
    mode:
      "translation",

    displayMode:
      MODE_INFO[mode]
        .historyMode,

    grammarMode:
      mode,

    grammarModeLabel:
      MODE_INFO[mode]
        .label,

    chapterId:
      requestedChapter || "",

    chapterTitle:
      chapter?.title ||
      "Mixed TOEIC Grammar",

    topic:
      requestedTopic ||
      chapter?.title ||
      "Mixed",

    requestedTopic,
    requestedChapter,
    practiceSource:
      requestedSource,

    mistakes:
      mistakeQuestions,

    totalQuestions:
      answered,

    plannedQuestions:
      questions.length,

    correct,
    wrong,
    timeout,
    score,
    accuracy,

    averageResponse:
      Number(
        (
          averageResponseMs /
          1000
        ).toFixed(1)
      ),

    averageResponseMs,

    totalResponseTimeMs,

    durationMs:
      Math.max(
        0,
        Date.now() -
        startedAt
      ),

    endedByWrongLimit:
      stoppedByWrongLimit,

    completedAt:
      new Date()
        .toISOString()
  };

  const {
    mistakes: resultMistakes,
    ...historyGame
  } = game;

  clearActiveGrammarSession();

  saveLastResult(
    game
  );

  if (!getLastResult()) {
    saveLastResult(
      game
    );
  }

  try {
    const cloudSync =
      (async function() {
        await grammarStatsCloudQueue;

        await Promise.all([
          saveGameHistoryCloud(
            uid,
            historyGame
          ),
          recordDailyGameCloud(
            uid,
            historyGame
          )
        ]);
      })();

    const syncTimeout =
      new Promise(
        function(resolve) {
          window.setTimeout(
            resolve,
            2200
          );
        }
      );

    await Promise.race([
      cloudSync,
      syncTimeout
    ]);
  } catch (error) {
    console.warn(
      "Could not save grammar game summary:",
      error
    );
  }

  window.location.href =
    "./result.html";
}

function renderResult(game) {
  updateProgress(
    game.totalQuestions,
    game.totalQuestions
  );

  const message =
    game.accuracy >= 80
      ? "Great job!"
      : game.accuracy >= 60
        ? "Good progress!"
        : "Keep practicing!";

  getArea().innerHTML =
    '<article class="grammar-result-card">' +
      '<span class="grammar-mode-pill">' +
        escapeHtml(
          MODE_INFO[mode].label.toUpperCase()
        ) +
      '</span>' +
      '<div class="grammar-result-score">' +
        game.accuracy +
        '%' +
      '</div>' +
      '<h1>' +
        message +
      '</h1>' +
      '<p>ฝึกต่ออีกนิด แล้ว Grammar จะค่อย ๆ แม่นขึ้น</p>' +
      '<div class="grammar-result-stats">' +
        '<div><strong>' +
          game.correct +
        '</strong><span>Correct</span></div>' +
        '<div><strong>' +
          game.wrong +
        '</strong><span>Wrong</span></div>' +
        '<div><strong>' +
          game.totalQuestions +
        '</strong><span>Questions</span></div>' +
      '</div>' +
      '<div class="grammar-result-actions">' +
        '<button class="primary" id="playAgainBtn" type="button">Play Again</button>' +
        '<a href="./review.html">Review</a>' +
        '<a href="./practice.html#grammar-practice">Grammar Modes</a>' +
      '</div>' +
    '</article>';

  document
    .getElementById("playAgainBtn")
    .addEventListener(
      "click",
      loadQuestions
    );
}

function updateGrammarSessionStats() {
  setTextById(
    "grammarScoreValue",
    score
  );

  setTextById(
    "grammarCorrectValue",
    correct
  );

  setTextById(
    "grammarWrongValue",
    wrong
  );

  setTextById(
    "grammarTimeoutValue",
    timeout
  );
}


function updateProgress(current, total) {
  const copy =
    document.getElementById(
      "grammarProgressCopy"
    );

  const bar =
    document.getElementById(
      "grammarProgressBar"
    );

  copy.textContent =
    current + " / " + total;

  bar.style.width =
    total > 0
      ? Math.round((current / total) * 100) + "%"
      : "0%";
}

function getArea() {
  return document.getElementById(
    "grammarGameArea"
  );
}

function shuffle(items) {
  const copy = [...items];

  for (
    let i = copy.length - 1;
    i > 0;
    i -= 1
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function renderSentenceBuilder(
  question,
  info,
  options
) {
  const tokens =
    Array.isArray(options)
      ? [...options]
      : [];

  const shuffled =
    shuffle(tokens);

  getArea().innerHTML =
    '<article class="grammar-question-card">' +
      '<div class="grammar-question-meta-row">' +
        '<span class="grammar-mode-pill">' +
          escapeHtml(info.label.toUpperCase()) +
        '</span>' +
        renderGrammarTimerMarkup() +
      '</div>' +
      '<p class="grammar-topic">' +
        escapeHtml(question.topic || "Word Order") +
        ' · ' +
        escapeHtml(question.level || "General") +
      '</p>' +
      '<h1 class="grammar-question">' +
        escapeHtml(question.prompt || "Build the sentence.") +
      '</h1>' +
      '<div class="grammar-built-sentence" id="grammarBuiltSentence">' +
        '<span>Tap words below to build your sentence</span>' +
      '</div>' +
      '<div class="grammar-word-bank" id="grammarWordBank">' +
        shuffled.map(function(token, tokenIndex) {
          return (
            '<button class="grammar-word-tile" type="button" data-token-index="' +
              tokenIndex +
            '">' +
              escapeHtml(token) +
            '</button>'
          );
        }).join("") +
      '</div>' +
      '<div class="grammar-builder-controls">' +
        '<button class="grammar-builder-action" id="grammarClearBuilder" type="button">Clear</button>' +
        '<button class="grammar-builder-action primary" id="grammarSubmitBuilder" type="button">Check Answer</button>' +
      '</div>' +
      '<div id="grammarFeedback"></div>' +
    '</article>';

  const selected = [];

  const builtSentence =
    document.getElementById(
      "grammarBuiltSentence"
    );

  const renderBuilt =
    function () {
      if (!selected.length) {
        builtSentence.innerHTML =
          '<span>Tap words below to build your sentence</span>';
        return;
      }

      builtSentence.innerHTML =
        selected
          .map(function(item) {
            return (
              '<button class="grammar-built-token" type="button" data-selected-index="' +
                item.selectedIndex +
              '">' +
                escapeHtml(item.token) +
              '</button>'
            );
          })
          .join("");

      builtSentence
        .querySelectorAll(
          "[data-selected-index]"
        )
        .forEach(function(button) {
          button.addEventListener(
            "click",
            function () {
              const selectedIndex =
                Number(
                  button.dataset.selectedIndex
                );

              const position =
                selected.findIndex(
                  function(item) {
                    return (
                      item.selectedIndex ===
                      selectedIndex
                    );
                  }
                );

              if (position < 0) return;

              const removed =
                selected.splice(
                  position,
                  1
                )[0];

              const sourceButton =
                document.querySelector(
                  '[data-token-index="' +
                  removed.sourceIndex +
                  '"]'
                );

              if (sourceButton) {
                sourceButton.disabled = false;
              }

              renderBuilt();
            }
          );
        });
    };

  document
    .querySelectorAll(
      "[data-token-index]"
    )
    .forEach(function(button) {
      button.addEventListener(
        "click",
        function () {
          const sourceIndex =
            Number(
              button.dataset.tokenIndex
            );

          selected.push({
            token:
              shuffled[sourceIndex],
            sourceIndex,
            selectedIndex:
              Date.now() +
              Math.random()
          });

          button.disabled = true;

          renderBuilt();
        }
      );
    });

  document
    .getElementById(
      "grammarClearBuilder"
    )
    .addEventListener(
      "click",
      function () {
        selected.length = 0;

        document
          .querySelectorAll(
            "[data-token-index]"
          )
          .forEach(function(button) {
            button.disabled = false;
          });

        renderBuilt();
      }
    );

  document
    .getElementById(
      "grammarSubmitBuilder"
    )
    .addEventListener(
      "click",
      function () {
        if (!selected.length) {
          return;
        }

        const answer =
          selected
            .map(function(item) {
              return item.token;
            })
            .join(" ");

        handleAnswer(
          answer,
          null
        );
      }
    );

  startGrammarTimer();
}

function renderModeShell() {
  const info = {
    part5: {
      short: "TOEIC Part 5",
      title: "TOEIC Part 5",
      description:
        "ฝึก Incomplete Sentences แบบ 4 ตัวเลือก เน้น Grammar ระดับประโยค"
    },
    fill: {
      short: "Fill Blank",
      title: "Fill in the Blank",
      description:
        "เติมคำให้ประโยคสมบูรณ์ โดยดูจาก grammar pattern และความหมายรอบข้าง"
    },
    error: {
      short: "Error",
      title: "Error Detection",
      description:
        "ฝึกมองหาจุดผิดในประโยค แล้วจับ grammar mistake ให้เร็วขึ้น"
    },
    sentence: {
      short: "Sentence",
      title: "Sentence Building",
      description:
        "เรียงคำให้เป็นประโยคที่ถูกต้อง เพื่อฝึก word order และ sentence structure"
    }
  }[mode];

  if (!info) return;

  setTextById(
    "grammarModeTitle",
    info.title
  );

  const chapter =
    requestedChapter
      ? getGrammarChapter(
          requestedChapter
        )
      : null;

  setTextById(
    "grammarModeDescription",
    requestedTopic
      ? "โหมดทบทวนเฉพาะหัวข้อ " +
          requestedTopic
      : chapter
        ? chapter.description
        : info.description
  );

  setTextById(
    "grammarModeShort",
    requestedTopic ||
      chapter?.shortTitle ||
      info.short
  );

  setTextById(
    "grammarPlayTitle",
    chapter
      ? chapter.title +
        " · " +
        info.title
      : requestedTopic
        ? requestedTopic
        : info.title
  );
}


function setTextById(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}
