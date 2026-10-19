import {
  db
} from "../core/firebase.js";


import {
  requireUserPage
} from "../core/auth.js";


import {
  saveLastResult,
  getLastResult
} from "../core/transient-storage.js";


import {
  recordWordAttemptCloud,
  getWordStatsCloud,
  getWeakWordIdsCloud,
  saveGameHistoryCloud,
  recordDailyGameCloud
} from "../core/cloud-data.js";

import {
  setCurrentActivity,
  clearCurrentActivity
} from "../core/current-activity.js";


import {
  collection,
  getDocs,
  doc,
  getDoc
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   SETTINGS
========================================================= */

const DEFAULT_SETTINGS = {

  translation: {

    enabled:
      true,

    timePerQuestion:
      15,

    questionsPerGame:
      10,

    choices:
      4,

    wrongLimitEnabled:
      true,

    maxWrong:
      3

  },


  meaning: {

    enabled:
      true,

    timePerQuestion:
      15,

    questionsPerGame:
      10,

    choices:
      4,

    wrongLimitEnabled:
      true,

    maxWrong:
      3

  },


  synonym: {

    enabled:
      true,

    timePerQuestion:
      20,

    questionsPerGame:
      10,

    choices:
      6,

    minCorrectSynonyms:
      2,

    maxCorrectSynonyms:
      4,

    showCorrectCount:
      true,

    wrongLimitEnabled:
      true,

    maxWrong:
      3

  },


  /*
    WEAK MODE

    ตอนนี้ Weak Practice
    ใช้รูปแบบ English → Thai

    และถ้าเลือกคำเดียว
    ระบบจะให้ฝึกซ้ำ 3 ข้อ
  */

  weak: {

    enabled:
      true,

    timePerQuestion:
      15,

    questionsPerGame:
      10,

    choices:
      4,

    repeatSingleWord:
      3,

    wrongLimitEnabled:
      false,

    maxWrong:
      5

  },


  global: {

    wrongFeedbackEnabled:
      true,

    wrongFeedbackSoundEnabled:
      false,

    wrongFeedbackSoundUrl:
      "",

    wrongFeedbackDuration:
      900

  }

};


/* =========================================================
   DOM
========================================================= */

const $ =
  function (
    id
  ) {

    return document
      .getElementById(
        id
      );

  };


const gameLoading =
  $("gameLoading");

const gameError =
  $("gameError");

const gameErrorMessage =
  $("gameErrorMessage");

const gameArea =
  $("gameArea");

const gameModeTitle =
  $("gameModeTitle");

const gameModeDescription =
  $("gameModeDescription");

const questionCounter =
  $("questionCounter");

const progressPercent =
  $("progressPercent");

const progressBar =
  $("progressBar");

const questionTypeBadge =
  $("questionTypeBadge");

const questionInstruction =
  $("questionInstruction");

const questionText =
  $("questionText");

const questionSubtext =
  $("questionSubtext");

const answersGrid =
  $("answersGrid");

const synonymHint =
  $("synonymHint");

const synonymHintText =
  $("synonymHintText");

const submitSynonymBtn =
  $("submitSynonymBtn");

const timerBox =
  $("timerBox");

const timerValue =
  $("timerValue");

const scoreValue =
  $("scoreValue");

const correctValue =
  $("correctValue");

const wrongValue =
  $("wrongValue");

const timeoutValue =
  $("timeoutValue");

const remainingValue =
  $("remainingValue");

const answerFeedback =
  $("answerFeedback");

const feedbackIcon =
  $("feedbackIcon");

const feedbackTitle =
  $("feedbackTitle");

const feedbackText =
  $("feedbackText");

const gameTip =
  $("gameTip");


/* =========================================================
   STATE
========================================================= */

let currentUser =
  null;

let currentProfile =
  null;

let gameMode =
  "translation";

let practiceSource =
  "all";

let vocabulary =
  [];

let adaptiveWordStats =
  {};

let gameSettings =
  null;

let globalSettings =
  null;

let questions =
  [];

let currentQuestionIndex =
  0;

let correctAnswers =
  0;

let wrongAnswers =
  0;

let timeoutAnswers =
  0;

let score =
  0;

let timerInterval =
  null;

let timeRemaining =
  0;

let questionStartedAt =
  0;

let questionElapsedBeforePauseMs =
  0;

let gameStartedAt =
  0;

let questionLocked =
  false;

let pauseUsed =
  false;

let gamePaused =
  false;

let selectedSynonyms =
  new Set();

let endedByWrongLimit =
  false;

let totalResponseTimeMs =
  0;

let selectedWeakIds =
  [];

let mistakeQuestions =
  [];

const ACTIVE_VOCAB_SESSION_PREFIX =
  "vocabOnnyActiveVocabSession:";


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initGame
);


async function initGame() {

  bindNavigation();
  setupVocabGameControls();


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


  currentUser =
    context.user;


  currentProfile =
    context.profile;


  renderUser();


  gameMode =
    getModeFromURL();


  practiceSource =
    getPracticeSourceFromURL();


  if (
    ![
      "translation",
      "meaning",
      "synonym",
      "weak"
    ].includes(
      gameMode
    )
  ) {

    showError(
      "ไม่พบ Game Mode ที่ต้องการ"
    );


    return;

  }


  document.body
    .classList
    .add(
      `mode-${gameMode}`
    );


  if (
    practiceSource ===
    "weak"
  ) {

    document.body
      .classList
      .add(
        "practice-source-weak"
      );

  }


  /*
    Weak practice ต้องมี IDs
    รองรับทั้ง legacy mode=weak และ mode=translation|meaning|synonym&source=weak
  */

  if (
    isWeakPractice()
  ) {

    selectedWeakIds =
      await loadSelectedWeakIds();


    if (
      selectedWeakIds.length ===
      0
    ) {

      showError(
        "ไม่พบคำศัพท์สำหรับ Weak Words กรุณากลับไปเลือกคำที่ต้องการทบทวน"
      );


      return;

    }

  }


  try {

    const [
      settings,
      global,
      words,
      wordStats
    ] =
      await Promise.all(
        [
          loadGameSettings(
            isWeakPractice()
              ? "weak"
              : gameMode
          ),

          loadGlobalSettings(),

          loadVocabulary(),

          getWordStatsCloud(
            currentUser.uid
          ).catch(function () {
            return {};
          })
        ]
      );


    gameSettings =
      settings;

    if (
      gameSettings.enabled ===
      false
    ) {
      showError(
        "โหมดนี้ถูกปิดโดยผู้ดูแลระบบ"
      );

      return;
    }


    globalSettings =
      global;


    vocabulary =
      words;

    adaptiveWordStats =
      wordStats || {};


    validateVocabulary();


    prepareGame();

  }

  catch (
    error
  ) {

    console.error(
      "Game initialization error:",
      error
    );


    showError(
      getFriendlyError(
        error
      )
    );

  }

}


