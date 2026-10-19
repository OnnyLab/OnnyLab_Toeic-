import {
  auth,
  db
} from "../core/firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


const $ = (id) =>
  document.getElementById(id);


const DEFAULTS = {
  translation: {
    enabled: true,
    timePerQuestion: 15,
    questionsPerGame: 10,
    choices: 4,
    wrongLimitEnabled: true,
    maxWrong: 3
  },

  meaning: {
    enabled: true,
    timePerQuestion: 15,
    questionsPerGame: 10,
    choices: 4,
    wrongLimitEnabled: true,
    maxWrong: 3
  },

  synonym: {
    enabled: true,
    timePerQuestion: 20,
    questionsPerGame: 10,
    choices: 6,
    minCorrectSynonyms: 2,
    maxCorrectSynonyms: 4,
    showCorrectCount: true,
    wrongLimitEnabled: true,
    maxWrong: 3
  },

  weak: {
    enabled: true,
    timePerQuestion: 15,
    questionsPerGame: 10,
    choices: 4,
    repeatSingleWord: 3,
    wrongLimitEnabled: false,
    maxWrong: 5
  },

  "grammar-part5": {
    enabled: true,
    timePerQuestion: 30,
    questionsPerGame: 10,
    shuffleQuestions: true,
    showExplanation: true,
    wrongLimitEnabled: false,
    maxWrong: 5
  },

  "grammar-fill": {
    enabled: true,
    timePerQuestion: 30,
    questionsPerGame: 10,
    shuffleQuestions: true,
    showExplanation: true,
    wrongLimitEnabled: false,
    maxWrong: 5
  },

  "grammar-error": {
    enabled: true,
    timePerQuestion: 40,
    questionsPerGame: 10,
    shuffleQuestions: true,
    showExplanation: true,
    wrongLimitEnabled: false,
    maxWrong: 5
  },

  "grammar-sentence": {
    enabled: true,
    timePerQuestion: 60,
    questionsPerGame: 10,
    shuffleQuestions: true,
    showExplanation: true,
    wrongLimitEnabled: false,
    maxWrong: 5
  },

  global: {
    wrongFeedbackEnabled: true,
    wrongFeedbackImageEnabled: false,
    wrongFeedbackImage: "",
    wrongFeedbackSoundEnabled: false,
    wrongFeedbackSoundUrl: "../assets/sound/moo.mp3",
    wrongFeedbackDuration: 1200
  }
};


