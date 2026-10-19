import {
  db
} from "../core/firebase.js";

import {
  requireAdminPage,
  logoutUser
} from "../core/auth.js";

import {
  TOEIC_GRAMMAR_CHAPTERS,
  getGrammarChapter,
  inferGrammarChapterId
} from "../core/grammar-curriculum.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const $ = (id) =>
  document.getElementById(id);

let rows = [];
let adminUid = "";

document.addEventListener(
  "DOMContentLoaded",
  init
);

async function init() {
  const context =
    await requireAdminPage({
      loginPath: "../index.html",
      userPath: "../user/practice.html"
    });

  if (!context) return;

  adminUid = context.user.uid;

  renderAdminProfile(
    context.user,
    context.profile
  );

  renderChapterOptions();
  renderImportChapterOptions();

  bindEvents();
  bindLogout();
  setupGrammarImport();

  await loadQuestions();
}

function renderAdminProfile(user, profile) {
  const name =
    profile?.displayName ||
    "Administrator";

  const email =
    profile?.email ||
    user.email ||
    "";

  if ($("adminName")) {
    $("adminName").textContent = name;
  }

  if ($("adminEmail")) {
    $("adminEmail").textContent = email;
  }

  if ($("adminAvatar")) {
    $("adminAvatar").textContent =
      name.charAt(0).toUpperCase() || "A";
  }
}

function renderChapterOptions() {
  const select =
    $("grammarChapter");

  if (!select) return;

  const chapterOptions =
    TOEIC_GRAMMAR_CHAPTERS
      .map(function (chapter) {
        return (
          '<option value="' +
            chapter.id +
          '">' +
            chapter.no +
            " · " +
            chapter.title +
          '</option>'
        );
      })
      .join("");

  select.innerHTML =
    chapterOptions;

  const filter =
    $("grammarChapterFilter");

  if (filter) {
    filter.innerHTML =
      '<option value="all">All chapters</option>' +
      chapterOptions;
  }
}


function bindEvents() {
  $("grammarForm")
    ?.addEventListener(
      "submit",
      saveQuestion
    );

  $("resetGrammarFormBtn")
    ?.addEventListener(
      "click",
      resetForm
    );

  $("seedBtn")
    ?.addEventListener(
      "click",
      seedStarterQuestions
    );

  [
    "grammarSearch",
    "grammarModeFilter",
    "grammarChapterFilter",
    "grammarStatusFilter"
  ].forEach((id) => {
    $(id)?.addEventListener(
      "input",
      renderList
    );

    $(id)?.addEventListener(
      "change",
      renderList
    );
  });
}

async function loadQuestions() {
  setListMessage("Loading...");

  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "gameSettings"
        )
      );

    rows =
      snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }))
        .filter(function (item) {
          return (
            item.type ===
            "grammarQuestion"
          );
        });

    rows.sort((a, b) => {
      const left =
        String(a.topic || "")
          .toLowerCase();

      const right =
        String(b.topic || "")
          .toLowerCase();

      return left.localeCompare(right);
    });

    renderStats();
    renderList();

  } catch (error) {
    console.error(
      "Grammar admin load error:",
      error
    );

    setListMessage(
      "โหลด Grammar Questions ไม่สำเร็จ"
    );
  }
}

function renderStats() {
  const countMode =
    (mode) =>
      rows.filter(
        (item) =>
          item.mode === mode
      ).length;

  setText(
    "grammarTotal",
    rows.length
  );

  setText(
    "grammarPart5",
    rows.filter(function (item) {
      return (
        item.mode === "part5"
        || item.mode === "tenses"
      );
    }).length
  );

  setText(
    "grammarFill",
    countMode("fill")
  );

  setText(
    "grammarError",
    countMode("error")
  );

  setText(
    "grammarSentence",
    countMode("sentence")
  );
}

function renderList() {
  const search =
    String(
      $("grammarSearch")?.value || ""
    )
      .trim()
      .toLowerCase();

  const mode =
    $("grammarModeFilter")?.value ||
    "all";

  const chapter =
    $("grammarChapterFilter")?.value ||
    "all";

  const status =
    $("grammarStatusFilter")?.value ||
    "all";

  const filtered =
    rows.filter((item) => {
      const haystack = [
        item.prompt,
        item.topic,
        item.mode,
        item.level
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        haystack.includes(search);

      const itemMode =
        item.mode === "tenses"
          ? "part5"
          : item.mode;

      const matchesMode =
        mode === "all" ||
        itemMode === mode;

      const itemChapter =
        item.chapterId ||
        inferGrammarChapterId(
          item.topic || ""
        );

      const matchesChapter =
        chapter === "all" ||
        itemChapter === chapter;

      const active =
        item.active !== false;

      const matchesStatus =
        status === "all" ||
        (
          status === "active" &&
          active
        ) ||
        (
          status === "inactive" &&
          !active
        );

      return (
        matchesSearch &&
        matchesMode &&
        matchesChapter &&
        matchesStatus
      );
    });

  if (!filtered.length) {
    setListMessage(
      "ยังไม่มีโจทย์ที่ตรงกับตัวกรอง"
    );

    return;
  }

  const list =
    $("grammarQuestionList");

  list.innerHTML =
    filtered.map((item) => {
      const active =
        item.active !== false;

      return (
        '<article class="grammar-question-row">' +
          '<span class="grammar-question-mode">' +
            escapeHtml(modeLabel(item.mode)) +
          '</span>' +
          '<div class="grammar-question-copy">' +
            '<strong>' +
              escapeHtml(item.prompt || "") +
            '</strong>' +
            '<small>' +
              escapeHtml(
                (
                  getGrammarChapter(
                    item.chapterId ||
                    inferGrammarChapterId(
                      item.topic || ""
                    )
                  )?.shortTitle
                ) || "Grammar"
              ) +
              " · " +
              escapeHtml(item.topic || "General") +
              " · " +
              escapeHtml(item.level || "General") +
            '</small>' +
          '</div>' +
          '<span class="' +
            (
              active
                ? "grammar-status-active"
                : "grammar-status-inactive"
            ) +
          '">' +
            (
              active
                ? "Active"
                : "Inactive"
            ) +
          '</span>' +
          '<div class="grammar-row-actions">' +
            '<button type="button" data-edit="' +
              item.id +
            '">Edit</button>' +
            '<button type="button" data-delete="' +
              item.id +
            '">Delete</button>' +
          '</div>' +
        '</article>'
      );
    }).join("");

  list
    .querySelectorAll("[data-edit]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        function() {
          editQuestion(
            button.dataset.edit
          );
        }
      );
    });

  list
    .querySelectorAll("[data-delete]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        function() {
          deleteQuestion(
            button.dataset.delete
          );
        }
      );
    });
}

