/* =========================================================
   VOCAB ONNY
   RESULT PAGE
========================================================= */

import {
  waitForAuthUser
} from "../core/auth.js";


import {
  getLastResult,
  clearLastResult
} from "../core/transient-storage.js";


/* =========================================================
   ELEMENT HELPER
========================================================= */

function $(
  id
) {

  return document.getElementById(
    id
  );

}


/* =========================================================
   NUMBER HELPER
========================================================= */

function toNumber(
  value,
  fallback = 0
) {

  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : fallback;

}


/* =========================================================
   PERFORMANCE LEVEL

   0 - 19%   = แย่มาก 🐃
   20 - 39%  = อ่อน 😢
   40 - 59%  = ปานกลาง 😐
   60 - 79%  = ดี 😊
   80 - 100% = ดีมาก 🤩
========================================================= */

function getPerformance(
  accuracy
) {

  const value =
    Math.max(
      0,
      Math.min(
        100,
        toNumber(
          accuracy
        )
      )
    );


  /* =========================
     0 - 19%
  ========================== */

  if (
    value < 20
  ) {

    return {

      label:
        "แย่มาก",

      range:
        "0 - 19%",

      headline:
        "ลองใหม่อีกครั้ง",

      emoji:
        "🐃",

      className:
        "performance-very-poor",

      color:
        "#ef5350",

      softColor:
        "#ffebee",

      message:
        "ยังต้องฝึกอีกเยอะ ลองใหม่อีกครั้งนะ!"

    };

  }


  /* =========================
     20 - 39%
  ========================== */

  if (
    value < 40
  ) {

    return {

      label:
        "อ่อน",

      range:
        "20 - 39%",

      headline:
        "ยังไปต่อได้",

      emoji:
        "😢",

      className:
        "performance-poor",

      color:
        "#ff8a3d",

      softColor:
        "#fff1e7",

      message:
        "ยังไหว! ทบทวนคำที่พลาด แล้วลองใหม่อีกครั้ง"

    };

  }


  /* =========================
     40 - 59%
  ========================== */

  if (
    value < 60
  ) {

    return {

      label:
        "ปานกลาง",

      range:
        "40 - 59%",

      headline:
        "ทำได้ดีขึ้นแล้ว",

      emoji:
        "😐",

      className:
        "performance-average",

      color:
        "#e6aa1c",

      softColor:
        "#fff8df",

      message:
        "กำลังดี! ขยับอีกหน่อยก็เข้าสู่ระดับดีแล้ว"

    };

  }


  /* =========================
     60 - 79%
  ========================== */

  if (
    value < 80
  ) {

    return {

      label:
        "ดี",

      range:
        "60 - 79%",

      headline:
        "Good job",

      emoji:
        "😊",

      className:
        "performance-good",

      color:
        "#2fba70",

      softColor:
        "#e9f8ef",

      message:
        "ทำได้ดีมาก! ฝึกต่ออีกนิด คะแนนจะยิ่งดีขึ้น"

    };

  }


  /* =========================
     80 - 100%
  ========================== */

  return {

    label:
      "ดีมาก",

    range:
      "80 - 100%",

    headline:
      "Great job",

    emoji:
      "🤩",

    className:
      "performance-excellent",

    color:
      "#2196f3",

    softColor:
      "#e5f3ff",

    message:
      "ยอดเยี่ยมมาก! ทำได้ดีสุด ๆ รักษาระดับนี้ไว้เลย"

  };

}


/* =========================================================
   VERY POOR RESULT SOUND
========================================================= */

const resultSoundState = {
  played: false,
  retryBound: false
};