const MODE_BINDINGS = {
  translation: {
    enabled: "translationEnabled",
    timePerQuestion: "translationTime",
    questionsPerGame: "translationQuestions",
    choices: "translationChoices",
    wrongLimitEnabled: "translationWrongLimit",
    maxWrong: "translationMaxWrong"
  },

  meaning: {
    enabled: "meaningEnabled",
    timePerQuestion: "meaningTime",
    questionsPerGame: "meaningQuestions",
    choices: "meaningChoices",
    wrongLimitEnabled: "meaningWrongLimit",
    maxWrong: "meaningMaxWrong"
  },

  synonym: {
    enabled: "synonymEnabled",
    timePerQuestion: "synonymTime",
    questionsPerGame: "synonymQuestions",
    choices: "synonymChoices",
    minCorrectSynonyms: "synonymMinCorrect",
    maxCorrectSynonyms: "synonymMaxCorrect",
    showCorrectCount: "synonymShowCount",
    wrongLimitEnabled: "synonymWrongLimit",
    maxWrong: "synonymMaxWrong"
  },

  weak: {
    enabled: "weakEnabled",
    timePerQuestion: "weakTime",
    questionsPerGame: "weakQuestions",
    choices: "weakChoices",
    repeatSingleWord: "weakRepeatSingleWord",
    wrongLimitEnabled: "weakWrongLimit",
    maxWrong: "weakMaxWrong"
  },

  "grammar-part5": {
    enabled: "grammarPart5Enabled",
    timePerQuestion: "grammarPart5Time",
    questionsPerGame: "grammarPart5Questions",
    shuffleQuestions: "grammarPart5Shuffle",
    showExplanation: "grammarPart5Explanation",
    wrongLimitEnabled: "grammarPart5WrongLimit",
    maxWrong: "grammarPart5MaxWrong"
  },

  "grammar-fill": {
    enabled: "grammarFillEnabled",
    timePerQuestion: "grammarFillTime",
    questionsPerGame: "grammarFillQuestions",
    shuffleQuestions: "grammarFillShuffle",
    showExplanation: "grammarFillExplanation",
    wrongLimitEnabled: "grammarFillWrongLimit",
    maxWrong: "grammarFillMaxWrong"
  },

  "grammar-error": {
    enabled: "grammarErrorEnabled",
    timePerQuestion: "grammarErrorTime",
    questionsPerGame: "grammarErrorQuestions",
    shuffleQuestions: "grammarErrorShuffle",
    showExplanation: "grammarErrorExplanation",
    wrongLimitEnabled: "grammarErrorWrongLimit",
    maxWrong: "grammarErrorMaxWrong"
  },

  "grammar-sentence": {
    enabled: "grammarSentenceEnabled",
    timePerQuestion: "grammarSentenceTime",
    questionsPerGame: "grammarSentenceQuestions",
    shuffleQuestions: "grammarSentenceShuffle",
    showExplanation: "grammarSentenceExplanation",
    wrongLimitEnabled: "grammarSentenceWrongLimit",
    maxWrong: "grammarSentenceMaxWrong"
  }
};


let feedbackImageData = "";
let currentProfile = null;


document.addEventListener(
  "DOMContentLoaded",
  () => {
    bindTabs();
    bindResetButtons();
    bindModeSwitches();
    bindFeedbackControls();
    bindSave();
  }
);


onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      window.location.href =
        "../index.html";
      return;
    }

    try {
      const snapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );

      if (!snapshot.exists()) {
        window.location.href =
          "../user/dashboard.html";
        return;
      }

      const profile =
        snapshot.data();

      if (
        profile.role !== "admin"
      ) {
        window.location.href =
          "../user/dashboard.html";
        return;
      }

      if (
        profile.status === "disabled"
      ) {
        await signOut(auth);
        window.location.href =
          "../index.html";
        return;
      }

      currentProfile =
        profile;

      renderAdminProfile(
        user,
        profile
      );

      bindLogout();

      await loadSettings();

    } catch (error) {
      console.error(
        "Settings auth error:",
        error
      );

      showMessage(
        "ไม่สามารถเปิด Game Settings ได้",
        "error"
      );
    }
  }
);


function renderAdminProfile(
  user,
  profile
) {
  const name =
    profile.displayName ||
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
    name.charAt(0)
      .toUpperCase() ||
    "A"
  );
}


async function loadSettings() {
  showMessage(
    "Loading settings...",
    "info"
  );

  setText(
    "settingsSyncStatus",
    "Syncing settings..."
  );

  try {
    const ids = [
      ...Object.keys(
        MODE_BINDINGS
      ),
      "global"
    ];

    const snapshots =
      await Promise.all(
        ids.map(
          (id) =>
            getDoc(
              doc(
                db,
                "gameSettings",
                id
              )
            )
        )
      );

    const loaded = {};

    ids.forEach(
      (id, index) => {
        loaded[id] = {
          ...DEFAULTS[id],
          ...(
            snapshots[index]
              .exists()
              ? snapshots[index]
                  .data()
              : {}
          )
        };
      }
    );

    Object.keys(
      MODE_BINDINGS
    ).forEach(
      (mode) =>
        renderModeSettings(
          mode,
          loaded[mode]
        )
    );

    renderGlobalSettings(
      loaded.global
    );

    refreshModeCardStates();

    clearMessage();

    setText(
      "settingsSyncStatus",
      "Settings synced"
    );

  } catch (error) {
    console.error(
      "Load settings error:",
      error
    );

    showMessage(
      "โหลด Game Settings ไม่สำเร็จ",
      "error"
    );

    setText(
      "settingsSyncStatus",
      "Settings unavailable"
    );
  }
}