async function saveQuestion(event) {
  event.preventDefault();

  const id =
    $("grammarEditId").value.trim();

  const options =
    $("grammarOptions")
      .value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

  const correctAnswer =
    $("grammarCorrect")
      .value
      .trim();

  const selectedMode =
    $("grammarMode").value;

  const selectedChapterId =
    $("grammarChapter").value;

  const selectedChapter =
    getGrammarChapter(
      selectedChapterId
    );

  if (options.length < 2) {
    setFormMessage(
      "ต้องมีอย่างน้อย 2 choices"
    );

    return;
  }

  if (
    selectedMode !== "sentence"
    && !options.includes(
      correctAnswer
    )
  ) {
    setFormMessage(
      "Correct Answer ต้องตรงกับ Choice หนึ่งรายการ"
    );

    return;
  }

  if (
    selectedMode === "sentence"
    && !correctAnswer
  ) {
    setFormMessage(
      "Sentence Building ต้องมีประโยคคำตอบ"
    );

    return;
  }

  const data = {
    type:
      "grammarQuestion",
    mode:
      selectedMode,
    chapterId:
      selectedChapterId,
    chapterTitle:
      selectedChapter?.title || "",
    topic:
      $("grammarTopic").value.trim(),
    level:
      $("grammarLevel").value,
    prompt:
      $("grammarPrompt").value.trim(),
    options,
    correctAnswer,
    explanation:
      $("grammarExplanation")
        .value
        .trim(),
    active:
      $("grammarActive").value ===
      "true",
    updatedAt:
      serverTimestamp(),
    updatedBy:
      adminUid
  };

  try {
    if (id) {
      await updateDoc(
        doc(
          db,
          "gameSettings",
          id
        ),
        data
      );

      setFormMessage(
        "Updated ✓"
      );

    } else {
      await addDoc(
        collection(
          db,
          "gameSettings"
        ),
        {
          ...data,
          createdAt:
            serverTimestamp(),
          createdBy:
            adminUid
        }
      );

      setFormMessage(
        "Question added ✓"
      );
    }

    resetForm(false);
    await loadQuestions();

  } catch (error) {
    console.error(
      "Grammar save error:",
      error
    );

    setFormMessage(
      "บันทึกไม่สำเร็จ"
    );
  }
}