function playVeryPoorResultSound(
  accuracy
) {

  if (
    toNumber(
      accuracy
    ) >= 20 ||
    resultSoundState.played
  ) {

    return;

  }


  const tryPlay =
    function () {

      const audio =
        new Audio(
          "../assets/sound/moo.mp3"
        );


      audio.volume =
        0.9;


      const playPromise =
        audio.play();


      if (
        playPromise &&
        typeof playPromise.then ===
          "function"
      ) {

        return playPromise
          .then(
            function () {

              resultSoundState.played =
                true;

            }
          );

      }


      resultSoundState.played =
        true;

      return Promise.resolve();

    };


  tryPlay()
    .catch(
      function () {

        /*
          Safari / mobile browsers may block autoplay after navigation.
          Retry once on the next real user interaction.
        */
        if (
          resultSoundState.retryBound
        ) {

          return;

        }


        resultSoundState.retryBound =
          true;


        const retry =
          function () {

            document.removeEventListener(
              "pointerdown",
              retry
            );

            document.removeEventListener(
              "keydown",
              retry
            );


            tryPlay()
              .catch(
                function () {

                  /* Keep the result page usable even if audio is blocked. */

                }
              );

          };


        document.addEventListener(
          "pointerdown",
          retry,
          {
            once: true
          }
        );

        document.addEventListener(
          "keydown",
          retry,
          {
            once: true
          }
        );

      }
    );

}


/* =========================================================
   MODE NAME
========================================================= */

function getModeName(
  mode
) {

  switch (mode) {

    case "translation":

      return "Translation";


    case "meaning":

      return "Meaning";


    case "synonym":

      return "Synonym";


    case "weak":

      return "Weak Words";

    case "grammar-part5":
      return "TOEIC Part 5";

    case "grammar-fill":
      return "Fill in the Blank";

    case "grammar-error":
      return "Error Detection";

    case "grammar-sentence":
      return "Sentence Building";


    default:

      return "Vocabulary";

  }

}


/* =========================================================
   MODE BODY CLASS
========================================================= */

function setModeClass(
  mode
) {

  document.body.classList.remove(
    "mode-translation",
    "mode-meaning",
    "mode-synonym",
    "mode-weak",
    "mode-grammar"
  );


  if (
    mode === "grammar"
  ) {
    document.body.classList.add(
      "mode-grammar"
    );
    return;
  }

  if (
    [
      "translation",
      "meaning",
      "synonym",
      "weak"
    ].includes(mode)
  ) {

    document.body.classList.add(
      `mode-${mode}`
    );

  }

}


/* =========================================================
   FORMAT DURATION
========================================================= */

function formatDuration(
  seconds
) {

  const safeSeconds =
    Math.max(
      0,
      Math.round(
        toNumber(
          seconds
        )
      )
    );


  const minutes =
    Math.floor(
      safeSeconds / 60
    );


  const remainingSeconds =
    safeSeconds % 60;


  return (
    `${minutes}:` +
    String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )
  );

}


/* =========================================================
   FORMAT RESPONSE TIME
========================================================= */

function formatResponseTime(
  milliseconds
) {

  const ms =
    Math.max(
      0,
      toNumber(
        milliseconds
      )
    );


  return (
    `${(
      ms / 1000
    ).toFixed(1)}s`
  );

}


/* =========================================================
   CALCULATE ACCURACY

   Timeout ถือว่าไม่ถูก
========================================================= */

function calculateAccuracy(
  result
) {

  /*
    ใช้ Accuracy ที่ Game Engine
    บันทึกมาก่อน ถ้ามี
  */

  const savedAccuracy =
    Number(
      result?.accuracy
    );


  if (
    Number.isFinite(
      savedAccuracy
    )
  ) {

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          savedAccuracy
        )
      )
    );

  }


  /*
    Fallback:
    correct / totalQuestions
  */

  const correct =
    Math.max(
      0,
      toNumber(
        result?.correct
      )
    );


  const questions =
    Math.max(
      0,
      toNumber(
        result?.totalQuestions ??
        result?.questions
      )
    );


  if (
    questions <= 0
  ) {

    return 0;

  }


  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (
          correct /
          questions
        ) * 100
      )
    )
  );

}