function renderModeSettings(
  mode,
  data
) {
  const binding =
    MODE_BINDINGS[mode];

  Object.entries(binding)
    .forEach(
      ([key, id]) => {
        const element =
          $(id);

        if (!element) {
          return;
        }

        if (
          element.type ===
          "checkbox"
        ) {
          element.checked =
            Boolean(
              data[key]
            );
        } else {
          element.value =
            data[key] ??
            "";
        }
      }
    );
}


function renderGlobalSettings(
  global
) {
  $("feedbackEnabled").checked =
    Boolean(
      global.wrongFeedbackEnabled
    );

  $("feedbackImageEnabled").checked =
    Boolean(
      global.wrongFeedbackImageEnabled
    );

  feedbackImageData =
    global.wrongFeedbackImage ||
    "";

  $("feedbackSoundEnabled").checked =
    Boolean(
      global.wrongFeedbackSoundEnabled
    );

  $("feedbackSoundUrl").value =
    global.wrongFeedbackSoundUrl ||
    "";

  $("feedbackDuration").value =
    global.wrongFeedbackDuration;

  renderFeedbackPreview();
}


function bindTabs() {
  document
    .querySelectorAll(
      "[data-settings-tab]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const name =
              button.dataset
                .settingsTab;

            document
              .querySelectorAll(
                "[data-settings-tab]"
              )
              .forEach(
                (item) =>
                  item.classList
                    .toggle(
                      "active",
                      item === button
                    )
              );

            document
              .querySelectorAll(
                "[data-settings-panel]"
              )
              .forEach(
                (panel) =>
                  panel.classList
                    .toggle(
                      "active",
                      panel.dataset
                        .settingsPanel ===
                        name
                    )
              );
          }
        );
      }
    );
}


function bindModeSwitches() {
  Object.values(
    MODE_BINDINGS
  ).forEach(
    (binding) => {
      [
        binding.enabled,
        binding.wrongLimitEnabled
      ]
        .filter(Boolean)
        .forEach(
          (id) => {
            $(id)
              ?.addEventListener(
                "change",
                refreshModeCardStates
              );
          }
        );
    }
  );
}


function refreshModeCardStates() {
  Object.entries(
    MODE_BINDINGS
  ).forEach(
    ([mode, binding]) => {
      const enabled =
        $(binding.enabled)
          ?.checked !== false;

      const card =
        document.querySelector(
          '[data-mode-card="' +
          mode +
          '"]'
        );

      card?.classList.toggle(
        "is-disabled",
        !enabled
      );

      if (
        binding.maxWrong &&
        binding.wrongLimitEnabled
      ) {
        const maxInput =
          $(binding.maxWrong);

        if (maxInput) {
          maxInput.disabled =
            !$(binding.wrongLimitEnabled)
              ?.checked;
        }
      }
    }
  );
}


function bindResetButtons() {
  document
    .querySelectorAll(
      "[data-reset-mode]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const mode =
              button.dataset
                .resetMode;

            const defaults =
              DEFAULTS[mode];

            if (!defaults) {
              return;
            }

            renderModeSettings(
              mode,
              defaults
            );

            refreshModeCardStates();

            showMessage(
              "Reset " +
              getModeLabel(mode) +
              " เป็นค่าเริ่มต้นแล้ว — กด Save All Settings เพื่อบันทึก",
              "info"
            );
          }
        );
      }
    );
}