function editQuestion(id) {
  const item =
    rows.find(
      (row) =>
        row.id === id
    );

  if (!item) return;

  $("grammarEditId").value =
    item.id;

  $("grammarMode").value =
    item.mode === "tenses"
      ? "part5"
      : item.mode || "part5";

  $("grammarChapter").value =
    item.chapterId ||
    inferGrammarChapterId(
      item.topic || ""
    );

  $("grammarTopic").value =
    item.topic || "";

  $("grammarLevel").value =
    item.level || "Beginner";

  $("grammarPrompt").value =
    item.prompt || "";

  $("grammarOptions").value =
    Array.isArray(item.options)
      ? item.options.join("\n")
      : "";

  $("grammarCorrect").value =
    item.correctAnswer || "";

  $("grammarExplanation").value =
    item.explanation || "";

  $("grammarActive").value =
    item.active === false
      ? "false"
      : "true";

  $("grammarFormTitle").textContent =
    "Edit Grammar Question";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function deleteQuestion(id) {
  const item =
    rows.find(
      (row) =>
        row.id === id
    );

  if (!item) return;

  const approved =
    window.confirm(
      "Delete this Grammar question?"
    );

  if (!approved) return;

  try {
    await deleteDoc(
      doc(
        db,
        "gameSettings",
        id
      )
    );

    await loadQuestions();

  } catch (error) {
    console.error(
      "Grammar delete error:",
      error
    );

    window.alert(
      "ลบโจทย์ไม่สำเร็จ"
    );
  }
}

function resetForm(
  clearMessage = true
) {
  $("grammarForm")?.reset();

  $("grammarEditId").value = "";

  if ($("grammarMode")) {
    $("grammarMode").value =
      "part5";
  }

  if ($("grammarChapter")) {
    $("grammarChapter").value =
      TOEIC_GRAMMAR_CHAPTERS[0]?.id ||
      "word-forms";
  }

  $("grammarActive").value =
    "true";

  $("grammarFormTitle").textContent =
    "Add Grammar Question";

  if (clearMessage) {
    setFormMessage("");
  }
}

async function seedStarterQuestions() {
  if (rows.length > 0) {
    const approved =
      window.confirm(
        "มี Grammar Questions อยู่แล้ว ต้องการเพิ่ม Starter Questions อีกหรือไม่?"
      );

    if (!approved) return;
  }

  $("seedBtn").disabled = true;

  try {
    const batch =
      writeBatch(db);

    starterQuestions()
      .forEach((item) => {
        const ref =
          doc(
            collection(
              db,
              "gameSettings"
            )
          );

        const chapterId =
          item.chapterId ||
          inferGrammarChapterId(
            item.topic || ""
          );

        const chapter =
          getGrammarChapter(
            chapterId
          );

        batch.set(
          ref,
          {
            ...item,
            mode:
              item.mode === "tenses"
                ? "part5"
                : item.mode,
            chapterId,
            chapterTitle:
              chapter?.title || "",
            type:
              "grammarQuestion",
            active: true,
            createdBy:
              adminUid,
            updatedBy:
              adminUid,
            createdAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp()
          }
        );
      });

    await batch.commit();

    await loadQuestions();

    window.alert(
      "Starter Grammar Questions added ✓"
    );

  } catch (error) {
    console.error(
      "Grammar seed error:",
      error
    );

    window.alert(
      "Seed questions ไม่สำเร็จ"
    );

  } finally {
    $("seedBtn").disabled = false;
  }
}

function starterQuestions() {
  return [
    {
      mode: "tenses",
      topic: "Present Simple",
      level: "Beginner",
      prompt: "She ___ to work every day.",
      options: ["go", "goes", "went", "going"],
      correctAnswer: "goes",
      explanation: "Present Simple กับ she/he/it ใช้ verb เติม s/es."
    },
    {
      mode: "tenses",
      topic: "Past Simple",
      level: "Beginner",
      prompt: "They ___ dinner at 7 p.m. yesterday.",
      options: ["eat", "eats", "ate", "eaten"],
      correctAnswer: "ate",
      explanation: "Yesterday บอกเหตุการณ์ในอดีต จึงใช้ Past Simple."
    },
    {
      mode: "tenses",
      topic: "Present Perfect",
      level: "Intermediate",
      prompt: "I ___ this movie three times.",
      options: ["see", "saw", "have seen", "am seeing"],
      correctAnswer: "have seen",
      explanation: "ประสบการณ์จนถึงปัจจุบันใช้ Present Perfect."
    },
    {
      mode: "fill",
      topic: "Prepositions",
      level: "Beginner",
      prompt: "The meeting starts ___ 9 a.m.",
      options: ["in", "on", "at", "for"],
      correctAnswer: "at",
      explanation: "ใช้ at กับเวลาเฉพาะเจาะจง."
    },
    {
      mode: "fill",
      topic: "Articles",
      level: "Beginner",
      prompt: "She is ___ engineer.",
      options: ["a", "an", "the", "no article"],
      correctAnswer: "an",
      explanation: "Engineer ขึ้นต้นด้วยเสียงสระ จึงใช้ an."
    },
    {
      mode: "fill",
      topic: "Subject–Verb Agreement",
      level: "Intermediate",
      prompt: "Neither of the answers ___ correct.",
      options: ["are", "were", "is", "have"],
      correctAnswer: "is",
      explanation: "Neither ใช้กริยาเอกพจน์."
    },
    {
      mode: "error",
      topic: "Present Simple",
      level: "Beginner",
      prompt: "Which part is incorrect? He go to school every day.",
      options: ["He", "go", "to school", "every day"],
      correctAnswer: "go",
      explanation: "He ต้องใช้ goes."
    },
    {
      mode: "error",
      topic: "Past Simple",
      level: "Beginner",
      prompt: "Which part is incorrect? She didn't went to class.",
      options: ["She", "didn't", "went", "to class"],
      correctAnswer: "went",
      explanation: "หลัง didn't ใช้ verb ช่อง 1: go."
    },
    {
      mode: "error",
      topic: "Articles",
      level: "Intermediate",
      prompt: "Which part is incorrect? I bought an new laptop.",
      options: ["I", "bought", "an", "new laptop"],
      correctAnswer: "an",
      explanation: "New ขึ้นต้นด้วยเสียงพยัญชนะ จึงใช้ a."
    },
    {
      mode: "sentence",
      topic: "Word Order",
      level: "Beginner",
      prompt: "Build the correct sentence.",
      options: [
        "She",
        "usually",
        "drinks",
        "coffee",
        "in",
        "the",
        "morning."
      ],
      correctAnswer: "She usually drinks coffee in the morning.",
      explanation: "Adverb of frequency มักอยู่หน้ากริยาหลัก."
    },
    {
      mode: "sentence",
      topic: "Question Form",
      level: "Beginner",
      prompt: "Build the correct question.",
      options: [
        "Where",
        "are",
        "you",
        "going?"
      ],
      correctAnswer: "Where are you going?",
      explanation: "Wh-question + be + subject + verb-ing."
    },
    {
      mode: "sentence",
      topic: "Present Perfect",
      level: "Intermediate",
      prompt: "Build the correct sentence.",
      options: [
        "I",
        "have",
        "never",
        "been",
        "to",
        "Japan."
      ],
      correctAnswer: "I have never been to Japan.",
      explanation: "Never วางหลัง have/has และก่อน past participle."
    }
  ];
}

function modeLabel(mode) {
  return {
    part5: "TOEIC Part 5",
    tenses: "TOEIC Part 5",
    fill: "Fill Blank",
    error: "Error Detection",
    sentence: "Sentence Building"
  }[mode] || "Grammar";
}

function setListMessage(message) {
  const list =
    $("grammarQuestionList");

  if (!list) return;

  list.innerHTML =
    '<div class="grammar-empty-admin">' +
      escapeHtml(message) +
    '</div>';
}

function setFormMessage(message) {
  if ($("grammarFormMessage")) {
    $("grammarFormMessage").textContent =
      message;
  }
}

function setText(id, value) {
  if ($(id)) {
    $(id).textContent = value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bindLogout() {
  const button =
    document.getElementById("logoutBtn");

  if (!button) return;

  button.addEventListener(
    "click",
    async function () {
      await logoutUser();

      window.location.href =
        "../index.html";
    }
  );
}


/* =========================================================
   GRAMMAR IMPORT CENTER
========================================================= */

let grammarImportRows = [];
let grammarImportRawRows = [];
let grammarImportSourceName = "";

function renderImportChapterOptions() {
  const select = $("grammarImportChapter");
  if (!select) return;

  select.innerHTML =
    '<option value="">Select Grammar Chapter...</option>' +
    TOEIC_GRAMMAR_CHAPTERS
      .map((chapter) =>
        '<option value="' +
        chapter.id +
        '">' +
        chapter.no +
        " · " +
        chapter.title +
        " — " +
        chapter.thai +
        "</option>"
      )
      .join("");
}

function setupGrammarImport() {
  $("openGrammarImportBtn")
    ?.addEventListener(
      "click",
      openGrammarImport
    );

  $("closeGrammarImportBtn")
    ?.addEventListener(
      "click",
      closeGrammarImport
    );

  $("cancelGrammarImportBtn")
    ?.addEventListener(
      "click",
      closeGrammarImport
    );

  document
    .querySelectorAll(
      "[data-close-grammar-import]"
    )
    .forEach((element) =>
      element.addEventListener(
        "click",
        closeGrammarImport
      )
    );

  [
    ["grammarImportChapterMode","grammarImportChapterWrap"],
    ["grammarImportPracticeModeSource","grammarImportPracticeModeWrap"],
    ["grammarImportLevelSource","grammarImportLevelWrap"]
  ].forEach(([sourceId, wrapId]) => {
    $(sourceId)
      ?.addEventListener(
        "change",
        () => {
          const wrap = $(wrapId);
          if (wrap) {
            wrap.hidden =
              $(sourceId).value !== "assign";
          }

          if (
            grammarImportRawRows.length
          ) {
            rebuildGrammarImportPreview();
          }
        }
      );
  });

  [
    "grammarImportChapter",
    "grammarImportPracticeMode",
    "grammarImportLevel"
  ].forEach((id) =>
    $(id)
      ?.addEventListener(
        "change",
        () => {
          if (
            grammarImportRawRows.length
          ) {
            rebuildGrammarImportPreview();
          }
        }
      )
  );

  $("grammarImportFile")
    ?.addEventListener(
      "change",
      async (event) => {
        const file =
          event.target.files?.[0];

        if (file) {
          await handleGrammarImportFile(
            file
          );
        }
      }
    );

  const dropzone =
    $("grammarImportDropzone");

  if (dropzone) {
    [
      "dragenter",
      "dragover"
    ].forEach((eventName) =>
      dropzone.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
          dropzone.classList.add(
            "dragging"
          );
        }
      )
    );

    [
      "dragleave",
      "drop"
    ].forEach((eventName) =>
      dropzone.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
          dropzone.classList.remove(
            "dragging"
          );
        }
      )
    );

    dropzone.addEventListener(
      "drop",
      async (event) => {
        const file =
          event.dataTransfer
            ?.files?.[0];

        if (file) {
          await handleGrammarImportFile(
            file
          );
        }
      }
    );
  }

  $("confirmGrammarImportBtn")
    ?.addEventListener(
      "click",
      importGrammarQuestions
    );

  $("downloadGrammarPart5TemplateBtn")
    ?.addEventListener(
      "click",
      () =>
        downloadGrammarTemplate(
          "part5"
        )
    );

  $("downloadGrammarFillTemplateBtn")
    ?.addEventListener(
      "click",
      () =>
        downloadGrammarTemplate(
          "fill"
        )
    );

  $("downloadGrammarErrorTemplateBtn")
    ?.addEventListener(
      "click",
      () =>
        downloadGrammarTemplate(
          "error"
        )
    );

  $("downloadGrammarSentenceTemplateBtn")
    ?.addEventListener(
      "click",
      () =>
        downloadGrammarTemplate(
          "sentence"
        )
    );

  $("downloadGrammarAllTemplateBtn")
    ?.addEventListener(
      "click",
      () =>
        downloadGrammarTemplate(
          "all"
        )
    );
}