/* =========================================================
   CALCULATE AVERAGE RESPONSE

   รองรับหลายชื่อ field
========================================================= */

function getAverageResponseMs(
  result
) {

  /*
    ถ้า Game Engine บันทึก
    averageResponseTimeMs มาแล้ว
  */

  const directMs =
    Number(
      result?.averageResponseTimeMs
    );


  if (
    Number.isFinite(
      directMs
    )
  ) {

    return Math.max(
      0,
      directMs
    );

  }


  /*
    รองรับ avgResponseTimeMs
  */

  const alternateMs =
    Number(
      result?.avgResponseTimeMs
    );


  if (
    Number.isFinite(
      alternateMs
    )
  ) {

    return Math.max(
      0,
      alternateMs
    );

  }


  /*
    คำนวณจาก totalResponseTimeMs
  */

  const totalResponse =
    Number(
      result?.totalResponseTimeMs
    );


  const answered =
    Math.max(
      0,
      toNumber(
        result?.answeredQuestions ??
        result?.totalQuestions ??
        result?.questions
      )
    );


  if (
    Number.isFinite(
      totalResponse
    ) &&
    answered > 0
  ) {

    return (
      totalResponse /
      answered
    );

  }


  return 0;

}


/* =========================================================
   GET DURATION SECONDS
========================================================= */

function getDurationSeconds(
  result
) {

  /*
    durationSeconds
  */

  const directSeconds =
    Number(
      result?.durationSeconds
    );


  if (
    Number.isFinite(
      directSeconds
    )
  ) {

    return Math.max(
      0,
      directSeconds
    );

  }


  /*
    durationMs
  */

  const durationMs =
    Number(
      result?.durationMs
    );


  if (
    Number.isFinite(
      durationMs
    )
  ) {

    return Math.max(
      0,
      durationMs / 1000
    );

  }


  /*
    duration
    สมมติว่าเป็น seconds
  */

  const duration =
    Number(
      result?.duration
    );


  if (
    Number.isFinite(
      duration
    )
  ) {

    return Math.max(
      0,
      duration
    );

  }


  return 0;

}


/* =========================================================
   RENDER PERFORMANCE
========================================================= */

function renderPerformance(
  accuracy
) {

  const performance =
    getPerformance(
      accuracy
    );


  /* =========================
     EMOJI
  ========================== */

  const icon =
    $("resultIcon");


  if (icon) {

    icon.textContent =
      performance.emoji;

  }


  /* =========================
     LEVEL
  ========================== */

  const level =
    $("performanceLevel");


  if (level) {

    level.textContent =
      performance.label;

  }


  /* =========================
     RANGE
  ========================== */

  const range =
    $("performanceRange");


  if (range) {

    range.textContent =
      performance.range;

  }


  /* =========================
     HEADLINE
  ========================== */

  const headline =
    $("resultHeadline");


  if (headline) {

    headline.textContent =
      performance.headline ||
      "Great job";

  }


  /* =========================
     MESSAGE
  ========================== */

  const message =
    $("resultMessage");


  if (message) {

    message.textContent =
      performance.message;

  }


  /* =========================
     RESULT SOUND
  ========================== */

  playVeryPoorResultSound(
    accuracy
  );


  /* =========================
     CARD CLASS
  ========================== */

  const card =
    $("resultContent");


  if (card) {

    card.classList.remove(
      "performance-very-poor",
      "performance-poor",
      "performance-average",
      "performance-good",
      "performance-excellent"
    );


    card.classList.add(
      performance.className
    );


    /*
      CSS Variables
    */

    card.style.setProperty(
      "--performance-color",
      performance.color
    );


    card.style.setProperty(
      "--performance-soft",
      performance.softColor
    );

  }


  /* =========================
     ACCURACY RING
  ========================== */

  const ring =
    document.querySelector(
      ".accuracy-ring"
    );


  if (ring) {

    ring.style.setProperty(
      "--accuracy",
      `${accuracy * 3.6}deg`
    );


    ring.style.setProperty(
      "--performance-color",
      performance.color
    );


    ring.style.setProperty(
      "--performance-soft",
      performance.softColor
    );

  }

}