function bindFeedbackControls() {
  $("feedbackImage")
    ?.addEventListener(
      "change",
      async (event) => {
        const file =
          event.target
            .files?.[0];

        if (!file) {
          return;
        }

        const allowed = [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif"
        ];

        if (
          !allowed.includes(
            file.type
          )
        ) {
          showMessage(
            "รองรับ PNG, JPG, WEBP, GIF เท่านั้น",
            "error"
          );
          event.target.value = "";
          return;
        }

        if (
          file.size >
          500 * 1024
        ) {
          showMessage(
            "รูป Feedback ต้องไม่เกิน 500 KB",
            "error"
          );
          event.target.value = "";
          return;
        }

        feedbackImageData =
          await fileToDataURL(
            file
          );

        renderFeedbackPreview();
      }
    );

  $("removeFeedbackImage")
    ?.addEventListener(
      "click",
      () => {
        feedbackImageData = "";

        if ($("feedbackImage")) {
          $("feedbackImage").value =
            "";
        }

        renderFeedbackPreview();
      }
    );
}


function fileToDataURL(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            reader.result
          );

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}


function renderFeedbackPreview() {
  const preview =
    $("feedbackPreview");

  const empty =
    $("feedbackNoImage");

  if (
    feedbackImageData
  ) {
    preview.src =
      feedbackImageData;

    preview.hidden =
      false;

    empty.hidden =
      true;
  } else {
    preview.removeAttribute(
      "src"
    );

    preview.hidden =
      true;

    empty.hidden =
      false;
  }
}


function bindSave() {
  $("saveSettingsBtn")
    ?.addEventListener(
      "click",
      saveSettings
    );
}


async function saveSettings() {
  const user =
    auth.currentUser;

  if (!user) {
    return;
  }

  const data =
    collectSettings();

  const error =
    validateSettings(
      data
    );

  if (error) {
    showMessage(
      error,
      "error"
    );
    return;
  }

  const button =
    $("saveSettingsBtn");

  button.disabled = true;
  button.textContent =
    "Saving...";

  setText(
    "settingsSyncStatus",
    "Saving settings..."
  );

  try {
    const metadata = {
      type: "modeSettings",
      updatedAt:
        serverTimestamp(),
      updatedBy:
        user.uid
    };

    const writes = [];

    Object.keys(
      MODE_BINDINGS
    ).forEach(
      (mode) => {
        writes.push(
          setDoc(
            doc(
              db,
              "gameSettings",
              mode
            ),
            {
              ...data[mode],
              ...metadata
            },
            {
              merge: true
            }
          )
        );
      }
    );

    writes.push(
      setDoc(
        doc(
          db,
          "gameSettings",
          "global"
        ),
        {
          ...data.global,
          type:
            "globalSettings",
          updatedAt:
            serverTimestamp(),
          updatedBy:
            user.uid
        },
        {
          merge: true
        }
      )
    );

    await Promise.all(
      writes
    );

    showMessage(
      "บันทึก Game Settings ครบทั้ง 8 โหมดเรียบร้อย",
      "success"
    );

    setText(
      "settingsSyncStatus",
      "Saved just now"
    );

  } catch (error) {
    console.error(
      "Save settings error:",
      error
    );

    showMessage(
      "บันทึก Game Settings ไม่สำเร็จ",
      "error"
    );

    setText(
      "settingsSyncStatus",
      "Save failed"
    );
  } finally {
    button.disabled = false;
    button.textContent =
      "Save All Settings";
  }
}


function collectSettings() {
  const result = {};

  Object.entries(
    MODE_BINDINGS
  ).forEach(
    ([mode, binding]) => {
      result[mode] = {};

      Object.entries(binding)
        .forEach(
          ([key, id]) => {
            const element =
              $(id);

            if (!element) {
              return;
            }

            result[mode][key] =
              element.type ===
              "checkbox"
                ? element.checked
                : Number(
                    element.value
                  );
          }
        );
    }
  );

  result.global = {
    wrongFeedbackEnabled:
      $("feedbackEnabled")
        .checked,
    wrongFeedbackImageEnabled:
      $("feedbackImageEnabled")
        .checked,
    wrongFeedbackImage:
      feedbackImageData,
    wrongFeedbackSoundEnabled:
      $("feedbackSoundEnabled")
        .checked,
    wrongFeedbackSoundUrl:
      $("feedbackSoundUrl")
        .value.trim(),
    wrongFeedbackDuration:
      Number(
        $("feedbackDuration")
          .value
      )
  };

  return result;
}