function openGrammarImport() {
  resetGrammarImport();

  $("grammarImportModal")
    ?.classList.add(
      "show"
    );

  document.body.style.overflow =
    "hidden";
}

function closeGrammarImport() {
  $("grammarImportModal")
    ?.classList.remove(
      "show"
    );

  document.body.style.overflow =
    "";
}

function resetGrammarImport() {
  grammarImportRows = [];
  grammarImportRawRows = [];
  grammarImportSourceName = "";

  const fileInput =
    $("grammarImportFile");

  if (fileInput) {
    fileInput.value = "";
  }

  [
    "grammarImportFileSummary",
    "grammarImportValidation",
    "grammarImportOptions",
    "grammarImportPreview"
  ].forEach((id) => {
    const element = $(id);

    if (element) {
      element.hidden = true;
    }
  });

  [
    "grammarImportPracticeModeWrap",
    "grammarImportLevelWrap"
  ].forEach((id) => {
    const element = $(id);
    if (element) {
      element.hidden = true;
    }
  });

  const chapterWrap =
    $("grammarImportChapterWrap");

  if (chapterWrap) {
    chapterWrap.hidden = false;
  }

  if ($("grammarImportChapterMode")) {
    $("grammarImportChapterMode").value =
      "assign";
  }

  if ($("grammarImportChapter")) {
    $("grammarImportChapter").value =
      "";
  }

  if ($("grammarImportPracticeModeSource")) {
    $("grammarImportPracticeModeSource").value =
      "file";
  }

  if ($("grammarImportLevelSource")) {
    $("grammarImportLevelSource").value =
      "file";
  }

  if ($("grammarImportPreviewBody")) {
    $("grammarImportPreviewBody").innerHTML =
      "";
  }

  const button =
    $("confirmGrammarImportBtn");

  if (button) {
    button.disabled = true;
    button.textContent =
      "Import Questions";
  }

  showGrammarImportMessage(
    "",
    ""
  );
}