/* =========================================================
   MODE
========================================================= */

function getModeFromURL() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  return String(

    params.get(
      "mode"
    )

    ||

    "translation"

  )
    .trim()
    .toLowerCase();

}


function getPracticeSourceFromURL() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const source =
    String(
      params.get(
        "source"
      ) ||
      "all"
    )
      .trim()
      .toLowerCase();


  return source === "weak"
    ? "weak"
    : source === "mistakes"
      ? "mistakes"
      : "all";

}


function isWeakPractice() {

  return (
    practiceSource === "weak" ||
    gameMode === "weak"
  );

}


async function loadSelectedWeakIds() {

  let storedIds =
    [];


  try {

    const raw =
      JSON.parse(
        sessionStorage.getItem(
          "vocabOnnyWeakWordIds"
        ) ||
        "[]"
      );


    if (
      Array.isArray(
        raw
      )
    ) {

      storedIds =
        raw
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
          );

    }

  }

  catch (
    error
  ) {

    console.warn(
      "Weak selection state invalid:",
      error
    );

  }


  if (
    practiceSource ===
      "weak" &&
    storedIds.length >
      0
  ) {

    return [
      ...new Set(
        storedIds
      )
    ];

  }


  return await getWeakWordIdsCloud(
    currentUser.uid
  );

}


/* =========================================================
   LOAD SETTINGS
========================================================= */

async function loadGameSettings(
  mode
) {

  const defaults = {

    ...DEFAULT_SETTINGS[
      mode
    ]

  };


  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "gameSettings",
          mode
        )
      );


    if (
      !snapshot.exists()
    ) {

      return defaults;

    }


    return {

      ...defaults,

      ...snapshot.data()

    };

  }

  catch (
    error
  ) {

    console.warn(
      "Using default settings:",
      error
    );


    return defaults;

  }

}


async function loadGlobalSettings() {

  const defaults = {

    ...DEFAULT_SETTINGS.global

  };


  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "gameSettings",
          "global"
        )
      );


    return snapshot.exists()

      ? {
          ...defaults,
          ...snapshot.data()
        }

      : defaults;

  }

  catch (
    error
  ) {

    console.warn(
      "Using default global settings:",
      error
    );


    return defaults;

  }

}


/* =========================================================
   VOCABULARY
========================================================= */

async function loadVocabulary() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "vocabulary"
      )
    );


  return snapshot.docs
    .map(
      function (
        item
      ) {

        const data =
          item.data();


        return {

          id:
            item.id,

          word:
            normalizeText(
              data.word
            ),

          thai:
            normalizeText(
              data.thai
            ),

          meaning:
            normalizeText(
              data.meaning
            ),

          exampleSentence:
            normalizeText(
              data.exampleSentence
            ),

          synonyms:
            normalizeSynonyms(
              data.synonyms
            ),

          level:
            normalizeText(
              data.level
            ),

          active:
            data.active !==
            false

        };

      }
    )
    .filter(
      function (
        word
      ) {

        return (
          word.active &&
          word.word
        );

      }
    );

}


/* =========================================================
   VALIDATE
========================================================= */

function validateVocabulary() {

  if (
    vocabulary.length <
    2
  ) {

    throw new Error(
      "NOT_ENOUGH_VOCABULARY"
    );

  }


  if (
    gameMode ===
    "synonym"
  ) {

    if (
      getSynonymEligibleWords()
        .length <
      1
    ) {

      throw new Error(
        "NOT_ENOUGH_SYNONYMS"
      );

    }

  }


  if (
    gameMode ===
    "weak"
  ) {

    const selected =
      getSelectedWeakWords();


    if (
      selected.length ===
      0
    ) {

      throw new Error(
        "NO_WEAK_WORDS"
      );

    }


    /*
      ตัวเลือกต้องมี Vocabulary อื่น
      อย่างน้อย 1 ตัว
    */

    const usable =
      vocabulary.filter(
        function (
          word
        ) {

          return (
            word.word &&
            word.thai
          );

        }
      );


    if (
      usable.length <
      2
    ) {

      throw new Error(
        "NOT_ENOUGH_VOCABULARY"
      );

    }

  }

}


function getActiveVocabSessionKey() {
  return (
    ACTIVE_VOCAB_SESSION_PREFIX +
    String(
      currentUser?.uid || "guest"
    ) +
    ":" +
    gameMode +
    ":" +
    practiceSource
  );
}