function validateSettings(
  settings
) {
  for (
    const mode of [
      "translation",
      "meaning",
      "synonym",
      "weak"
    ]
  ) {
    const item =
      settings[mode];

    if (
      item.timePerQuestion <
      3
    ) {
      return (
        getModeLabel(mode) +
        ": เวลาอย่างน้อย 3 วินาที"
      );
    }

    if (
      item.questionsPerGame <
      1
    ) {
      return (
        getModeLabel(mode) +
        ": ต้องมีอย่างน้อย 1 ข้อ"
      );
    }

    if (
      item.choices <
      2
    ) {
      return (
        getModeLabel(mode) +
        ": ต้องมีอย่างน้อย 2 ตัวเลือก"
      );
    }

    if (
      item.wrongLimitEnabled &&
      item.maxWrong < 1
    ) {
      return (
        getModeLabel(mode) +
        ": จำนวนตอบผิดสูงสุดต้องอย่างน้อย 1"
      );
    }
  }

  if (
    settings.synonym
      .minCorrectSynonyms <
    1
  ) {
    return "Synonym: Min Correct ต้องอย่างน้อย 1";
  }

  if (
    settings.synonym
      .maxCorrectSynonyms <
    settings.synonym
      .minCorrectSynonyms
  ) {
    return "Synonym: Max Correct ต้องไม่น้อยกว่า Min Correct";
  }

  if (
    settings.synonym
      .maxCorrectSynonyms >=
    settings.synonym.choices
  ) {
    return "Synonym: ต้องมีคำตอบหลอกอย่างน้อย 1 ตัว";
  }

  if (
    settings.weak
      .repeatSingleWord <
    1
  ) {
    return "Review: จำนวนฝึกซ้ำต้องอย่างน้อย 1";
  }

  for (
    const mode of [
      "grammar-part5",
      "grammar-fill",
      "grammar-error",
      "grammar-sentence"
    ]
  ) {
    const item =
      settings[mode];

    if (
      item.timePerQuestion <
      3
    ) {
      return (
        getModeLabel(mode) +
        ": เวลาอย่างน้อย 3 วินาที"
      );
    }

    if (
      item.questionsPerGame <
      1
    ) {
      return (
        getModeLabel(mode) +
        ": ต้องมีอย่างน้อย 1 ข้อ"
      );
    }

    if (
      item.wrongLimitEnabled &&
      item.maxWrong < 1
    ) {
      return (
        getModeLabel(mode) +
        ": จำนวนตอบผิดสูงสุดต้องอย่างน้อย 1"
      );
    }
  }

  if (
    settings.global
      .wrongFeedbackDuration <
    500
  ) {
    return "Global Feedback: อย่างน้อย 500 ms";
  }

  return "";
}


function getModeLabel(
  mode
) {
  return {
    translation:
      "Translation",
    meaning:
      "Meaning",
    synonym:
      "Synonym",
    weak:
      "Review",
    "grammar-part5":
      "TOEIC Part 5",
    "grammar-fill":
      "Fill in the Blank",
    "grammar-error":
      "Error Detection",
    "grammar-sentence":
      "Sentence Building"
  }[mode] || mode;
}


function showMessage(
  message,
  type
) {
  const element =
    $("settingsMessage");

  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.className =
    "settings-message show " +
    type;
}


function clearMessage() {
  const element =
    $("settingsMessage");

  if (!element) {
    return;
  }

  element.textContent = "";
  element.className =
    "settings-message";
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


function bindLogout() {
  const button =
    $("logoutBtn");

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async () => {
      await signOut(auth);
      window.location.href =
        "../index.html";
    }
  );
}