async function handleGrammarImportFile(
  file
) {
  try {
    showGrammarImportMessage(
      "กำลังอ่านไฟล์...",
      "info"
    );

    const extension =
      getGrammarFileExtension(
        file.name
      );

    let rawRows = [];

    if (extension === "json") {
      rawRows =
        parseGrammarJson(
          await file.text()
        );
    } else if (
      extension === "csv"
      || extension === "tsv"
      || extension === "txt"
    ) {
      rawRows =
        parseGrammarDelimited(
          await file.text(),
          extension
        );
    } else if (
      extension === "xlsx"
      || extension === "xls"
      || extension === "ods"
    ) {
      rawRows =
        await parseGrammarExcel(
          file
        );
    } else {
      throw new Error(
        "Unsupported file type"
      );
    }

    grammarImportRawRows =
      rawRows;

    grammarImportSourceName =
      file.name;

    const summary =
      $("grammarImportFileSummary");

    if (summary) {
      summary.hidden = false;
      summary.textContent =
        file.name +
        " · " +
        formatGrammarFileSize(
          file.size
        );
    }

    rebuildGrammarImportPreview();

  } catch (error) {
    console.error(
      "Grammar import parse error:",
      error
    );

    grammarImportRows = [];
    grammarImportRawRows = [];

    showGrammarImportMessage(
      String(
        error?.message ||
        "ไม่สามารถอ่านไฟล์ได้"
      ),
      "error"
    );

    if ($("confirmGrammarImportBtn")) {
      $("confirmGrammarImportBtn").disabled =
        true;
    }
  }
}

function rebuildGrammarImportPreview() {
  grammarImportRows =
    validateGrammarImportRows(
      grammarImportRawRows
    );

  renderGrammarImportPreview();
}

function parseGrammarJson(text) {
  const data =
    JSON.parse(text);

  if (Array.isArray(data)) {
    return data;
  }

  for (
    const key of [
      "questions",
      "grammarQuestions",
      "grammar",
      "data"
    ]
  ) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  throw new Error(
    "JSON must contain an array of grammar questions"
  );
}

function parseGrammarDelimited(
  text,
  extension
) {
  const clean =
    String(text || "")
      .replace(
        /^\uFEFF/,
        ""
      );

  const delimiter =
    extension === "tsv"
      ? "\t"
      : extension === "txt"
        ? (
            clean.includes("\t")
              ? "\t"
              : ","
          )
        : ",";

  const matrix =
    parseGrammarDelimitedText(
      clean,
      delimiter
    );

  if (matrix.length < 2) {
    return [];
  }

  const headers =
    matrix[0]
      .map(
        normalizeGrammarHeader
      );

  return matrix
    .slice(1)
    .filter(
      (row) =>
        row.some(
          (cell) =>
            String(cell || "")
              .trim()
        )
    )
    .map((row) => {
      const item = {};

      headers.forEach(
        (header, index) => {
          if (header) {
            item[header] =
              row[index] ?? "";
          }
        }
      );

      return item;
    });
}