/* =========================================================
   RENDER RESULT
========================================================= */

function renderResult(
  result,
  user
) {

  if (!result) {

    showError();

    return;

  }


  /* =====================================================
     PLAYER
  ===================================================== */

  const playerName =
    result?.playerName ||
    result?.displayName ||
    user?.displayName ||
    user?.email?.split("@")?.[0] ||
    "Player";


  if (
    $("playerName")
  ) {

    $("playerName").textContent =
      playerName;

  }


  /* =====================================================
     MODE
  ===================================================== */

  const isGrammar =
    result?.practiceType ===
    "grammar";

  const mode =
    String(
      result?.mode ||
      "translation"
    ).toLowerCase();

  const grammarDisplayMode =
    String(
      result?.displayMode ||
      (
        result?.grammarMode
          ? "grammar-" +
            result.grammarMode
          : ""
      )
    ).toLowerCase();


  setModeClass(
    isGrammar
      ? "grammar"
      : mode
  );


  if (
    $("modeBadge")
  ) {

    if (isGrammar) {
      const modeName =
        getModeName(
          grammarDisplayMode
        );

      const chapter =
        String(
          result?.chapterTitle ||
          ""
        ).trim();

      $("modeBadge").textContent =
        chapter &&
        chapter !==
          "Mixed TOEIC Grammar"
          ? modeName +
            " · " +
            chapter
          : modeName +
            " · Mixed Grammar";
    } else {
      const modeName =
        getModeName(
          mode
        );


      $("modeBadge").textContent =
        result?.practiceSource ===
        "weak"

          ? `Weak Words · ${modeName}`

          : modeName;
    }

  }


  /* =====================================================
     VALUES
  ===================================================== */

  const correct =
    Math.max(
      0,
      Math.round(
        toNumber(
          result?.correct
        )
      )
    );


  const wrong =
    Math.max(
      0,
      Math.round(
        toNumber(
          result?.wrong
        )
      )
    );


  const timeout =
    Math.max(
      0,
      Math.round(
        toNumber(
          result?.timeout
        )
      )
    );


  /*
    รองรับทั้ง totalQuestions
    และ questions
  */

  let questions =
    Math.max(
      0,
      Math.round(
        toNumber(
          result?.totalQuestions ??
          result?.questions
        )
      )
    );


  /*
    ถ้าไม่มี totalQuestions
    ให้รวมจากผลลัพธ์
  */

  if (
    questions <= 0
  ) {

    questions =
      correct +
      wrong +
      timeout;

  }


  const score =
    Math.max(
      0,
      Math.round(
        toNumber(
          result?.score
        )
      )
    );


  const accuracy =
    calculateAccuracy(
      {
        ...result,
        correct,
        totalQuestions:
          questions
      }
    );


  const averageResponseMs =
    getAverageResponseMs(
      {
        ...result,
        totalQuestions:
          questions
      }
    );


  const durationSeconds =
    getDurationSeconds(
      result
    );


  /* =====================================================
     MAIN VALUES
  ===================================================== */

  if (
    $("accuracyValue")
  ) {

    $("accuracyValue").textContent =
      `${accuracy}%`;

  }


  if (
    $("correctValue")
  ) {

    $("correctValue").textContent =
      correct;

  }


  if (
    $("wrongValue")
  ) {

    $("wrongValue").textContent =
      wrong;

  }


  if (
    $("timeoutValue")
  ) {

    $("timeoutValue").textContent =
      timeout;

  }


  if (
    $("scoreValue")
  ) {

    $("scoreValue").textContent =
      score;

  }


  if (
    $("questionsValue")
  ) {

    $("questionsValue").textContent =
      questions;

  }


  if (
    $("averageResponseValue")
  ) {

    $("averageResponseValue").textContent =
      formatResponseTime(
        averageResponseMs
      );

  }


  if (
    $("durationValue")
  ) {

    $("durationValue").textContent =
      formatDuration(
        durationSeconds
      );

  }


  /* =====================================================
     PRACTICE MISTAKES
  ===================================================== */

  const mistakes =
    Array.isArray(
      result?.mistakes
    )
      ? result.mistakes
      : [];

  const mistakesButton =
    $("practiceMistakesBtn");

  if (mistakesButton) {
    mistakesButton.hidden =
      mistakes.length === 0;
  }

  if (
    $("practiceMistakesCount")
  ) {
    $("practiceMistakesCount")
      .textContent =
        mistakes.length > 0
          ? `(${mistakes.length})`
          : "";
  }


  /* =====================================================
     PERFORMANCE
  ===================================================== */

  renderPerformance(
    accuracy
  );


  /* =====================================================
     WRONG LIMIT NOTICE
  ===================================================== */

  const wrongLimitNotice =
    $("wrongLimitNotice");


  if (
    wrongLimitNotice
  ) {

    const endedByWrongLimit =
      Boolean(
        result?.endedByWrongLimit ||
        result?.wrongLimitReached ||
        result?.reason ===
          "wrong-limit"
      );


    wrongLimitNotice.hidden =
      !endedByWrongLimit;

  }


  /* =====================================================
     SHOW CONTENT
  ===================================================== */

  if (
    $("resultLoading")
  ) {

    $("resultLoading").hidden =
      true;

  }


  if (
    $("resultError")
  ) {

    $("resultError").hidden =
      true;

  }


  if (
    $("resultContent")
  ) {

    $("resultContent").hidden =
      false;

  }

}