function saveActiveVocabSession(
  nextIndex =
    currentQuestionIndex
) {
  if (
    !currentUser?.uid ||
    !Array.isArray(questions) ||
    questions.length === 0 ||
    gameFinishing
  ) {
    return;
  }

  const payload = {
    uid: currentUser.uid,
    gameMode,
    practiceSource,
    questions,
    currentQuestionIndex:
      Math.max(
        0,
        Math.min(
          nextIndex,
          questions.length
        )
      ),
    correctAnswers,
    wrongAnswers,
    timeoutAnswers,
    score,
    totalResponseTimeMs,
    mistakeQuestions,
    selectedWeakIds,
    gameStartedAt,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(
      getActiveVocabSessionKey(),
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn(
      "Could not save active Vocabulary session:",
      error
    );
  }
}

function loadActiveVocabSession() {
  if (!currentUser?.uid) {
    return null;
  }

  try {
    const raw =
      localStorage.getItem(
        getActiveVocabSessionKey()
      );

    if (!raw) return null;

    const payload =
      JSON.parse(raw);

    const fresh =
      Number(payload?.savedAt || 0) >
      Date.now() -
      12 * 60 * 60 * 1000;

    const valid =
      payload?.uid === currentUser.uid &&
      payload?.gameMode === gameMode &&
      payload?.practiceSource ===
        practiceSource &&
      Array.isArray(
        payload?.questions
      ) &&
      payload.questions.length > 0 &&
      fresh;

    if (!valid) {
      clearActiveVocabSession();
      return null;
    }

    return payload;
  } catch (error) {
    console.warn(
      "Could not restore active Vocabulary session:",
      error
    );
    return null;
  }
}

function clearActiveVocabSession() {
  try {
    localStorage.removeItem(
      getActiveVocabSessionKey()
    );
  } catch (error) {}
}

function loadMistakePracticeQuestions() {
  if (
    practiceSource !==
    "mistakes"
  ) {
    return [];
  }

  try {
    const rows =
      JSON.parse(
        sessionStorage.getItem(
          "vocabOnnyMistakeQuestions"
        ) || "[]"
      );

    return Array.isArray(rows)
      ? rows
      : [];
  } catch (error) {
    return [];
  }
}


/* =========================================================
   PREPARE
========================================================= */

function prepareGame() {

  resetGameState();


  configureModeUI();


  const resume =
    loadActiveVocabSession();

  if (
    resume &&
    window.confirm(
      "พบ Session ที่ยังเล่นไม่จบ\nกด OK เพื่อเล่นต่อ หรือ Cancel เพื่อเริ่มใหม่"
    )
  ) {
    questions =
      resume.questions;

    currentQuestionIndex =
      Math.min(
        Number(
          resume.currentQuestionIndex
        ) || 0,
        Math.max(
          0,
          questions.length - 1
        )
      );

    correctAnswers =
      Number(
        resume.correctAnswers
      ) || 0;

    wrongAnswers =
      Number(
        resume.wrongAnswers
      ) || 0;

    timeoutAnswers =
      Number(
        resume.timeoutAnswers
      ) || 0;

    score =
      Number(
        resume.score
      ) || 0;

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

    selectedWeakIds =
      Array.isArray(
        resume.selectedWeakIds
      )
        ? resume.selectedWeakIds
        : selectedWeakIds;

    gameStartedAt =
      Number(
        resume.gameStartedAt
      ) || Date.now();
  } else if (
    practiceSource ===
    "mistakes"
  ) {
    if (resume) {
      clearActiveVocabSession();
    }

    questions =
      loadMistakePracticeQuestions();
  } else {
    if (resume) {
      clearActiveVocabSession();
    }

    questions =
      createQuestions();
  }


  if (
    questions.length ===
    0
  ) {

    showError(
      "ไม่สามารถสร้างคำถามได้"
    );


    return;

  }


  if (!gameStartedAt) {
    gameStartedAt =
      Date.now();
  }


  gameLoading.hidden =
    true;


  gameError.hidden =
    true;


  gameArea.hidden =
    false;


  renderQuestion();

}


/* =========================================================
   RESET
========================================================= */

function resetGameState() {

  clearTimer();


  currentQuestionIndex =
    0;

  correctAnswers =
    0;

  wrongAnswers =
    0;

  timeoutAnswers =
    0;

  score =
    0;

  questionLocked =
    false;

  pauseUsed =
    false;

  gamePaused =
    false;

  selectedSynonyms =
    new Set();

  endedByWrongLimit =
    false;

  totalResponseTimeMs =
    0;

  mistakeQuestions =
    [];

  gameStartedAt =
    0;


  // Phase C: reset Cloud Sync state for a fresh game session.
  wordStatsCloudQueue =
    Promise.resolve();

  gameFinishing =
    false;


  updateStats();

}


/* =========================================================
   MODE UI
========================================================= */

function configureModeUI() {

  const configs = {

    translation: {

      title:
        "Translation",

      description:
        "English → Thai",

      badge:
        "ENGLISH → THAI",

      instruction:
        "เลือกคำแปลภาษาไทยที่ถูกต้อง",

      tip:
        "อ่านคำศัพท์ให้เข้าใจก่อนเลือกคำตอบ"

    },


    meaning: {

      title:
        "Meaning",

      description:
        "Thai → English",

      badge:
        "THAI → ENGLISH",

      instruction:
        "เลือกคำศัพท์ภาษาอังกฤษที่ตรงกับความหมาย",

      tip:
        "ลองนึกคำศัพท์ก่อนดูตัวเลือก"

    },


    synonym: {

      title:
        "Synonym",

      description:
        "Choose all words with similar meaning",

      badge:
        "MULTIPLE ANSWERS",

      instruction:
        "เลือกคำที่มีความหมายเหมือนหรือใกล้เคียงทั้งหมด",

      tip:
        "Synonym อาจมีคำตอบถูกมากกว่าหนึ่งคำ"

    },


    weak: {

      title:
        "Weak Words",

      description:
        "Personal Review",

      badge:
        "FOCUS REVIEW",

      instruction:
        "ทบทวนคำศัพท์ที่ยังไม่แม่น",

      tip:
        "ตอบถูกต่อเนื่องเพื่อช่วยให้คำศัพท์หลุดจาก Weak Words"

    }

  };


  const config =
    configs[
      gameMode
    ];


  gameModeTitle.textContent =
    practiceSource ===
    "weak"

      ? `Weak Words · ${config.title}`

      : config.title;


  gameModeDescription.textContent =
    practiceSource ===
    "weak"

      ? `เฉพาะคำที่ต้องทบทวน · ${config.description}`

      : config.description;


  questionTypeBadge.textContent =
    config.badge;


  questionInstruction.textContent =
    config.instruction;


  gameTip.textContent =
    config.tip;

}


/* =========================================================
   CREATE QUESTIONS
========================================================= */

function createQuestions() {

  switch (
    gameMode
  ) {

    case "translation":

      return createTranslationQuestions();


    case "meaning":

      return createMeaningQuestions();


    case "synonym":

      return createSynonymQuestions();


    case "weak":

      return createWeakQuestions();


    default:

      return [];

  }

}


/* =========================================================
   STANDARD QUESTION FACTORY
========================================================= */

function createStandardQuestion(
  word,
  eligible,
  choiceCount,
  direction
) {

  if (
    direction ===
    "thai-to-english"
  ) {

    /*
      Build distractors from UNIQUE answer values first.

      Previous logic sliced candidate objects before removing duplicate
      answer text. If two vocabulary records had the same English answer,
      uniqueStrings() removed one afterwards and the question could render
      only 3 choices.

      Deduplicate first, then shuffle/slice so we keep the requested count
      whenever the vocabulary contains enough unique answers.
    */
    const distractors =
      shuffle(
        uniqueStrings(
          eligible
            .filter(
              function (
                candidate
              ) {

                return (
                  candidate.id !== word.id &&
                  candidate.word &&
                  candidate.word !== word.word
                );

              }
            )
            .map(
              function (
                candidate
              ) {

                return candidate.word;

              }
            )
        )
      )
        .slice(
          0,
          choiceCount - 1
        );


    return {

      wordId:
        word.id,

      sourceWord:
        word,

      prompt:
        word.thai,

      subtext:
        word.meaning,

      correctAnswers:
        [
          word.word
        ],

      options:
        shuffle(
          uniqueStrings(
            [
              word.word,
              ...distractors
            ]
          )
        )

    };

  }


  /*
    DEFAULT English → Thai
  */

  /*
    Same protection for English → Thai:
    deduplicate Thai answer text BEFORE slicing.
  */
  const distractors =
    shuffle(
      uniqueStrings(
        eligible
          .filter(
            function (
              candidate
            ) {

              return (
                candidate.id !== word.id &&
                candidate.thai &&
                candidate.thai !== word.thai
              );

            }
          )
          .map(
            function (
              candidate
            ) {

              return candidate.thai;

            }
          )
      )
    )
      .slice(
        0,
        choiceCount - 1
      );


  return {

    wordId:
      word.id,

    sourceWord:
      word,

    prompt:
      word.word,

    subtext:
      word.exampleSentence,

    correctAnswers:
      [
        word.thai
      ],

    options:
      shuffle(
        uniqueStrings(
          [
            word.thai,
            ...distractors
          ]
        )
      )

  };

}


function getWeakPracticeTargets(
  eligible
) {

  if (
    !isWeakPractice()
  ) {

    return eligible;

  }


  const selected =
    new Set(
      selectedWeakIds.map(
        function (
          id
        ) {

          return String(
            id
          );

        }
      )
    );


  return eligible.filter(
    function (
      word
    ) {

      return selected.has(
        String(
          word.id
        )
      );

    }
  );

}


function getAdaptiveWordScore(word) {
  if (
    practiceSource !== "all"
  ) {
    return Math.random() * 10;
  }

  const stat =
    adaptiveWordStats?.[word?.id] || {};

  const attempts =
    Number(stat.attempts || 0);

  const accuracy =
    attempts > 0
      ? Number(stat.accuracy || 0)
      : 0;

  const nextReviewAt =
    stat.nextReviewAt
      ? new Date(
          stat.nextReviewAt
        ).getTime()
      : 0;

  let score = 0;

  if (attempts <= 0) {
    score += 36;
  } else {
    score +=
      Math.max(
        0,
        65 - accuracy
      );

    if (accuracy < 60) {
      score += 34;
    } else if (accuracy < 75) {
      score += 18;
    }

    if (attempts < 3) {
      score += 12;
    }
  }

  if (
    Number.isFinite(
      nextReviewAt
    ) &&
    nextReviewAt > 0 &&
    nextReviewAt <= Date.now()
  ) {
    score += 55;
  }

  if (
    Number(stat.wrong || 0) +
    Number(stat.timeout || 0) >= 2
  ) {
    score += 18;
  }

  return score +
    Math.random() * 12;
}

function selectAdaptiveTargets(
  targets,
  total
) {
  if (
    practiceSource !== "all"
  ) {
    return shuffle(
      targets
    ).slice(
      0,
      total
    );
  }

  return [...targets]
    .sort(function (a, b) {
      return (
        getAdaptiveWordScore(b) -
        getAdaptiveWordScore(a)
      );
    })
    .slice(
      0,
      total
    );
}


/* =========================================================
   TRANSLATION
========================================================= */

function createTranslationQuestions() {

  const eligible =
    getTranslationEligibleWords();


  const targets =
    getWeakPracticeTargets(
      eligible
    );


  const total =
    Math.min(

      positiveInteger(
        gameSettings.questionsPerGame,
        10
      ),

      targets.length

    );


  const choices =
    getChoiceCount(
      eligible
    );


  return selectAdaptiveTargets(
    targets,
    total
  )
    .map(
      function (
        word
      ) {

        return createStandardQuestion(
          word,
          eligible,
          choices,
          "english-to-thai"
        );

      }
    );

}


/* =========================================================
   MEANING
========================================================= */

function createMeaningQuestions() {

  const eligible =
    getTranslationEligibleWords();


  const targets =
    getWeakPracticeTargets(
      eligible
    );


  const total =
    Math.min(

      positiveInteger(
        gameSettings.questionsPerGame,
        10
      ),

      targets.length

    );


  const choices =
    getChoiceCount(
      eligible
    );


  return selectAdaptiveTargets(
    targets,
    total
  )
    .map(
      function (
        word
      ) {

        return createStandardQuestion(
          word,
          eligible,
          choices,
          "thai-to-english"
        );

      }
    );

}


/* =========================================================
   WEAK QUESTIONS
========================================================= */

function createWeakQuestions() {

  const weakWords =
    getSelectedWeakWords();


  const eligible =
    getTranslationEligibleWords();


  const choices =
    Math.min(

      Math.max(
        2,

        positiveInteger(
          gameSettings.choices,
          4
        )
      ),

      eligible.length

    );


  /*
    Practice this word

    ถ้ามีคำเดียว
    ให้ฝึกซ้ำ 3 ครั้ง
  */

  if (
    weakWords.length ===
    1
  ) {

    const repeat =
      positiveInteger(
        gameSettings.repeatSingleWord,
        3
      );


    const result =
      [];


    for (
      let i = 0;
      i < repeat;
      i += 1
    ) {

      result.push(

        createStandardQuestion(
          weakWords[
            0
          ],
          eligible,
          choices,
          "english-to-thai"
        )

      );

    }


    return result;

  }


  /*
    Practice All

    ใช้ทุก Weak Word
    แต่ไม่เกิน questionsPerGame
  */

  const total =
    Math.min(

      positiveInteger(
        gameSettings.questionsPerGame,
        10
      ),

      weakWords.length

    );


  return shuffle(
    weakWords
  )
    .slice(
      0,
      total
    )
    .map(
      function (
        word
      ) {

        return createStandardQuestion(
          word,
          eligible,
          choices,
          "english-to-thai"
        );

      }
    );

}


function getSelectedWeakWords() {

  const selected =
    new Set(
      selectedWeakIds
    );


  return vocabulary.filter(
    function (
      word
    ) {

      return (

        selected.has(
          word.id
        )

        &&

        word.word

        &&

        word.thai

      );

    }
  );

}


/* =========================================================
   ELIGIBLE
========================================================= */

function getTranslationEligibleWords() {

  return vocabulary.filter(
    function (
      word
    ) {

      return Boolean(
        word.word &&
        word.thai
      );

    }
  );

}


function getChoiceCount(
  eligible
) {

  return Math.min(

    Math.max(
      2,

      positiveInteger(
        gameSettings.choices,
        4
      )
    ),

    eligible.length

  );

}


/* =========================================================
   SYNONYM
========================================================= */

function getSynonymEligibleWords() {

  return vocabulary.filter(
    function (
      word
    ) {

      return (

        word.word &&

        word.synonyms.length >
        0

      );

    }
  );

}


function createSynonymQuestions() {

  const eligible =
    getSynonymEligibleWords();


  const targets =
    getWeakPracticeTargets(
      eligible
    );


  const total =
    Math.min(

      positiveInteger(
        gameSettings.questionsPerGame,
        10
      ),

      targets.length

    );


  return selectAdaptiveTargets(
    targets,
    total
  )
    .map(
      createSingleSynonymQuestion
    )
    .filter(
      Boolean
    );

}


function createSingleSynonymQuestion(
  word
) {

  const maxChoices =
    Math.max(

      2,

      positiveInteger(
        gameSettings.choices,
        6
      )

    );


  const synonyms =
    uniqueStrings(
      word.synonyms
    );


  if (
    synonyms.length ===
    0
  ) {

    return null;

  }


  let minCorrect =
    positiveInteger(
      gameSettings.minCorrectSynonyms,
      1
    );


  let maxCorrect =
    positiveInteger(
      gameSettings.maxCorrectSynonyms,
      synonyms.length
    );


  maxCorrect =
    Math.min(

      maxCorrect,

      synonyms.length,

      Math.max(
        1,
        maxChoices -
        1
      )

    );


  minCorrect =
    Math.max(

      1,

      Math.min(
        minCorrect,
        maxCorrect
      )

    );


  const correctCount =
    randomInteger(
      minCorrect,
      maxCorrect
    );


  const correct =
    shuffle(
      synonyms
    )
      .slice(
        0,
        correctCount
      );


  const distractors =
    shuffle(
      createSynonymDistractorPool(
        word
      )
    )
      .slice(
        0,
        Math.max(
          1,
          maxChoices -
          correct.length
        )
      );


  const options =
    shuffle(
      uniqueStrings(
        [
          ...correct,
          ...distractors
        ]
      )
    );


  if (
    options.length <
    2
  ) {

    return null;

  }


  return {

    wordId:
      word.id,

    sourceWord:
      word,

    prompt:
      word.word,

    subtext:
      word.meaning ||
      word.thai,

    correctAnswers:
      correct,

    options,

    correctCount:
      correct.length

  };

}


function createSynonymDistractorPool(
  currentWord
) {

  const blocked =
    new Set(

      [
        currentWord.word,
        ...currentWord.synonyms
      ]
        .map(
          normalizeCompare
        )

    );


  const result =
    [];


  vocabulary.forEach(
    function (
      word
    ) {

      if (
        word.word &&
        !blocked.has(
          normalizeCompare(
            word.word
          )
        )
      ) {

        result.push(
          word.word
        );

      }


      word.synonyms.forEach(
        function (
          synonym
        ) {

          if (
            !blocked.has(
              normalizeCompare(
                synonym
              )
            )
          ) {

            result.push(
              synonym
            );

          }

        }
      );

    }
  );


  return uniqueStrings(
    result
  );

}


/* =========================================================
   RENDER QUESTION
========================================================= */

function renderQuestion() {

  clearTimer();


  questionLocked =
    false;


  selectedSynonyms =
    new Set();


  hideFeedback();


  const question =
    questions[
      currentQuestionIndex
    ];


  if (
    !question
  ) {

    finishGame();

    return;

  }


  saveActiveVocabSession(
    currentQuestionIndex
  );

  const number =
    currentQuestionIndex +
    1;


  const percent =
    Math.round(
      (
        number /
        questions.length
      )
      *
      100
    );

  setCurrentActivity(
    currentUser?.uid,
    {
      type: "vocabulary",
      mode:
        practiceSource === "weak"
          ? "review"
          : gameMode,
      source:
        practiceSource,
      question:
        number,
      totalQuestions:
        questions.length,
      correct:
        correctAnswers,
      wrong:
        wrongAnswers,
      timeout:
        timeoutAnswers,
      startedAt:
        gameStartedAt
    }
  );


  questionCounter.textContent =
    `Question ${number} / ${questions.length}`;


  progressPercent.textContent =
    `${percent}%`;


  progressBar.style.width =
    `${percent}%`;


  questionText.textContent =
    question.prompt;


  questionSubtext.textContent =
    question.subtext ||
    "";


  questionSubtext.hidden =
    !question.subtext;


  renderAnswers(
    question
  );


  remainingValue.textContent =
    Math.max(
      questions.length -
      currentQuestionIndex,
      0
    );


  startQuestionTimer();


  questionElapsedBeforePauseMs =
    0;

  questionStartedAt =
    Date.now();

}


/* =========================================================
   RENDER ANSWERS
========================================================= */

function renderAnswers(
  question
) {

  answersGrid.innerHTML =
    "";


  const isSynonym =
    gameMode ===
    "synonym";


  synonymHint.hidden =
    !isSynonym;


  submitSynonymBtn.hidden =
    !isSynonym;


  submitSynonymBtn.disabled =
    true;


  if (
    isSynonym
  ) {

    synonymHintText.textContent =

      gameSettings.showCorrectCount !==
      false

        ? `Select ${question.correctCount} correct answer${question.correctCount > 1 ? "s" : ""}`

        : "Select all correct answers";

  }


  question.options.forEach(
    function (
      option,
      index
    ) {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "answer-button";


      button.dataset.answer =
        option;


      button.innerHTML = `

        <span class="answer-letter">
          ${String.fromCharCode(65 + index)}
        </span>

        <span class="answer-text"></span>

      `;


      button
        .querySelector(
          ".answer-text"
        )
        .textContent =
          option;


      button.addEventListener(
        "click",
        function () {

          if (
            gameMode ===
            "synonym"
          ) {

            toggleSynonymAnswer(
              button,
              option
            );

          }

          else {

            submitSingleAnswer(
              option
            );

          }

        }
      );


      answersGrid.appendChild(
        button
      );

    }
  );

}


/* =========================================================
   SINGLE ANSWER
========================================================= */

function submitSingleAnswer(
  answer
) {

  if (
    questionLocked ||
    gamePaused
  ) {

    return;

  }


  questionLocked =
    true;


  clearTimer();


  const question =
    questions[
      currentQuestionIndex
    ];


  const correctAnswer =
    question.correctAnswers[
      0
    ];


  const isCorrect =

    normalizeCompare(
      answer
    )

    ===

    normalizeCompare(
      correctAnswer
    );


  markSingleAnswers(
    answer,
    correctAnswer
  );


  const responseTime =
    getCurrentResponseTime();


  if (
    isCorrect
  ) {

    handleCorrect(
      question,
      responseTime
    );

  }

  else {

    handleWrong(

      question,

      responseTime,

      `คำตอบที่ถูกต้องคือ "${correctAnswer}"`

    );

  }


  scheduleNextQuestion();

}


/* =========================================================
   SYNONYM
========================================================= */

function toggleSynonymAnswer(
  button,
  answer
) {

  if (
    questionLocked
  ) {

    return;

  }


  const value =
    normalizeCompare(
      answer
    );


  if (
    selectedSynonyms.has(
      value
    )
  ) {

    selectedSynonyms.delete(
      value
    );


    button.classList.remove(
      "selected"
    );

  }

  else {

    selectedSynonyms.add(
      value
    );


    button.classList.add(
      "selected"
    );

  }


  submitSynonymBtn.disabled =
    selectedSynonyms.size ===
    0;

}


submitSynonymBtn
  ?.addEventListener(
    "click",
    submitSynonymAnswer
  );


function submitSynonymAnswer() {

  if (
    questionLocked ||
    selectedSynonyms.size ===
    0
  ) {

    return;

  }


  questionLocked =
    true;


  clearTimer();


  const question =
    questions[
      currentQuestionIndex
    ];


  const correctSet =
    new Set(

      question.correctAnswers.map(
        normalizeCompare
      )

    );


  const isCorrect =
    setsEqual(
      selectedSynonyms,
      correctSet
    );


  markSynonymAnswers(
    correctSet
  );


  const responseTime =
    getCurrentResponseTime();


  if (
    isCorrect
  ) {

    handleCorrect(
      question,
      responseTime
    );

  }

  else {

    handleWrong(

      question,

      responseTime,

      `คำตอบที่ถูกคือ ${question.correctAnswers.join(", ")}`

    );

  }


  scheduleNextQuestion();

}


/* =========================================================
   HANDLE CORRECT
========================================================= */

function handleCorrect(
  question,
  responseTime
) {

  correctAnswers +=
    1;


  score +=

    100 +

    Math.max(
      0,
      timeRemaining
    );


  totalResponseTimeMs +=
    responseTime;


  saveLearningAttempt(

    question,

    "correct",

    responseTime

  );


  updateStats();


  showFeedback(
    "correct",
    "✓",
    "Correct!",
    gameMode === "weak"
      ? "เยี่ยมมาก! กำลังฟื้นความแม่นของคำนี้"
      : "เยี่ยมมาก! คำตอบถูกต้อง"
  );

  saveActiveVocabSession(
    currentQuestionIndex + 1
  );

}


/* =========================================================
   HANDLE WRONG
========================================================= */

function handleWrong(
  question,
  responseTime,
  message
) {

  wrongAnswers +=
    1;


  totalResponseTimeMs +=
    responseTime;


  saveLearningAttempt(

    question,

    "wrong",

    responseTime

  );


  updateStats();


  showFeedback(
    "wrong",
    "×",
    "Not quite",
    message
  );


  playWrongFeedbackSound();

  mistakeQuestions.push(
    question
  );

  saveActiveVocabSession(
    currentQuestionIndex + 1
  );


  checkWrongLimit();

}


/* =========================================================
   FIRESTORE WORD STATS — CLOUD ONLY
========================================================= */

let wordStatsCloudQueue = Promise.resolve();
let gameFinishing = false;
const WORD_STAT_SYNC_RETRIES = 2;
const WORD_STAT_RETRY_DELAY_MS = 350;

function waitForCloudRetry(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function recordAttemptWithRetry(payload) {
  let lastError = null;
  for (let attempt = 0; attempt <= WORD_STAT_SYNC_RETRIES; attempt += 1) {
    try { return await recordWordAttemptCloud(payload); }
    catch (error) {
      lastError = error;
      if (attempt < WORD_STAT_SYNC_RETRIES) await waitForCloudRetry(WORD_STAT_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

function saveLearningAttempt(question, outcome, responseTime) {
  const payload = { uid: currentUser.uid, word: question?.sourceWord || {}, mode: gameMode, outcome, responseTimeMs: responseTime };
  wordStatsCloudQueue = wordStatsCloudQueue
    .catch((error) => console.warn("Previous Word Stat write failed:", error))
    .then(() => recordAttemptWithRetry(payload));
}

function setupVocabGameControls() {
  const pauseButton =
    $("pauseGameBtn");

  pauseButton
    ?.addEventListener(
      "click",
      toggleVocabPause
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

      if (
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        toggleVocabPause();
        return;
      }

      if (gamePaused) {
        return;
      }

      if (
        event.key === "Enter" &&
        gameMode === "synonym" &&
        !submitSynonymBtn.hidden &&
        !submitSynonymBtn.disabled
      ) {
        event.preventDefault();
        submitSynonymAnswer();
        return;
      }

      const key =
        event.key.toLowerCase();

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
        questionLocked
      ) {
        return;
      }

      const buttons =
        Array.from(
          document.querySelectorAll(
            ".answer-button"
          )
        );

      const button =
        buttons[
          map[key]
        ];

      if (
        button &&
        !button.disabled
      ) {
        event.preventDefault();
        button.click();
      }
    }
  );
}

function toggleVocabPause() {
  const button =
    $("pauseGameBtn");

  if (
    questionLocked ||
    gameFinishing
  ) {
    return;
  }

  if (gamePaused) {
    gamePaused = false;
    document.body.classList.remove(
      "game-paused"
    );

    if (button) {
      button.textContent =
        "⏸ Pause";
      button.disabled =
        pauseUsed;
    }

    startQuestionTimer(
      true
    );
    questionStartedAt =
      Date.now();

    return;
  }

  if (pauseUsed) {
    return;
  }

  pauseUsed = true;
  gamePaused = true;

  if (questionStartedAt) {
    questionElapsedBeforePauseMs +=
      Math.max(
        0,
        Date.now() -
        questionStartedAt
      );
  }

  clearTimer();

  document.body.classList.add(
    "game-paused"
  );

  if (button) {
    button.textContent =
      "▶ Resume";
  }
}


/* =========================================================
   TIMER
========================================================= */

function startQuestionTimer(
  preserveRemaining = false
) {

  clearTimer();


  if (!preserveRemaining) {
    timeRemaining =
      positiveInteger(
        gameSettings.timePerQuestion,
        15
      );
  }


  updateTimerUI();


  timerInterval =
    setInterval(
      function () {

        timeRemaining -=
          1;


        updateTimerUI();


        if (
          timeRemaining <=
          0
        ) {

          handleTimeout();

        }

      },
      1000
    );

}


function updateTimerUI() {

  timerValue.textContent =
    Math.max(
      0,
      timeRemaining
    );


  timerBox.classList.remove(
    "warning",
    "danger"
  );


  if (
    timeRemaining <=
    5
  ) {

    timerBox.classList.add(
      "danger"
    );

  }

  else if (
    timeRemaining <=
    10
  ) {

    timerBox.classList.add(
      "warning"
    );

  }

}


function clearTimer() {

  if (
    timerInterval
  ) {

    clearInterval(
      timerInterval
    );


    timerInterval =
      null;

  }

}


/* =========================================================
   TIMEOUT
========================================================= */

function handleTimeout() {

  if (
    questionLocked
  ) {

    return;

  }


  questionLocked =
    true;


  clearTimer();


  const question =
    questions[
      currentQuestionIndex
    ];


  timeoutAnswers +=
    1;


  const responseTime =
    getCurrentResponseTime();


  totalResponseTimeMs +=
    responseTime;


  saveLearningAttempt(

    question,

    "timeout",

    responseTime

  );


  updateStats();

  mistakeQuestions.push(
    question
  );

  saveActiveVocabSession(
    currentQuestionIndex + 1
  );


  disableAllAnswers();


  if (
    gameMode ===
    "synonym"
  ) {

    markSynonymAnswers(

      new Set(
        question.correctAnswers.map(
          normalizeCompare
        )
      )

    );

  }

  else {

    markCorrectAnswer(
      question.correctAnswers[
        0
      ]
    );

  }


  showFeedback(

    "timeout",

    "◷",

    "Time's up!",

    `คำตอบที่ถูกคือ ${question.correctAnswers.join(", ")}`

  );


  checkWrongLimit();


  scheduleNextQuestion();

}


/* =========================================================
   WRONG LIMIT
========================================================= */

function checkWrongLimit() {

  if (
    gameSettings.wrongLimitEnabled !==
    true
  ) {

    return;

  }


  const limit =
    positiveInteger(
      gameSettings.maxWrong,
      3
    );


  /*
    Wrong + Timeout = Mistake
  */

  if (
    (
      wrongAnswers +
      timeoutAnswers
    )
    >=
    limit
  ) {

    endedByWrongLimit =
      true;

  }

}


/* =========================================================
   RESPONSE TIME
========================================================= */

function getCurrentResponseTime() {

  if (
    !questionStartedAt
  ) {

    return 0;

  }


  return Math.max(
    0,
    questionElapsedBeforePauseMs +
    Date.now() -
    questionStartedAt
  );

}


/* =========================================================
   MARK ANSWERS
========================================================= */

function markSingleAnswers(
  selected,
  correct
) {

  answersGrid
    .querySelectorAll(
      ".answer-button"
    )
    .forEach(
      function (
        button
      ) {

        button.disabled =
          true;


        const value =
          normalizeCompare(
            button.dataset.answer
          );


        if (
          value ===
          normalizeCompare(
            correct
          )
        ) {

          button.classList.add(
            "correct"
          );

        }

        else if (
          value ===
          normalizeCompare(
            selected
          )
        ) {

          button.classList.add(
            "wrong"
          );

        }

      }
    );

}


function markSynonymAnswers(
  correctSet
) {

  answersGrid
    .querySelectorAll(
      ".answer-button"
    )
    .forEach(
      function (
        button
      ) {

        button.disabled =
          true;


        const value =
          normalizeCompare(
            button.dataset.answer
          );


        if (
          correctSet.has(
            value
          )
        ) {

          button.classList.add(
            "correct"
          );

        }

        else if (
          selectedSynonyms.has(
            value
          )
        ) {

          button.classList.add(
            "wrong"
          );

        }


        button.classList.remove(
          "selected"
        );

      }
    );


  submitSynonymBtn.disabled =
    true;

}


function markCorrectAnswer(
  correct
) {

  answersGrid
    .querySelectorAll(
      ".answer-button"
    )
    .forEach(
      function (
        button
      ) {

        button.disabled =
          true;


        if (
          normalizeCompare(
            button.dataset.answer
          )
          ===
          normalizeCompare(
            correct
          )
        ) {

          button.classList.add(
            "correct"
          );

        }

      }
    );

}


function disableAllAnswers() {

  answersGrid
    .querySelectorAll(
      ".answer-button"
    )
    .forEach(
      function (
        button
      ) {

        button.disabled =
          true;

      }
    );


  submitSynonymBtn.disabled =
    true;

}


/* =========================================================
   NEXT
========================================================= */

function scheduleNextQuestion() {

  const delay =
    clampNumber(

      Number(
        globalSettings
          ?.wrongFeedbackDuration
      )
      ||
      900,

      500,

      2500

    );


  setTimeout(
    function () {

      if (
        endedByWrongLimit
      ) {

        finishGame();

        return;

      }


      currentQuestionIndex +=
        1;


      if (
        currentQuestionIndex >=
        questions.length
      ) {

        finishGame();

        return;

      }


      renderQuestion();

    },
    delay
  );

}


/* =========================================================
   FINISH GAME + PHASE C FIRESTORE HISTORY
========================================================= */

async function finishGame() {

  /*
    กัน finishGame ถูกเรียกซ้ำจาก timer / wrong limit / next question
  */
  if (
    gameFinishing
  ) {

    return;

  }


  gameFinishing =
    true;

  clearCurrentActivity(
    currentUser?.uid
  );

  clearTimer();


  const completedAt =
    new Date()
      .toISOString();


  const answered =

    correctAnswers +

    wrongAnswers +

    timeoutAnswers;


  const accuracy =

    answered > 0

      ? Math.round(
          (
            correctAnswers /
            answered
          )
          *
          100
        )

      : 0;


  const averageResponseMs =

    answered > 0

      ? Math.round(
          totalResponseTimeMs /
          answered
        )

      : 0;


  const result = {

    mode:
      gameMode,

    totalQuestions:
      answered,

    plannedQuestions:
      questions.length,

    correct:
      correctAnswers,

    wrong:
      wrongAnswers,

    timeout:
      timeoutAnswers,

    accuracy,

    score,

    averageResponse:
      Number(
        (
          averageResponseMs /
          1000
        ).toFixed(
          1
        )
      ),

    averageResponseMs,

    durationMs:
      Math.max(
        0,
        Date.now() -
        gameStartedAt
      ),

    endedByWrongLimit,

    practiceSource,

    weakWordCount:
      isWeakPractice()

        ? selectedWeakIds.length

        : 0,

    mistakes:
      mistakeQuestions,

    completedAt

  };


  const {
    mistakes: resultMistakes,
    ...historyItem
  } = result;


  clearActiveVocabSession();

  /* STEP 1 — Persist Result navigation state first. */
  saveLastResult(
    result
  );


  /*
    Verify the state synchronously before leaving game.html.
    If a browser/storage edge case occurs, retry once.
  */
  if (
    !getLastResult()
  ) {

    saveLastResult(
      historyItem
    );

  }


  /*
    STEP 2 — Cloud sync is important, but it must never trap the user
    on the game page. Give it a short window, then continue to Result.

    Pending Firestore work may still finish before navigation; if not,
    the Result UX remains reliable and the local result state is safe.
  */
  try {

    const cloudSync =
      (async function () {

        await wordStatsCloudQueue;


        await saveGameHistoryCloud(
          currentUser.uid,
          historyItem
        );


        await recordDailyGameCloud(
          currentUser.uid,
          historyItem
        );

      })();


    const syncTimeout =
      new Promise(
        function (
          resolve
        ) {

          setTimeout(
            resolve,
            2200
          );

        }
      );


    await Promise.race(
      [
        cloudSync,
        syncTimeout
      ]
    );

  }

  catch (
    error
  ) {

    console.warn(
      "Game History Cloud Sync failed:",
      error
    );

  }


  /* STEP 3 — Result Page is always the final destination. */
  window.location.href =
    "./result.html";

}


/* =========================================================
   FEEDBACK
========================================================= */

function showFeedback(
  type,
  icon,
  title,
  text
) {

  if (
    globalSettings
      ?.wrongFeedbackEnabled ===
      false

    &&

    type !==
      "correct"
  ) {

    return;

  }


  answerFeedback.hidden =
    false;


  answerFeedback.className =
    `answer-feedback ${type}`;


  feedbackIcon.textContent =
    icon;


  feedbackTitle.textContent =
    title;


  feedbackText.textContent =
    text;

}


function hideFeedback() {

  answerFeedback.hidden =
    true;


  answerFeedback.className =
    "answer-feedback";

}


/* =========================================================
   SOUND
========================================================= */

function playWrongFeedbackSound() {

  if (
    globalSettings
      ?.wrongFeedbackSoundEnabled !==
      true
  ) {

    return;

  }


  const url =
    normalizeText(
      globalSettings
        ?.wrongFeedbackSoundUrl
    );


  if (
    !url
  ) {

    return;

  }


  try {

    const audio =
      new Audio(
        url
      );


    audio.volume =
      .55;


    audio.play()
      .catch(
        function () {}
      );

  }

  catch (
    error
  ) {

    console.warn(
      "Sound error:",
      error
    );

  }

}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

  if (
    scoreValue
  ) {

    scoreValue.textContent =
      score;

  }


  if (
    correctValue
  ) {

    correctValue.textContent =
      correctAnswers;

  }


  if (
    wrongValue
  ) {

    wrongValue.textContent =
      wrongAnswers;

  }


  if (
    timeoutValue
  ) {

    timeoutValue.textContent =
      timeoutAnswers;

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function bindNavigation() {

  [
    "backToGamesBtn",
    "errorBackBtn",
    "resultBackBtn"
  ]
    .forEach(
      function (
        id
      ) {

        $(
          id
        )
          ?.addEventListener(
            "click",
            function () {

              /*
                ถ้าเป็น Weak Game
                กลับ Weak Words

                Game ปกติกลับ Games
              */

              window.location.href =

                isWeakPractice()

                  ? "./review.html"

                  : "./practice.html";

            }
          );

      }
    );


  $("retryGameBtn")
    ?.addEventListener(
      "click",
      function () {

        window.location.reload();

      }
    );

}


/* =========================================================
   USER
========================================================= */

function renderUser() {

  const name =
    getPlayerName();


  const userName =
    $("gameUserName");


  const avatar =
    $("gameUserAvatar");


  if (
    userName
  ) {

    userName.textContent =
      name;

  }


  if (
    avatar
  ) {

    avatar.textContent =

      name
        .charAt(0)
        .toUpperCase()

      ||

      "P";

  }

}


function getPlayerName() {

  return (

    currentProfile
      ?.displayName

    ||

    currentUser
      ?.displayName

    ||

    currentUser
      ?.email
      ?.split("@")[0]

    ||

    "Player"

  );

}


/* =========================================================
   ERRORS
========================================================= */

function showError(
  message
) {

  clearTimer();


  if (
    gameLoading
  ) {

    gameLoading.hidden =
      true;

  }


  if (
    gameArea
  ) {

    gameArea.hidden =
      true;

  }


  if (
    gameError
  ) {

    gameError.hidden =
      false;

  }


  if (
    gameErrorMessage
  ) {

    gameErrorMessage.textContent =
      message;

  }

}


function getFriendlyError(
  error
) {

  const message =
    String(
      error?.message ||
      error ||
      ""
    );


  if (
    message.includes(
      "NOT_ENOUGH_VOCABULARY"
    )
  ) {

    return "ต้องมีคำศัพท์ Active อย่างน้อย 2 คำ";

  }


  if (
    message.includes(
      "NOT_ENOUGH_SYNONYMS"
    )
  ) {

    return "ยังไม่มีคำศัพท์ที่มี Synonym เพียงพอ";

  }


  if (
    message.includes(
      "NO_WEAK_WORDS"
    )
  ) {

    return "ไม่พบ Weak Words ที่เลือก หรือคำศัพท์ดังกล่าวถูกปิดใช้งานแล้ว";

  }


  return "เกิดข้อผิดพลาดระหว่างเตรียมเกม กรุณาลองใหม่";

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeText(
  value
) {

  return String(
    value ?? ""
  ).trim();

}


function normalizeCompare(
  value
) {

  return normalizeText(
    value
  )
    .toLowerCase();

}


function normalizeSynonyms(
  value
) {

  if (
    Array.isArray(
      value
    )
  ) {

    return uniqueStrings(
      value
    );

  }


  if (
    typeof value ===
    "string"
  ) {

    return uniqueStrings(

      value.split(
        /[,;\n]/
      )

    );

  }


  return [];

}


function uniqueStrings(
  values
) {

  const valuesMap =
    new Map();


  values.forEach(
    function (
      value
    ) {

      const text =
        normalizeText(
          value
        );


      if (
        !text
      ) {

        return;

      }


      valuesMap.set(
        text.toLowerCase(),
        text
      );

    }
  );


  return [
    ...valuesMap.values()
  ];

}


function shuffle(
  array
) {

  const result =
    [
      ...array
    ];


  for (
    let i =
      result.length -
      1;

    i >
      0;

    i -=
      1
  ) {

    const j =
      Math.floor(

        Math.random() *
        (
          i +
          1
        )

      );


    [
      result[
        i
      ],
      result[
        j
      ]
    ] =
    [
      result[
        j
      ],
      result[
        i
      ]
    ];

  }


  return result;

}


function positiveInteger(
  value,
  fallback
) {

  const number =
    Math.floor(
      Number(
        value
      )
    );


  return (

    Number.isFinite(
      number
    )

    &&

    number >
      0

  )
    ? number
    : fallback;

}


function randomInteger(
  min,
  max
) {

  if (
    max <=
    min
  ) {

    return min;

  }


  return (

    Math.floor(

      Math.random() *
      (
        max -
        min +
        1
      )

    )

    +

    min

  );

}


function setsEqual(
  first,
  second
) {

  if (
    first.size !==
    second.size
  ) {

    return false;

  }


  for (
    const value
    of first
  ) {

    if (
      !second.has(
        value
      )
    ) {

      return false;

    }

  }


  return true;

}


function clampNumber(
  value,
  min,
  max
) {

  return Math.min(

    Math.max(
      value,
      min
    ),

    max

  );

}


window.addEventListener(
  "beforeunload",
  clearTimer
);