function parseGrammarDelimitedText(
  text,
  delimiter
) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char =
      text[index];

    const next =
      text[index + 1];

    if (char === '"') {
      if (
        quoted
        && next === '"'
      ) {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (
      char === delimiter
      && !quoted
    ) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (char === "\n"
        || char === "\r")
      && !quoted
    ) {
      if (
        char === "\r"
        && next === "\n"
      ) {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (
    cell.length
    || row.length
  ) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function parseGrammarExcel(
  file
) {
  if (
    typeof window.XLSX ===
    "undefined"
  ) {
    throw new Error(
      "Excel reader is unavailable. Use CSV/JSON or check internet connection."
    );
  }

  const buffer =
    await file.arrayBuffer();

  const workbook =
    window.XLSX.read(
      buffer,
      {
        type: "array"
      }
    );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  return window.XLSX.utils
    .sheet_to_json(
      workbook.Sheets[
        sheetName
      ],
      {
        defval: "",
        raw: false
      }
    );
}

function validateGrammarImportRows(
  rawRows
) {
  const existingMap =
    new Map(
      rows.map((item) => [
        buildGrammarDuplicateKey(
          normalizeExistingGrammarRow(
            item
          )
        ),
        item
      ])
    );

  const seenFileKeys =
    new Set();

  return rawRows.map(
    (raw, index) => {
      const data =
        normalizeGrammarImportRow(
          raw
        );

      let status =
        "valid";

      let reason =
        validateGrammarQuestion(
          data
        );

      let existingId = "";

      if (reason) {
        status =
          "invalid";
      } else {
        const key =
          buildGrammarDuplicateKey(
            data
          );

        if (
          seenFileKeys.has(key)
        ) {
          status =
            "duplicate";
          reason =
            "Duplicate inside file";
        } else if (
          existingMap.has(key)
        ) {
          status =
            "duplicate";
          reason =
            "Already exists";
          existingId =
            existingMap.get(key).id;
        }

        seenFileKeys.add(key);
      }

      return {
        index:
          index + 1,
        data,
        status,
        reason,
        existingId
      };
    }
  );
}

function normalizeGrammarImportRow(raw) {
  const source = {};

  Object.entries(
    raw &&
    typeof raw === "object"
      ? raw
      : {}
  ).forEach(([key, value]) => {
    source[
      normalizeGrammarHeader(
        key
      )
    ] = value;
  });

  const chapterSource =
    $("grammarImportChapterMode")
      ?.value === "assign"
      ? $("grammarImportChapter")
          ?.value
      : pickGrammarValue(
          source,
          [
            "chapterid",
            "chapter",
            "grammarchapter",
            "chaptertitle"
          ]
        );

  const modeSource =
    $("grammarImportPracticeModeSource")
      ?.value === "assign"
      ? $("grammarImportPracticeMode")
          ?.value
      : pickGrammarValue(
          source,
          [
            "mode",
            "practicemode",
            "questiontype",
            "type"
          ]
        );

  const levelSource =
    $("grammarImportLevelSource")
      ?.value === "assign"
      ? $("grammarImportLevel")
          ?.value
      : pickGrammarValue(
          source,
          [
            "level",
            "difficulty"
          ]
        );

  const chapterId =
    resolveGrammarChapterId(
      chapterSource
    );

  const mode =
    normalizeGrammarMode(
      modeSource
    );

  const topic =
    String(
      pickGrammarValue(
        source,
        [
          "topic",
          "subtopic",
          "grammartopic"
        ]
      ) || ""
    ).trim();

  const prompt =
    String(
      pickGrammarValue(
        source,
        [
          "prompt",
          "question",
          "sentence",
          "questiontext"
        ]
      ) || ""
    ).trim();

  const options =
    normalizeGrammarOptions(
      source,
      mode
    );

  const correctAnswer =
    String(
      pickGrammarValue(
        source,
        [
          "correctanswer",
          "answer",
          "correct",
          "solution"
        ]
      ) || ""
    ).trim();

  const explanation =
    String(
      pickGrammarValue(
        source,
        [
          "explanation",
          "reason",
          "note",
          "rationale"
        ]
      ) || ""
    ).trim();

  const level =
    normalizeGrammarLevel(
      levelSource
    );

  const active =
    parseGrammarActive(
      pickGrammarRawValue(
        source,
        [
          "active",
          "status",
          "enabled"
        ]
      )
    );

  const chapter =
    getGrammarChapter(
      chapterId
    );

  return {
    type:
      "grammarQuestion",
    chapterId,
    chapterTitle:
      chapter?.title || "",
    mode,
    topic:
      topic ||
      chapter?.shortTitle ||
      "",
    level,
    prompt,
    options,
    correctAnswer,
    explanation,
    active
  };
}

function normalizeExistingGrammarRow(
  item
) {
  const chapterId =
    item.chapterId ||
    inferGrammarChapterId(
      item.topic || ""
    );

  return {
    chapterId,
    mode:
      item.mode === "tenses"
        ? "part5"
        : item.mode,
    prompt:
      item.prompt || "",
    correctAnswer:
      item.correctAnswer || ""
  };
}

function normalizeGrammarOptions(
  source,
  mode
) {
  const direct =
    pickGrammarRawValue(
      source,
      [
        "options",
        "choices",
        "wordtiles",
        "tiles"
      ]
    );

  let options = [];

  if (Array.isArray(direct)) {
    options =
      direct.map(String);
  } else if (
    String(direct || "")
      .trim()
  ) {
    options =
      String(direct)
        .split(
          mode === "sentence"
            ? /[|;\n]/g
            : /[|;\n]/g
        );
  } else {
    [
      "optiona",
      "optionb",
      "optionc",
      "optiond",
      "choicea",
      "choiceb",
      "choicec",
      "choiced"
    ].forEach((key) => {
      if (
        String(
          source[key] ?? ""
        ).trim()
      ) {
        options.push(
          source[key]
        );
      }
    });
  }

  return options
    .map(
      (value) =>
        String(value || "")
          .trim()
    )
    .filter(Boolean);
}

function validateGrammarQuestion(
  data
) {
  if (!data.chapterId) {
    return "Unknown or missing chapter";
  }

  if (
    ![
      "part5",
      "fill",
      "error",
      "sentence"
    ].includes(
      data.mode
    )
  ) {
    return "Unknown or missing mode";
  }

  if (!data.prompt) {
    return "Missing prompt";
  }

  if (!data.correctAnswer) {
    return "Missing correct answer";
  }

  if (
    data.mode === "part5"
    && data.options.length !== 4
  ) {
    return "TOEIC Part 5 requires exactly 4 choices";
  }

  if (
    data.mode !== "part5"
    && data.options.length < 2
  ) {
    return data.mode === "sentence"
      ? "Sentence Building requires at least 2 word tiles"
      : "At least 2 choices are required";
  }

  if (
    data.mode !== "sentence"
    && !data.options.includes(
      data.correctAnswer
    )
  ) {
    return "Correct answer must exactly match one choice";
  }

  return "";
}

function buildGrammarDuplicateKey(
  item
) {
  return [
    String(
      item.chapterId || ""
    ).trim().toLowerCase(),
    String(
      item.mode || ""
    ).trim().toLowerCase(),
    normalizeGrammarTextKey(
      item.prompt
    ),
    normalizeGrammarTextKey(
      item.correctAnswer
    )
  ].join("::");
}

function resolveGrammarChapterId(
  value
) {
  const text =
    String(value || "")
      .trim();

  if (!text) return "";

  const normalized =
    text.toLowerCase();

  const direct =
    TOEIC_GRAMMAR_CHAPTERS
      .find(
        (chapter) =>
          chapter.id === normalized
      );

  if (direct) {
    return direct.id;
  }

  const byNumber =
    TOEIC_GRAMMAR_CHAPTERS
      .find(
        (chapter) =>
          chapter.no ===
          normalized.replace(
            /^0?/,
            ""
          ).padStart(
            2,
            "0"
          )
      );

  if (byNumber) {
    return byNumber.id;
  }

  const byName =
    TOEIC_GRAMMAR_CHAPTERS
      .find((chapter) => {
        const haystack = [
          chapter.title,
          chapter.shortTitle,
          chapter.thai
        ]
          .join(" ")
          .toLowerCase();

        return (
          haystack === normalized
          || haystack.includes(
            normalized
          )
        );
      });

  return byName?.id || "";
}

function normalizeGrammarMode(
  value
) {
  const text =
    String(value || "")
      .trim()
      .toLowerCase();

  const map = {
    part5:
      "part5",
    "part 5":
      "part5",
    toeicpart5:
      "part5",
    toeic5:
      "part5",
    tenses:
      "part5",
    fill:
      "fill",
    fillblank:
      "fill",
    "fill in the blank":
      "fill",
    error:
      "error",
    errordetection:
      "error",
    "error detection":
      "error",
    sentence:
      "sentence",
    sentencebuilding:
      "sentence",
    "sentence building":
      "sentence"
  };

  return map[
    text.replace(
      /[^a-z0-9 ]+/g,
      ""
    )
  ] || "";
}

function normalizeGrammarLevel(
  value
) {
  const text =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    text === "beginner"
    || text === "easy"
    || text === "basic"
  ) {
    return "Beginner";
  }

  if (
    text === "advanced"
    || text === "hard"
  ) {
    return "Advanced";
  }

  return "Intermediate";
}

function parseGrammarActive(
  value
) {
  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const text =
    String(value ?? "")
      .trim()
      .toLowerCase();

  return ![
    "false",
    "0",
    "no",
    "inactive",
    "disabled"
  ].includes(text);
}

function normalizeGrammarHeader(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9ก-๙]+/g,
      ""
    );
}