/* =========================================================
   SHOW ERROR
========================================================= */

function showError() {

  if (
    $("resultLoading")
  ) {

    $("resultLoading").hidden =
      true;

  }


  if (
    $("resultContent")
  ) {

    $("resultContent").hidden =
      true;

  }


  if (
    $("resultError")
  ) {

    $("resultError").hidden =
      false;

  }

}


/* =========================================================
   GET CURRENT MODE
========================================================= */

function getCurrentMode(
  result
) {

  const mode =
    String(
      result?.mode ||
      "translation"
    ).toLowerCase();


  if (
    [
      "translation",
      "meaning",
      "synonym",
      "weak"
    ].includes(mode)
  ) {

    return mode;

  }


  return "translation";

}


/* =========================================================
   NAVIGATION
========================================================= */

function getBackDestination(
  result
) {
  if (
    result?.practiceType ===
    "grammar"
  ) {
    return "./practice.html#grammar-practice";
  }

  return result?.practiceSource ===
    "weak"
      ? "./review.html"
      : "./practice.html";
}

function setupNavigation(
  result
) {

  /* =========================
     PLAY AGAIN
  ========================== */

  $("playAgainBtn")
    ?.addEventListener(
      "click",

      () => {

        if (
          result?.practiceType ===
          "grammar"
        ) {
          const grammarMode =
            String(
              result?.grammarMode ||
              "part5"
            );

          const params =
            new URLSearchParams();

          params.set(
            "mode",
            grammarMode
          );

          if (
            result?.chapterId
          ) {
            params.set(
              "chapter",
              result.chapterId
            );
          }

          if (
            result?.requestedTopic
          ) {
            params.set(
              "topic",
              result.requestedTopic
            );
          }

          window.location.href =
            "./grammar-game.html?" +
            params.toString();

          return;
        }

        const mode =
          getCurrentMode(
            result
          );


        /*
          Weak Words
          มีหน้าของตัวเอง
        */

        if (
          mode === "weak"
        ) {

          window.location.href =
            "./review.html";

          return;

        }


        if (
          result?.practiceSource ===
          "weak"
        ) {

          window.location.href =
            "./game.html?mode=" +
            encodeURIComponent(
              mode
            ) +
            "&source=weak";

          return;

        }


        window.location.href =
          `./game.html?mode=${encodeURIComponent(
            mode
          )}`;

      }
    );


  /* =========================
     PRACTICE MISTAKES
  ========================== */

  $("practiceMistakesBtn")
    ?.addEventListener(
      "click",
      () => {
        const mistakes =
          Array.isArray(
            result?.mistakes
          )
            ? result.mistakes
            : [];

        if (!mistakes.length) {
          return;
        }

        if (
          result?.practiceType ===
          "grammar"
        ) {
          sessionStorage.setItem(
            "vocabOnnyGrammarMistakeQuestions",
            JSON.stringify(
              mistakes
            )
          );

          const params =
            new URLSearchParams();

          params.set(
            "mode",
            String(
              result?.grammarMode ||
              "part5"
            )
          );

          params.set(
            "source",
            "mistakes"
          );

          if (
            result?.chapterId
          ) {
            params.set(
              "chapter",
              result.chapterId
            );
          }

          window.location.href =
            "./grammar-game.html?" +
            params.toString();

          return;
        }

        sessionStorage.setItem(
          "vocabOnnyMistakeQuestions",
          JSON.stringify(
            mistakes
          )
        );

        const mode =
          getCurrentMode(
            result
          );

        window.location.href =
          "./game.html?mode=" +
          encodeURIComponent(
            mode
          ) +
          "&source=mistakes";
      }
    );


  /* =========================
     DASHBOARD
  ========================== */

  $("dashboardBtn")
    ?.addEventListener(
      "click",

      () => {

        window.location.href =
          "./dashboard.html";

      }
    );


  /* =========================
     HISTORY
  ========================== */

  $("historyBtn")
    ?.addEventListener(
      "click",

      () => {

        window.location.href =
          "./history.html";

      }
    );


  /* =========================
     BACK GAMES
  ========================== */

  $("backGamesBtn")
    ?.addEventListener(
      "click",

      () => {

        window.location.href =
          getBackDestination(
            result
          );

      }
    );


  $("backGamesTopBtn")
    ?.addEventListener(
      "click",

      () => {

        window.location.href =
          getBackDestination(
            result
          );

      }
    );


  /* =========================
     ERROR BACK
  ========================== */

  $("errorBackBtn")
    ?.addEventListener(
      "click",

      () => {

        window.location.href =
          getBackDestination(
            result
          );

      }
    );

}


/* =========================================================
   INIT
========================================================= */

async function initResultPage() {

  try {

    /* =====================================================
       GET RESULT FIRST

       Result state is local navigation data from the game page.
       Read it before waiting for Firebase auth so a slow auth restore
       cannot bounce the user away from the Result page.
    ===================================================== */

    const result =
      getLastResult();


    if (!result) {

      setupNavigation(
        null
      );


      showError();

      return;

    }


    /* =====================================================
       AUTH — DISPLAY ENHANCEMENT ONLY

       The user just came from an authenticated game page.
       We only wait for Firebase here to improve the displayed name.
       If auth restore is slow/unavailable, keep showing the result
       instead of redirecting away.
    ===================================================== */

    let user =
      null;


    try {

      user =
        await waitForAuthUser(
          15000
        );

    }

    catch (
      authError
    ) {

      console.warn(
        "Result auth restore delayed:",
        authError
      );

    }


    /* =====================================================
       NAVIGATION
    ===================================================== */

    setupNavigation(
      result
    );


    /* =====================================================
       RENDER
    ===================================================== */

    renderResult(
      result,
      user
    );


  } catch (error) {

    console.error(
      "Result page initialization failed:",
      error
    );


    showError();

  }

}


/* =========================================================
   START
========================================================= */

initResultPage();