function normalizeGrammarTextKey(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

function pickGrammarValue(
  source,
  keys
) {
  const value =
    pickGrammarRawValue(
      source,
      keys
    );

  return Array.isArray(value)
    ? value.join(" | ")
    : value;
}

function pickGrammarRawValue(
  source,
  keys
) {
  for (const key of keys) {
    if (
      source[key] !== undefined
    ) {
      return source[key];
    }
  }

  return "";
}

function renderGrammarImportPreview() {
  const valid =
    grammarImportRows.filter(
      (row) =>
        row.status === "valid"
    );

  const duplicates =
    grammarImportRows.filter(
      (row) =>
        row.status === "duplicate"
    );

  const invalid =
    grammarImportRows.filter(
      (row) =>
        row.status === "invalid"
    );

  setText(
    "grammarImportRows",
    grammarImportRows.length
  );

  setText(
    "grammarImportValid",
    valid.length
  );

  setText(
    "grammarImportDuplicates",
    duplicates.length
  );

  setText(
    "grammarImportInvalid",
    invalid.length
  );

  [
    "grammarImportValidation",
    "grammarImportOptions",
    "grammarImportPreview"
  ].forEach((id) => {
    const element = $(id);

    if (element) {
      element.hidden = false;
    }
  });

  setText(
    "grammarImportPreviewMeta",
    grammarImportRows.length +
      " parsed rows · showing first " +
      Math.min(
        grammarImportRows.length,
        100
      )
  );

  const body =
    $("grammarImportPreviewBody");

  if (body) {
    body.innerHTML =
      grammarImportRows
        .slice(
          0,
          100
        )
        .map((row) => {
          const chapter =
            getGrammarChapter(
              row.data.chapterId
            );

          const label =
            row.status === "valid"
              ? "Ready"
              : row.status ===
                  "duplicate"
                ? "Duplicate"
                : "Invalid";

          return (
            "<tr>" +
              "<td>" +
                '<span class="grammar-import-row-status ' +
                  row.status +
                '" title="' +
                  escapeHtml(
                    row.reason
                  ) +
                '">' +
                  label +
                "</span>" +
              "</td>" +
              "<td>" +
                escapeHtml(
                  chapter
                    ? chapter.no +
                      " · " +
                      chapter.shortTitle
                    : "—"
                ) +
              "</td>" +
              "<td>" +
                escapeHtml(
                  modeLabel(
                    row.data.mode
                  )
                ) +
              "</td>" +
              "<td>" +
                escapeHtml(
                  row.data.topic ||
                  "—"
                ) +
              "</td>" +
              "<td>" +
                escapeHtml(
                  row.data.prompt ||
                  "—"
                ) +
              "</td>" +
              "<td>" +
                escapeHtml(
                  row.data.correctAnswer ||
                  "—"
                ) +
              "</td>" +
            "</tr>"
          );
        })
        .join("");
  }

  const button =
    $("confirmGrammarImportBtn");

  if (button) {
    button.disabled =
      valid.length === 0
      && duplicates.filter(
        (row) =>
          Boolean(
            row.existingId
          )
      ).length === 0;
  }

  showGrammarImportMessage(
    grammarImportRows.length
      ? "ตรวจไฟล์แล้ว เลือก Duplicate strategy จากนั้นกด Import ได้เลย"
      : "ไม่พบข้อมูลที่ Import ได้",
    grammarImportRows.length
      ? "info"
      : "error"
  );
}

async function importGrammarQuestions() {
  const button =
    $("confirmGrammarImportBtn");

  if (
    !button
    || button.disabled
  ) {
    return;
  }

  const strategy =
    $("grammarImportDuplicateStrategy")
      ?.value ||
    "skip";

  const importable = [];

  grammarImportRows
    .forEach((row) => {
      if (
        row.status === "invalid"
      ) {
        return;
      }

      if (
        row.status === "duplicate"
        && !row.existingId
      ) {
        return;
      }

      if (
        row.status === "duplicate"
        && strategy === "skip"
      ) {
        return;
      }

      importable.push(row);
    });

  if (!importable.length) {
    showGrammarImportMessage(
      "ไม่มีรายการที่จะ Import ตามตัวเลือกปัจจุบัน",
      "error"
    );

    return;
  }

  button.disabled = true;
  button.textContent =
    "Importing...";

  showGrammarImportMessage(
    "กำลังบันทึก " +
      importable.length +
      " questions...",
    "info"
  );

  try {
    const chunkSize = 400;

    for (
      let start = 0;
      start < importable.length;
      start += chunkSize
    ) {
      const chunk =
        importable.slice(
          start,
          start + chunkSize
        );

      const batch =
        writeBatch(db);

      chunk.forEach((row) => {
        const data = {
          ...row.data,
          importSource:
            grammarImportSourceName,
          importedAt:
            serverTimestamp(),
          importedBy:
            adminUid,
          updatedAt:
            serverTimestamp(),
          updatedBy:
            adminUid
        };

        if (
          row.existingId
          && strategy === "update"
        ) {
          batch.update(
            doc(
              db,
              "gameSettings",
              row.existingId
            ),
            data
          );
        } else {
          const reference =
            doc(
              collection(
                db,
                "gameSettings"
              )
            );

          batch.set(
            reference,
            {
              ...data,
              createdAt:
                serverTimestamp(),
              createdBy:
                adminUid
            }
          );
        }
      });

      await batch.commit();
    }

    showGrammarImportMessage(
      "Import สำเร็จ " +
        importable.length +
        " questions",
      "success"
    );

    await loadQuestions();

    window.setTimeout(
      closeGrammarImport,
      850
    );

  } catch (error) {
    console.error(
      "Grammar import write error:",
      error
    );

    showGrammarImportMessage(
      "Import ไม่สำเร็จ กรุณาตรวจ Firestore permission หรือข้อมูลในไฟล์",
      "error"
    );

    button.disabled = false;
    button.textContent =
      "Import Questions";
  }
}

function downloadGrammarTemplate(
  kind
) {
  const rows =
    buildGrammarTemplateRows(
      kind
    );

  if (
    typeof window.XLSX !==
    "undefined"
  ) {
    const sheet =
      window.XLSX.utils
        .json_to_sheet(
          rows
        );

    const workbook =
      window.XLSX.utils
        .book_new();

    window.XLSX.utils
      .book_append_sheet(
        workbook,
        sheet,
        "Grammar Questions"
      );

    window.XLSX.writeFile(
      workbook,
      "onnylab-grammar-" +
        kind +
        "-template.xlsx"
    );

    return;
  }

  const headers =
    Object.keys(
      rows[0] || {}
    );

  const csv = [
    headers.join(","),
    ...rows.map(
      (row) =>
        headers
          .map(
            (header) =>
              grammarCsvEscape(
                row[header]
              )
          )
          .join(",")
    )
  ].join("\n");

  downloadGrammarTextFile(
    "onnylab-grammar-" +
      kind +
      "-template.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );
}

function buildGrammarTemplateRows(
  kind
) {
  const base = {
    chapterId:
      "prepositions",
    mode:
      "part5",
    topic:
      "Prepositions of Time",
    level:
      "Beginner",
    prompt:
      "The meeting starts ___ 9 a.m.",
    optionA:
      "in",
    optionB:
      "on",
    optionC:
      "at",
    optionD:
      "for",
    correctAnswer:
      "at",
    explanation:
      'Use "at" with specific times.',
    active:
      true
  };

  if (kind === "part5") {
    return [
      base,
      {
        ...base,
        chapterId:
          "subject-verb",
        topic:
          "Subject–Verb Agreement",
        prompt:
          "Each employee ___ a security badge.",
        optionA:
          "have",
        optionB:
          "has",
        optionC:
          "having",
        optionD:
          "are",
        correctAnswer:
          "has",
        explanation:
          "Each takes a singular verb."
      }
    ];
  }

  if (kind === "fill") {
    return [
      {
        chapterId:
          "tenses",
        mode:
          "fill",
        topic:
          "Past Simple",
        level:
          "Beginner",
        prompt:
          "The company ___ the report yesterday.",
        optionA:
          "release",
        optionB:
          "released",
        optionC:
          "releases",
        optionD:
          "releasing",
        correctAnswer:
          "released",
        explanation:
          "Yesterday signals Past Simple.",
        active:
          true
      }
    ];
  }

  if (kind === "error") {
    return [
      {
        chapterId:
          "tenses",
        mode:
          "error",
        topic:
          "Past Simple",
        level:
          "Beginner",
        prompt:
          "Which part is incorrect? She didn't went to class.",
        optionA:
          "She",
        optionB:
          "didn't",
        optionC:
          "went",
        optionD:
          "to class",
        correctAnswer:
          "went",
        explanation:
          "After didn't, use the base verb: go.",
        active:
          true
      }
    ];
  }

  if (kind === "sentence") {
    return [
      {
        chapterId:
          "sentence-clauses",
        mode:
          "sentence",
        topic:
          "Word Order",
        level:
          "Beginner",
        prompt:
          "Build the correct sentence.",
        wordTiles:
          "Please|send|the|report|today.",
        correctAnswer:
          "Please send the report today.",
        explanation:
          "Use subject + verb + object + time.",
        active:
          true
      }
    ];
  }

  return [
    base,
    {
      chapterId:
        "tenses",
      mode:
        "fill",
      topic:
        "Past Simple",
      level:
        "Beginner",
      prompt:
        "The company ___ the report yesterday.",
      optionA:
        "release",
      optionB:
        "released",
      optionC:
        "releases",
      optionD:
        "releasing",
      correctAnswer:
        "released",
      explanation:
        "Yesterday signals Past Simple.",
      active:
        true
    },
    {
      chapterId:
        "articles-determiners",
      mode:
        "error",
      topic:
        "Articles",
      level:
        "Beginner",
      prompt:
        "Which part is incorrect? We hired an new consultant.",
      optionA:
        "We",
      optionB:
        "hired",
      optionC:
        "an",
      optionD:
        "new consultant",
      correctAnswer:
        "an",
      explanation:
        "Use a before a consonant sound.",
      active:
        true
    },
    {
      chapterId:
        "sentence-clauses",
      mode:
        "sentence",
      topic:
        "Word Order",
      level:
        "Beginner",
      prompt:
        "Build the correct sentence.",
      wordTiles:
        "Please|send|the|report|today.",
      correctAnswer:
        "Please send the report today.",
      explanation:
        "Use subject + verb + object + time.",
      active:
        true
    }
  ];
}

function grammarCsvEscape(
  value
) {
  const text =
    String(value ?? "");

  if (
    /[",\n\r]/.test(text)
  ) {
    return (
      '"' +
      text.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }

  return text;
}

function downloadGrammarTextFile(
  filename,
  content,
  mime
) {
  const blob =
    new Blob(
      [content],
      {
        type: mime
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href = url;
  anchor.download = filename;

  document.body
    .appendChild(
      anchor
    );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}

function getGrammarFileExtension(
  name
) {
  const parts =
    String(name || "")
      .toLowerCase()
      .split(".");

  return parts.length > 1
    ? parts.pop()
    : "";
}

function formatGrammarFileSize(
  bytes
) {
  const size =
    Number(bytes) || 0;

  if (size < 1024) {
    return size + " B";
  }

  if (size < 1024 * 1024) {
    return (
      (
        size /
        1024
      ).toFixed(1) +
      " KB"
    );
  }

  return (
    (
      size /
      (
        1024 *
        1024
      )
    ).toFixed(1) +
    " MB"
  );
}

function showGrammarImportMessage(
  message,
  type
) {
  const element =
    $("grammarImportMessage");

  if (!element) return;

  element.textContent =
    message || "";

  element.className =
    "grammar-import-message" +
    (
      type
        ? " " + type
        : ""
    );
}
