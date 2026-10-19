/* =========================================================
   VOCAB ONNY
   PHASE E - ADMIN DATA MANAGEMENT
========================================================= */


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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   DOM
========================================================= */

const $ = (id) => {
  return document.getElementById(id);
};


const dataMessage =
  $("dataMessage");


const connectionDot =
  $("connectionDot");


const connectionText =
  $("connectionText");


const summaryVocabulary =
  $("summaryVocabulary");


const summaryUsers =
  $("summaryUsers");


const summaryHistory =
  $("summaryHistory");


const summaryWordStats =
  $("summaryWordStats");


const backupAllBtn =
  $("backupAllBtn");


const exportVocabJsonBtn =
  $("exportVocabJsonBtn");


const exportVocabCsvBtn =
  $("exportVocabCsvBtn");


const exportSettingsBtn =
  $("exportSettingsBtn");


const exportUsersBtn =
  $("exportUsersBtn");


const vocabImportFile =
  $("vocabImportFile");


const importVocabBtn =
  $("importVocabBtn");


const settingsImportFile =
  $("settingsImportFile");


const importSettingsBtn =
  $("importSettingsBtn");


const userSelect =
  $("userSelect");


const exportUserLearningBtn =
  $("exportUserLearningBtn");


const clearSelectedUserBtn =
  $("clearSelectedUserBtn");


const clearAllLearningBtn =
  $("clearAllLearningBtn");

const backupAllBtnSecondary =
  $("backupAllBtnSecondary");

const runHealthCheckBtn =
  $("runHealthCheckBtn");

const clearVocabularyBtn =
  $("clearVocabularyBtn");

const clearGrammarQuestionsBtn =
  $("clearGrammarQuestionsBtn");


/* =========================================================
   STATE
========================================================= */

let currentAdminUid = "";

let usersCache = [];

let busy = false;


/* =========================================================
   COLLECTION NAMES
========================================================= */

const SETTINGS_DOC_IDS =
  new Set([
    "translation",
    "meaning",
    "synonym",
    "weak",
    "grammar-part5",
    "grammar-fill",
    "grammar-error",
    "grammar-sentence",
    "global"
  ]);


const COLLECTIONS = {

  users:
    "users",

  vocabulary:
    "vocabulary",

  gameSettings:
    "gameSettings",

  wordStats:
    "wordStats",

  history:
    "history",

  dailyStats:
    "dailyStats"

};


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "../index.html";

      return;
    }


    try {

      const userRef =
        doc(
          db,
          COLLECTIONS.users,
          user.uid
        );


      const userSnap =
        await getDoc(
          userRef
        );


      if (!userSnap.exists()) {

        window.location.href =
          "../user/dashboard.html";

        return;
      }


      const profile =
        userSnap.data();


      if (
        profile.role !==
        "admin"
      ) {

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


      currentAdminUid =
        user.uid;


      renderAdminProfile(
        user,
        profile
      );


      bindLogout();


      bindEvents();


      setConnectionStatus(
        true,
        "Firebase Connected"
      );


      await initializePage();


    } catch (error) {

      console.error(
        "Data Management auth error:",
        error
      );


      setConnectionStatus(
        false,
        "Firebase Error"
      );


      showMessage(
        getErrorMessage(error),
        "error"
      );

    }

  }
);


/* =========================================================
   INITIALIZE
========================================================= */

async function initializePage() {

  try {

    setBusy(true);


    await loadUsers();


    await refreshSummary();


  } catch (error) {

    console.error(
      "Initialize Data Management error:",
      error
    );


    showMessage(
      getErrorMessage(error),
      "error"
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   ADMIN PROFILE
========================================================= */

function renderAdminProfile(
  user,
  profile
) {

  const adminName =
    $("adminName");


  const adminEmail =
    $("adminEmail");


  const adminAvatar =
    $("adminAvatar");


  const name =
    profile?.displayName ||
    user?.displayName ||
    "Administrator";


  const email =
    profile?.email ||
    user?.email ||
    "";


  if (adminName) {

    adminName.textContent =
      name;

  }


  if (adminEmail) {

    adminEmail.textContent =
      email;

  }


  if (adminAvatar) {

    adminAvatar.textContent =
      getInitial(name);

  }

}


function getInitial(value) {

  const text =
    String(value || "")
      .trim();


  if (!text) {
    return "A";
  }


  return text
    .charAt(0)
    .toUpperCase();

}


/* =========================================================
   LOGOUT
========================================================= */

function bindLogout() {

  const logoutBtn =
    $("adminLogoutBtn") ||
    $("logoutBtn");


  if (!logoutBtn) {
    return;
  }


  logoutBtn.addEventListener(
    "click",

    async () => {

      try {

        await signOut(auth);

      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

      }


      window.location.href =
        "../index.html";

    }
  );

}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  backupAllBtn?.addEventListener(
    "click",
    handleBackupAll
  );

  backupAllBtnSecondary?.addEventListener(
    "click",
    handleBackupAll
  );

  bindDataTabs();


  exportVocabJsonBtn?.addEventListener(
    "click",
    handleExportVocabularyJSON
  );


  exportVocabCsvBtn?.addEventListener(
    "click",
    handleExportVocabularyCSV
  );


  exportSettingsBtn?.addEventListener(
    "click",
    handleExportSettings
  );


  exportUsersBtn?.addEventListener(
    "click",
    handleExportUsers
  );


  importVocabBtn?.addEventListener(
    "click",
    handleImportVocabulary
  );


  importSettingsBtn?.addEventListener(
    "click",
    handleImportSettings
  );


  exportUserLearningBtn?.addEventListener(
    "click",
    handleExportUserLearning
  );


  clearSelectedUserBtn?.addEventListener(
    "click",
    handleClearSelectedUser
  );


  clearAllLearningBtn?.addEventListener(
    "click",
    handleClearAllLearning
  );

  userSelect?.addEventListener(
    "change",
    handleSelectedUserChange
  );

  runHealthCheckBtn?.addEventListener(
    "click",
    handleHealthCheck
  );

  clearVocabularyBtn?.addEventListener(
    "click",
    handleClearVocabulary
  );

  clearGrammarQuestionsBtn?.addEventListener(
    "click",
    handleClearGrammarQuestions
  );

}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

  const snapshot =
    await getDocs(
      collection(
        db,
        COLLECTIONS.users
      )
    );


  usersCache =
    snapshot.docs.map(
      (item) => {

        return {

          id:
            item.id,

          ...item.data()

        };

      }
    );


  usersCache.sort(
    (a, b) => {

      const nameA =
        String(
          a.displayName ||
          a.email ||
          ""
        ).toLowerCase();


      const nameB =
        String(
          b.displayName ||
          b.email ||
          ""
        ).toLowerCase();


      return nameA.localeCompare(
        nameB
      );

    }
  );


  renderUserSelect();

}


function renderUserSelect() {

  if (!userSelect) {
    return;
  }


  userSelect.innerHTML =
    "";


  const placeholder =
    document.createElement(
      "option"
    );


  placeholder.value =
    "";


  placeholder.textContent =
    "เลือกผู้ใช้งาน";


  userSelect.appendChild(
    placeholder
  );


  usersCache.forEach(
    (user) => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        user.id;


      const name =
        user.displayName ||
        user.email ||
        user.id;


      const role =
        user.role ||
        "user";


      option.textContent =
        `${name} (${role})`;


      userSelect.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   SUMMARY
========================================================= */

async function refreshSummary() {

  try {

    const [
      vocabulary,
      users
    ] =
      await Promise.all([

        readCollection(
          COLLECTIONS.vocabulary
        ),

        readCollection(
          COLLECTIONS.users
        )

      ]);


    let historyCount =
      0;


    let wordStatsCount =
      0;


    for (const user of users) {

      const uid =
        user.id;


      const [
        historySnapshot,
        wordStatsSnapshot
      ] =
        await Promise.all([

          getDocs(
            collection(
              db,
              COLLECTIONS.users,
              uid,
              COLLECTIONS.history
            )
          ),

          getDocs(
            collection(
              db,
              COLLECTIONS.users,
              uid,
              COLLECTIONS.wordStats
            )
          )

        ]);


      historyCount +=
        historySnapshot.size;


      wordStatsCount +=
        wordStatsSnapshot.size;

    }


    if (summaryVocabulary) {

      summaryVocabulary.textContent =
        String(
          vocabulary.length
        );

    }


    if (summaryUsers) {

      summaryUsers.textContent =
        String(
          users.length
        );

    }


    if (summaryHistory) {

      summaryHistory.textContent =
        String(
          historyCount
        );

    }


    if (summaryWordStats) {

      summaryWordStats.textContent =
        String(
          wordStatsCount
        );

    }


  } catch (error) {

    console.error(
      "Refresh summary error:",
      error
    );


    throw error;

  }

}


/* =========================================================
   GENERIC COLLECTION READER
========================================================= */

async function readCollection(
  collectionName
) {

  const snapshot =
    await getDocs(
      collection(
        db,
        collectionName
      )
    );


  return snapshot.docs.map(
    (item) => {

      return {

        id:
          item.id,

        ...serializeFirestoreValue(
          item.data()
        )

      };

    }
  );

}


/* =========================================================
   VOCABULARY EXPORT
========================================================= */

async function handleExportVocabularyJSON() {

  if (busy) {
    return;
  }


  try {

    setBusy(true);


    const vocabulary =
      await readCollection(
        COLLECTIONS.vocabulary
      );


    const payload = {

      type:
        "vocab-onny-vocabulary",

      version:
        1,

      exportedAt:
        new Date().toISOString(),

      total:
        vocabulary.length,

      vocabulary:
        vocabulary

    };


    downloadJSON(
      payload,
      createFileName(
        "vocab-onny-vocabulary",
        "json"
      )
    );


    showMessage(
      `Export Vocabulary สำเร็จ ${vocabulary.length} คำ`,
      "success"
    );


  } catch (error) {

    handleError(
      "Export Vocabulary",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   VOCABULARY CSV
========================================================= */

async function handleExportVocabularyCSV() {

  if (busy) {
    return;
  }


  try {

    setBusy(true);


    const vocabulary =
      await readCollection(
        COLLECTIONS.vocabulary
      );


    const headers = [

      "id",

      "word",

      "thai",

      "meaning",

      "exampleSentence",

      "synonyms",

      "level",

      "active"

    ];


    const rows = [

      headers,

      ...vocabulary.map(
        (item) => [

          item.id || "",

          item.word || "",

          item.thai || "",

          item.meaning || "",

          item.exampleSentence || "",

          Array.isArray(
            item.synonyms
          )
            ? item.synonyms.join("|")
            : "",

          item.level || "",

          item.active !== false
            ? "true"
            : "false"

        ]
      )

    ];


    const csv =
      rows
        .map(
          (row) => {

            return row
              .map(csvEscape)
              .join(",");

          }
        )
        .join("\n");


    downloadText(
      "\uFEFF" + csv,

      createFileName(
        "vocab-onny-vocabulary",
        "csv"
      ),

      "text/csv;charset=utf-8"
    );


    showMessage(
      `Export CSV สำเร็จ ${vocabulary.length} คำ`,
      "success"
    );


  } catch (error) {

    handleError(
      "Export Vocabulary CSV",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   SETTINGS EXPORT
========================================================= */

async function handleExportSettings() {

  if (busy) {
    return;
  }


  try {

    setBusy(true);


    const allGameSettings =
      await readCollection(
        COLLECTIONS.gameSettings
      );

    const settings =
      allGameSettings.filter(
        (item) =>
          SETTINGS_DOC_IDS.has(
            String(item.id || "")
          )
      );

    const settingsObject = {};

    settings.forEach(
      (item) => {
        const data = {
          ...item
        };

        delete data.id;

        settingsObject[
          item.id
        ] = data;
      }
    );


    const payload = {

      application:
        "OnnyLab",

      type:
        "game-settings",

      schemaVersion:
        2,

      exportedAt:
        new Date().toISOString(),

      total:
        settings.length,

      settings:
        settingsObject

    };


    downloadJSON(
      payload,

      createFileName(
        "vocab-onny-game-settings",
        "json"
      )
    );


    showMessage(
      "Export Game Settings สำเร็จ",
      "success"
    );


  } catch (error) {

    handleError(
      "Export Settings",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   USERS EXPORT
========================================================= */

async function handleExportUsers() {

  if (busy) {
    return;
  }


  try {

    setBusy(true);


    const users =
      await readCollection(
        COLLECTIONS.users
      );


    const payload = {

      type:
        "vocab-onny-users",

      version:
        1,

      exportedAt:
        new Date().toISOString(),

      total:
        users.length,

      users:
        users

    };


    downloadJSON(
      payload,

      createFileName(
        "vocab-onny-users",
        "json"
      )
    );


    showMessage(
      `Export User Profiles สำเร็จ ${users.length} คน`,
      "success"
    );


  } catch (error) {

    handleError(
      "Export Users",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   USER LEARNING DATA
========================================================= */

async function getUserLearningData(
  uid
) {

  if (!uid) {

    throw new Error(
      "ไม่พบ UID ของผู้ใช้งาน"
    );

  }


  const [
    wordStatsSnapshot,
    historySnapshot,
    dailyStatsSnapshot
  ] =
    await Promise.all([

      getDocs(
        collection(
          db,
          COLLECTIONS.users,
          uid,
          COLLECTIONS.wordStats
        )
      ),

      getDocs(
        collection(
          db,
          COLLECTIONS.users,
          uid,
          COLLECTIONS.history
        )
      ),

      getDocs(
        collection(
          db,
          COLLECTIONS.users,
          uid,
          COLLECTIONS.dailyStats
        )
      )

    ]);


  return {

    wordStats:
      snapshotToArray(
        wordStatsSnapshot
      ),

    history:
      snapshotToArray(
        historySnapshot
      ),

    dailyStats:
      snapshotToArray(
        dailyStatsSnapshot
      )

  };

}


async function handleExportUserLearning() {

  if (busy) {
    return;
  }


  const uid =
    userSelect?.value;


  if (!uid) {

    showMessage(
      "กรุณาเลือกผู้ใช้งานก่อน",
      "error"
    );

    return;
  }


  try {

    setBusy(true);


    const user =
      usersCache.find(
        (item) =>
          item.id === uid
      ) || null;


    const learningData =
      await getUserLearningData(
        uid
      );


    const payload = {

      type:
        "vocab-onny-user-learning",

      version:
        1,

      exportedAt:
        new Date().toISOString(),

      user: {

        uid:
          uid,

        displayName:
          user?.displayName || "",

        email:
          user?.email || ""

      },

      ...learningData

    };


    downloadJSON(
      payload,

      createFileName(
        `vocab-onny-learning-${safeFilePart(
          user?.displayName ||
          uid
        )}`,
        "json"
      )
    );


    showMessage(
      "Export Learning Data สำเร็จ",
      "success"
    );


  } catch (error) {

    handleError(
      "Export Learning Data",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   FULL BACKUP
========================================================= */

async function handleBackupAll() {

  if (busy) {
    return;
  }


  try {

    setBusy(true);


    showMessage(
      "กำลังสร้าง Full Backup...",
      "info"
    );


    const [
      vocabulary,
      allGameSettings,
      users
    ] =
      await Promise.all([

        readCollection(
          COLLECTIONS.vocabulary
        ),

        readCollection(
          COLLECTIONS.gameSettings
        ),

        readCollection(
          COLLECTIONS.users
        )

      ]);

    const settings =
      allGameSettings.filter(
        (item) =>
          SETTINGS_DOC_IDS.has(
            String(item.id || "")
          )
      );

    const grammarQuestions =
      allGameSettings.filter(
        (item) =>
          item.type ===
          "grammarQuestion"
      );


    const learning = {};


    for (const user of users) {

      learning[user.id] =
        await getUserLearningData(
          user.id
        );

    }


    const backup = {

      application:
        "OnnyLab",

      type:
        "full-backup",

      schemaVersion:
        2,

      exportedAt:
        new Date().toISOString(),

      exportedBy:
        currentAdminUid,

      vocabulary:
        vocabulary,

      grammarQuestions:
        grammarQuestions,

      gameSettings:
        settings,

      users:
        users,

      learning:
        learning

    };


    downloadJSON(
      backup,

      createFileName(
        "vocab-onny-full-backup",
        "json"
      )
    );


    showMessage(
      "Full Backup สำเร็จ",
      "success"
    );


  } catch (error) {

    handleError(
      "Full Backup",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   IMPORT VOCABULARY
========================================================= */

async function handleImportVocabulary() {

  if (busy) {
    return;
  }


  const file =
    vocabImportFile
      ?.files?.[0];


  if (!file) {

    showMessage(
      "กรุณาเลือกไฟล์ Vocabulary JSON",
      "error"
    );

    return;
  }


  try {

    setBusy(true);


    const json =
      await readJSONFile(
        file
      );


    const vocabulary =
      extractVocabularyArray(
        json
      );


    if (
      vocabulary.length === 0
    ) {

      throw new Error(
        "ไม่พบ Vocabulary ในไฟล์"
      );

    }


    const validWords =
      vocabulary
        .map(normalizeVocabulary)
        .filter(Boolean);


    if (
      validWords.length === 0
    ) {

      throw new Error(
        "ไม่พบคำศัพท์ที่ถูกต้องในไฟล์"
      );

    }


    const confirmed =
      window.confirm(
        `พบคำศัพท์ ${validWords.length} คำ\n\n` +
        "ระบบจะเพิ่ม/อัปเดต Vocabulary ใน Firestore\n" +
        "คำศัพท์เดิมที่ ID ตรงกันจะถูกอัปเดต\n\n" +
        "ต้องการดำเนินการต่อหรือไม่?"
      );


    if (!confirmed) {

      showMessage(
        "ยกเลิกการ Import",
        "info"
      );

      return;
    }


    await importVocabularyDocuments(
      validWords
    );


    vocabImportFile.value =
      "";


    await refreshSummary();


    showMessage(
      `Import Vocabulary สำเร็จ ${validWords.length} คำ`,
      "success"
    );


  } catch (error) {

    handleError(
      "Import Vocabulary",
      error
    );


  } finally {

    setBusy(false);

  }

}


function extractVocabularyArray(
  json
) {

  if (Array.isArray(json)) {

    return json;

  }


  if (
    Array.isArray(
      json?.vocabulary
    )
  ) {

    return json.vocabulary;

  }


  throw new Error(
    "รูปแบบไฟล์ Vocabulary ไม่ถูกต้อง"
  );

}


function normalizeVocabulary(
  item
) {

  if (
    !item ||
    typeof item !==
    "object"
  ) {

    return null;

  }


  const word =
    String(
      item.word || ""
    ).trim();


  const thai =
    String(
      item.thai || ""
    ).trim();


  if (!word || !thai) {

    return null;

  }


  let synonyms = [];


  if (
    Array.isArray(
      item.synonyms
    )
  ) {

    synonyms =
      item.synonyms
        .map(
          (value) =>
            String(value).trim()
        )
        .filter(Boolean);

  } else if (
    typeof item.synonyms ===
    "string"
  ) {

    synonyms =
      item.synonyms
        .split(/[|,]/)
        .map(
          (value) =>
            value.trim()
        )
        .filter(Boolean);

  }


  return {

    id:
      sanitizeDocumentId(
        item.id ||
        word
      ),

    word:
      word,

    thai:
      thai,

    meaning:
      String(
        item.meaning || ""
      ).trim(),

    exampleSentence:
      String(
        item.exampleSentence || ""
      ).trim(),

    synonyms:
      synonyms,

    level:
      String(
        item.level || "A1"
      ).trim(),

    active:
      item.active !== false

  };

}


async function importVocabularyDocuments(
  vocabulary
) {

  const chunkSize =
    400;


  for (
    let start = 0;
    start < vocabulary.length;
    start += chunkSize
  ) {

    const chunk =
      vocabulary.slice(
        start,
        start + chunkSize
      );


    const batch =
      writeBatch(db);


    chunk.forEach(
      (item) => {

        const reference =
          doc(
            db,
            COLLECTIONS.vocabulary,
            item.id
          );


        batch.set(
          reference,

          {

            word:
              item.word,

            thai:
              item.thai,

            meaning:
              item.meaning,

            exampleSentence:
              item.exampleSentence,

            synonyms:
              item.synonyms,

            level:
              item.level,

            active:
              item.active,

            updatedAt:
              serverTimestamp()

          },

          {
            merge: true
          }

        );

      }
    );


    await batch.commit();

  }

}


/* =========================================================
   IMPORT SETTINGS
========================================================= */

async function handleImportSettings() {

  if (busy) {
    return;
  }


  const file =
    settingsImportFile
      ?.files?.[0];


  if (!file) {

    showMessage(
      "กรุณาเลือกไฟล์ Game Settings JSON",
      "error"
    );

    return;
  }


  try {

    setBusy(true);


    const json =
      await readJSONFile(
        file
      );


    const settings =
      extractSettingsArray(
        json
      );


    const allowedSettingIds =
      SETTINGS_DOC_IDS;


    const invalidSetting =
      settings.find(
        (item) =>
          !item ||
          !allowedSettingIds.has(
            String(item.id || "").trim()
          )
      );


    if (invalidSetting) {
      throw new Error(
        "Game Settings มี Document ID ที่ระบบไม่รองรับ"
      );
    }


    if (
      settings.length === 0
    ) {

      throw new Error(
        "ไม่พบ Game Settings ในไฟล์"
      );

    }


    const settingNames =
      settings
        .map(
          (item) =>
            String(
              item.id || ""
            )
        )
        .join(", ");

    const confirmed =
      window.confirm(
        `พบ Settings ${settings.length} รายการ\n\n` +
        settingNames +
        "\n\nค่าที่มี Document ID ตรงกันจะถูก merge เข้ากับค่าปัจจุบัน\n" +
        "ระบบจะดาวน์โหลด Pre-Restore Backup ให้อัตโนมัติก่อนเขียนค่า\n\n" +
        "ต้องการ Restore หรือไม่?"
      );


    if (!confirmed) {

      showMessage(
        "ยกเลิกการ Restore",
        "info"
      );

      return;
    }


    const currentSettings =
      (
        await readCollection(
          COLLECTIONS.gameSettings
        )
      ).filter(
        (item) =>
          SETTINGS_DOC_IDS.has(
            String(item.id || "")
          )
      );

    const preRestoreObject = {};

    currentSettings.forEach(
      (item) => {
        const data = {
          ...item
        };

        delete data.id;

        preRestoreObject[
          item.id
        ] = data;
      }
    );

    downloadJSON(
      {
        application:
          "OnnyLab",
        type:
          "game-settings-pre-restore",
        schemaVersion:
          2,
        exportedAt:
          new Date().toISOString(),
        settings:
          preRestoreObject
      },
      createFileName(
        "onnylab-settings-pre-restore",
        "json"
      )
    );


    const batch =
      writeBatch(db);


    settings.forEach(
      (item) => {

        if (
          !item ||
          typeof item !==
          "object"
        ) {

          return;

        }


        const id =
          sanitizeDocumentId(
            item.id || ""
          );


        if (!id) {
          return;
        }


        const data = {
          ...item
        };


        delete data.id;


        data.updatedAt =
          serverTimestamp();


        batch.set(
          doc(
            db,
            COLLECTIONS.gameSettings,
            id
          ),

          sanitizeImportObject(
            data
          ),

          {
            merge: true
          }
        );

      }
    );


    await batch.commit();


    settingsImportFile.value =
      "";


    showMessage(
      "Import Game Settings สำเร็จ",
      "success"
    );


  } catch (error) {

    handleError(
      "Import Settings",
      error
    );


  } finally {

    setBusy(false);

  }

}


function extractSettingsArray(
  json
) {

  if (Array.isArray(json)) {

    return json;

  }


  if (
    Array.isArray(
      json?.settings
    )
  ) {

    return json.settings;

  }


  if (
    json?.settings &&
    typeof json.settings ===
      "object" &&
    !Array.isArray(
      json.settings
    )
  ) {
    return Object.entries(
      json.settings
    ).map(
      ([id, value]) => ({
        id,
        ...(
          value &&
          typeof value === "object"
            ? value
            : {}
        )
      })
    );
  }


  if (
    json &&
    typeof json === "object"
  ) {

    /*
      รองรับรูปแบบ:
      {
        translation: {...},
        meaning: {...}
      }
    */

    const ignoredKeys =
      new Set([
        "type",
        "version",
        "exportedAt"
      ]);


    const entries =
      Object.entries(json)
        .filter(
          ([key, value]) => {

            return (
              !ignoredKeys.has(key) &&
              value &&
              typeof value ===
              "object" &&
              !Array.isArray(value)
            );

          }
        );


    if (entries.length > 0) {

      return entries.map(
        ([id, value]) => {

          return {
            id,
            ...value
          };

        }
      );

    }

  }


  throw new Error(
    "รูปแบบไฟล์ Game Settings ไม่ถูกต้อง"
  );

}


/* =========================================================
   CLEAR SELECTED USER
========================================================= */

async function handleClearSelectedUser() {

  if (busy) {
    return;
  }


  const uid =
    userSelect?.value;


  if (!uid) {

    showMessage(
      "กรุณาเลือกผู้ใช้งานก่อน",
      "error"
    );

    return;
  }


  const user =
    usersCache.find(
      (item) =>
        item.id === uid
    );


  const name =
    user?.displayName ||
    user?.email ||
    uid;


  const firstConfirm =
    window.confirm(
      `ต้องการล้าง Learning Data ของ\n\n${name}\n\n` +
      "ข้อมูลที่จะถูกลบ:\n" +
      "- Word Stats\n" +
      "- Game History\n" +
      "- Daily Stats\n\n" +
      "บัญชี User จะไม่ถูกลบ"
    );


  if (!firstConfirm) {
    return;
  }


  const typed =
    window.prompt(
      `เพื่อยืนยัน พิมพ์คำว่า CLEAR`
    );


  if (
    String(typed || "")
      .trim()
      .toUpperCase() !==
    "CLEAR"
  ) {

    showMessage(
      "ยกเลิกการล้างข้อมูล",
      "info"
    );

    return;
  }


  try {

    setBusy(true);


    showMessage(
      `กำลังล้างข้อมูลของ ${name}...`,
      "info"
    );


    const result =
      await clearUserLearningData(
        uid
      );


    await refreshSummary();


    showMessage(
      `ล้างข้อมูล ${name} สำเร็จ ${result} รายการ`,
      "success"
    );


  } catch (error) {

    handleError(
      "Clear User Data",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   CLEAR ALL USERS
========================================================= */

async function handleClearAllLearning() {

  if (busy) {
    return;
  }


  const firstConfirm =
    window.confirm(
      "คำเตือน!\n\n" +
      "คุณกำลังจะล้าง Learning Data " +
      "ของผู้ใช้งานทุกคน\n\n" +
      "Word Stats, Game History และ Daily Stats " +
      "จะถูกลบ\n\n" +
      "User Profile และ Firebase Authentication " +
      "จะไม่ถูกลบ\n\n" +
      "ต้องการดำเนินการต่อหรือไม่?"
    );


  if (!firstConfirm) {
    return;
  }


  const typed =
    window.prompt(
      "พิมพ์ DELETE ALL เพื่อยืนยัน"
    );


  if (
    String(typed || "")
      .trim()
      .toUpperCase() !==
    "DELETE ALL"
  ) {

    showMessage(
      "ยกเลิกการล้างข้อมูลทั้งหมด",
      "info"
    );

    return;
  }


  try {

    setBusy(true);


    showMessage(
      "กำลังล้าง Learning Data ทั้งหมด...",
      "info"
    );


    let totalDeleted =
      0;


    for (const user of usersCache) {

      totalDeleted +=
        await clearUserLearningData(
          user.id
        );

    }


    await refreshSummary();


    showMessage(
      `ล้าง Learning Data ทั้งหมดสำเร็จ ${totalDeleted} รายการ`,
      "success"
    );


  } catch (error) {

    handleError(
      "Clear All Learning Data",
      error
    );


  } finally {

    setBusy(false);

  }

}


/* =========================================================
   DELETE USER LEARNING
========================================================= */

async function clearUserLearningData(
  uid
) {

  let total =
    0;


  total +=
    await deleteCollectionDocuments(

      collection(
        db,
        COLLECTIONS.users,
        uid,
        COLLECTIONS.wordStats
      )

    );


  total +=
    await deleteCollectionDocuments(

      collection(
        db,
        COLLECTIONS.users,
        uid,
        COLLECTIONS.history
      )

    );


  total +=
    await deleteCollectionDocuments(

      collection(
        db,
        COLLECTIONS.users,
        uid,
        COLLECTIONS.dailyStats
      )

    );


  return total;

}


/* =========================================================
   DELETE COLLECTION DOCUMENTS
========================================================= */

async function deleteCollectionDocuments(
  collectionReference
) {

  const snapshot =
    await getDocs(
      collectionReference
    );


  if (snapshot.empty) {

    return 0;

  }


  const docs =
    snapshot.docs;


  const chunkSize =
    400;


  for (
    let start = 0;
    start < docs.length;
    start += chunkSize
  ) {

    const chunk =
      docs.slice(
        start,
        start + chunkSize
      );


    const batch =
      writeBatch(db);


    chunk.forEach(
      (documentSnapshot) => {

        batch.delete(
          documentSnapshot.ref
        );

      }
    );


    await batch.commit();

  }


  return docs.length;

}


/* =========================================================
   FIRESTORE SNAPSHOT
========================================================= */

function snapshotToArray(
  snapshot
) {

  return snapshot.docs.map(
    (item) => {

      return {

        id:
          item.id,

        ...serializeFirestoreValue(
          item.data()
        )

      };

    }
  );

}


/* =========================================================
   SERIALIZE FIRESTORE VALUES
========================================================= */

function serializeFirestoreValue(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return value ?? null;

  }


  if (Array.isArray(value)) {

    return value.map(
      serializeFirestoreValue
    );

  }


  if (
    typeof value !==
    "object"
  ) {

    return value;

  }


  /*
    Firestore Timestamp
  */

  if (
    typeof value.toDate ===
    "function"
  ) {

    try {

      return value
        .toDate()
        .toISOString();

    } catch (error) {

      console.warn(
        "Timestamp conversion failed:",
        error
      );

    }

  }


  /*
    DocumentReference
  */

  if (
    typeof value.path ===
    "string" &&
    value.firestore
  ) {

    return value.path;

  }


  /*
    GeoPoint
  */

  if (
    typeof value.latitude ===
    "number" &&
    typeof value.longitude ===
    "number"
  ) {

    return {

      latitude:
        value.latitude,

      longitude:
        value.longitude

    };

  }


  const output = {};


  Object.entries(value)
    .forEach(
      ([key, item]) => {

        output[key] =
          serializeFirestoreValue(
            item
          );

      }
    );


  return output;

}


/* =========================================================
   IMPORT SANITIZER
========================================================= */

function sanitizeImportObject(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return null;

  }


  if (Array.isArray(value)) {

    return value
      .map(
        sanitizeImportObject
      );

  }


  if (
    typeof value ===
    "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }


  if (
    typeof value ===
      "string" ||
    typeof value ===
      "boolean"
  ) {

    return value;

  }


  if (
    typeof value ===
    "object"
  ) {

    const output = {};


    Object.entries(value)
      .forEach(
        ([key, item]) => {

          if (
            item !== undefined
          ) {

            output[key] =
              sanitizeImportObject(
                item
              );

          }

        }
      );


    return output;

  }


  return String(value);

}


/* =========================================================
   JSON FILE
========================================================= */

async function readJSONFile(
  file
) {

  const MAX_IMPORT_BYTES =
    5 * 1024 * 1024;

  if (
    !file ||
    file.size > MAX_IMPORT_BYTES
  ) {
    throw new Error(
      "ไฟล์ Import ต้องมีขนาดไม่เกิน 5 MB"
    );
  }

  const text =
    await file.text();


  if (!text.trim()) {

    throw new Error(
      "ไฟล์ว่าง"
    );

  }


  try {

    return JSON.parse(
      text
    );

  } catch (error) {

    throw new Error(
      "ไฟล์ JSON ไม่ถูกต้อง"
    );

  }

}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadJSON(
  data,
  fileName
) {

  const text =
    JSON.stringify(
      data,
      null,
      2
    );


  downloadText(
    text,
    fileName,
    "application/json;charset=utf-8"
  );

}


function downloadText(
  text,
  fileName,
  mimeType
) {

  const blob =
    new Blob(
      [text],
      {
        type:
          mimeType
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


  anchor.href =
    url;


  anchor.download =
    fileName;


  document.body.appendChild(
    anchor
  );


  anchor.click();


  anchor.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );

}


/* =========================================================
   CSV
========================================================= */

function csvEscape(
  value
) {

  const text =
    String(
      value ?? ""
    );


  return (
    '"' +
    text.replace(
      /"/g,
      '""'
    ) +
    '"'
  );

}


/* =========================================================
   FILE NAME
========================================================= */

function createFileName(
  prefix,
  extension
) {

  const now =
    new Date();


  const date =
    [
      now.getFullYear(),

      String(
        now.getMonth() + 1
      ).padStart(2, "0"),

      String(
        now.getDate()
      ).padStart(2, "0")

    ].join("-");


  const time =
    [
      String(
        now.getHours()
      ).padStart(2, "0"),

      String(
        now.getMinutes()
      ).padStart(2, "0"),

      String(
        now.getSeconds()
      ).padStart(2, "0")

    ].join("-");


  return (
    `${safeFilePart(prefix)}-${date}-${time}.${extension}`
  );

}


function safeFilePart(
  value
) {

  return String(
    value || "data"
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9ก-๙_-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    )
    .slice(
      0,
      80
    ) || "data";

}


/* =========================================================
   DOCUMENT ID
========================================================= */

function sanitizeDocumentId(
  value
) {

  let id =
    String(
      value || ""
    )
      .trim();


  if (!id) {

    id =
      createRandomId();

  }


  /*
    Firestore Document ID
    ห้ามมี /
  */

  id =
    id.replace(
      /\//g,
      "-"
    );


  if (
    id === "." ||
    id === ".."
  ) {

    id =
      `item-${Date.now()}`;

  }


  return id.slice(
    0,
    500
  );

}


function createRandomId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
    "function"
  ) {

    return window.crypto
      .randomUUID();

  }


  return (
    "item-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  message,
  type = "info"
) {

  if (!dataMessage) {
    return;
  }


  dataMessage.textContent =
    String(
      message || ""
    );


  dataMessage.className =
    `data-message show ${type}`;


  if (
    type === "success"
  ) {

    window.setTimeout(
      () => {

        if (
          dataMessage.textContent ===
          String(message)
        ) {

          dataMessage.className =
            "data-message";

        }

      },
      5000
    );

  }

}


/* =========================================================
   CONNECTION
========================================================= */

function setConnectionStatus(
  connected,
  text
) {

  if (connectionText) {

    connectionText.textContent =
      text;

  }


  if (connectionDot) {

    connectionDot.classList.toggle(
      "ready",
      Boolean(connected)
    );

  }

}


/* =========================================================
   BUSY
========================================================= */

function setBusy(
  value
) {

  busy =
    Boolean(value);


  const buttons =
    document.querySelectorAll(
      ".data-btn, .data-v3-button"
    );


  buttons.forEach(
    (button) => {

      button.disabled =
        busy;

    }
  );

}


/* =========================================================
   ERROR
========================================================= */

function handleError(
  action,
  error
) {

  console.error(
    `${action} error:`,
    error
  );


  showMessage(
    `${action} ไม่สำเร็จ: ${getErrorMessage(error)}`,
    "error"
  );

}


function getErrorMessage(
  error
) {

  if (!error) {

    return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

  }


  const code =
    String(
      error.code || ""
    );


  if (
    code.includes(
      "permission-denied"
    )
  ) {

    return (
      "Firestore ปฏิเสธสิทธิ์การเข้าถึง " +
      "กรุณาตรวจสอบ Admin Role และ Firestore Rules"
    );

  }


  if (
    code.includes(
      "unavailable"
    )
  ) {

    return (
      "ไม่สามารถเชื่อมต่อ Firebase ได้ " +
      "กรุณาตรวจสอบอินเทอร์เน็ต"
    );

  }


  return (
    error.message ||
    String(error)
  );

}

/* =========================================================
   DATA MANAGEMENT V3
========================================================= */

function bindDataTabs() {
  document
    .querySelectorAll(
      "[data-data-tab]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const name =
            button.dataset.dataTab;

          document
            .querySelectorAll(
              "[data-data-tab]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item === button
                )
            );

          document
            .querySelectorAll(
              "[data-data-panel]"
            )
            .forEach(
              (panel) =>
                panel.classList.toggle(
                  "active",
                  panel.dataset
                    .dataPanel ===
                    name
                )
            );
        }
      );
    });
}


async function handleSelectedUserChange() {
  const uid =
    userSelect?.value || "";

  if (!uid) {
    renderSelectedUserSummary(
      null,
      null
    );
    return;
  }

  const user =
    usersCache.find(
      (item) =>
        item.id === uid
    );

  try {
    const learning =
      await getUserLearningData(
        uid
      );

    renderSelectedUserSummary(
      user,
      learning
    );
  } catch (error) {
    console.error(
      "Selected user summary error:",
      error
    );

    showMessage(
      "โหลด Learning Data ของ User ไม่สำเร็จ",
      "error"
    );
  }
}


function renderSelectedUserSummary(
  user,
  learning
) {
  const wordStats =
    learning?.wordStats?.length || 0;

  const history =
    learning?.history?.length || 0;

  const dailyStats =
    learning?.dailyStats?.length || 0;

  const total =
    wordStats +
    history +
    dailyStats;

  setDataText(
    "selectedUserWordStats",
    learning ? wordStats : "—"
  );

  setDataText(
    "selectedUserHistory",
    learning ? history : "—"
  );

  setDataText(
    "selectedUserDailyStats",
    learning ? dailyStats : "—"
  );

  setDataText(
    "selectedUserTotal",
    learning ? total : "—"
  );

  const meta =
    $("selectedUserMeta");

  if (!meta) {
    return;
  }

  if (!user || !learning) {
    meta.textContent =
      "เลือก User เพื่อดู Learning Data";
    return;
  }

  const name =
    user.displayName ||
    user.email ||
    user.id;

  meta.textContent =
    name +
    " · " +
    total +
    " learning records";
}


async function handleHealthCheck() {
  if (busy) {
    return;
  }

  try {
    setBusy(true);

    setDataText(
      "healthOverallStatus",
      "Checking..."
    );

    const [
      vocabulary,
      gameSettings
    ] = await Promise.all([
      readCollection(
        COLLECTIONS.vocabulary
      ),
      readCollection(
        COLLECTIONS.gameSettings
      )
    ]);

    const grammarQuestions =
      gameSettings.filter(
        (item) =>
          item.type ===
          "grammarQuestion"
      );

    const settings =
      gameSettings.filter(
        (item) =>
          SETTINGS_DOC_IDS.has(
            String(item.id || "")
          )
      );

    const normalizedWords =
      new Map();

    vocabulary.forEach(
      (item) => {
        const key =
          String(item.word || "")
            .trim()
            .toLowerCase()
            .replace(
              /\s+/g,
              " "
            );

        if (!key) {
          return;
        }

        normalizedWords.set(
          key,
          (normalizedWords.get(key) || 0) + 1
        );
      }
    );

    const duplicateWordGroups =
      [...normalizedWords.values()]
        .filter(
          (count) =>
            count > 1
        ).length;

    const incompleteVocabulary =
      vocabulary.filter(
        (item) =>
          !String(
            item.word || ""
          ).trim()
          ||
          !String(
            item.thai || ""
          ).trim()
      ).length;

    const invalidGrammar =
      grammarQuestions.filter(
        (item) =>
          !String(
            item.chapterId || ""
          ).trim()
          ||
          !String(
            item.mode || ""
          ).trim()
          ||
          !String(
            item.prompt || ""
          ).trim()
          ||
          !String(
            item.correctAnswer || ""
          ).trim()
      ).length;

    const missingSettings =
      [...SETTINGS_DOC_IDS]
        .filter(
          (id) =>
            !settings.some(
              (item) =>
                item.id === id
            )
        );

    const unknownGameSettings =
      gameSettings.filter(
        (item) =>
          !SETTINGS_DOC_IDS.has(
            String(item.id || "")
          )
          &&
          item.type !==
            "grammarQuestion"
      ).length;

    const issues = [
      {
        label:
          "Duplicate Vocabulary",
        detail:
          "กลุ่มคำศัพท์ที่ชื่อซ้ำกัน",
        count:
          duplicateWordGroups,
        level:
          duplicateWordGroups
            ? "warn"
            : "good"
      },
      {
        label:
          "Incomplete Vocabulary",
        detail:
          "คำศัพท์ที่ไม่มี word หรือ thai",
        count:
          incompleteVocabulary,
        level:
          incompleteVocabulary
            ? "bad"
            : "good"
      },
      {
        label:
          "Invalid Grammar Questions",
        detail:
          "โจทย์ที่ขาด chapter / mode / prompt / answer",
        count:
          invalidGrammar,
        level:
          invalidGrammar
            ? "bad"
            : "good"
      },
      {
        label:
          "Missing Game Settings",
        detail:
          missingSettings.length
            ? missingSettings.join(", ")
            : "ครบทั้ง 9 settings docs",
        count:
          missingSettings.length,
        level:
          missingSettings.length
            ? "warn"
            : "good"
      },
      {
        label:
          "Unknown gameSettings docs",
        detail:
          "Document ที่ไม่ใช่ Settings และไม่ใช่ Grammar Question",
        count:
          unknownGameSettings,
        level:
          unknownGameSettings
            ? "warn"
            : "good"
      }
    ];

    const issueCount =
      issues.reduce(
        (sum, item) =>
          sum + item.count,
        0
      );

    setDataText(
      "healthGrammarCount",
      grammarQuestions.length
    );

    setDataText(
      "healthDuplicateWords",
      duplicateWordGroups
    );

    setDataText(
      "healthIssuesCount",
      issueCount
    );

    setDataText(
      "healthOverallStatus",
      issueCount
        ? "Needs attention"
        : "Healthy"
    );

    renderHealthResults(
      issues
    );

    showMessage(
      issueCount
        ? "Health Check เสร็จแล้ว พบจุดที่ควรตรวจสอบ " +
          issueCount +
          " รายการ"
        : "Health Check เสร็จแล้ว ไม่พบปัญหาหลัก",
      issueCount
        ? "info"
        : "success"
    );

  } catch (error) {
    handleError(
      "Database Health Check",
      error
    );

    setDataText(
      "healthOverallStatus",
      "Check failed"
    );
  } finally {
    setBusy(false);
  }
}


function renderHealthResults(
  issues
) {
  const container =
    $("healthResults");

  if (!container) {
    return;
  }

  container.innerHTML =
    issues.map(
      (item) =>
        '<div class="health-item ' +
        item.level +
        '">' +
          '<div>' +
            '<strong>' +
              escapeDataHtml(
                item.label
              ) +
            '</strong>' +
            '<small>' +
              escapeDataHtml(
                item.detail
              ) +
            '</small>' +
          '</div>' +
          '<span class="health-count">' +
            item.count +
          '</span>' +
        '</div>'
    ).join("");
}


async function handleClearVocabulary() {
  if (busy) {
    return;
  }

  const confirmed =
    window.confirm(
      "ลบ Vocabulary ทั้งหมดหรือไม่?\n\n" +
      "การทำงานนี้ไม่สามารถ Undo ได้จากหน้าเว็บ"
    );

  if (!confirmed) {
    return;
  }

  const typed =
    window.prompt(
      "พิมพ์ DELETE VOCABULARY เพื่อยืนยัน"
    );

  if (
    String(typed || "")
      .trim()
      .toUpperCase() !==
    "DELETE VOCABULARY"
  ) {
    showMessage(
      "ยกเลิกการลบ Vocabulary",
      "info"
    );
    return;
  }

  try {
    setBusy(true);

    const deleted =
      await deleteCollectionDocuments(
        collection(
          db,
          COLLECTIONS.vocabulary
        )
      );

    await refreshSummary();

    showMessage(
      "ลบ Vocabulary สำเร็จ " +
      deleted +
      " รายการ",
      "success"
    );
  } catch (error) {
    handleError(
      "Clear Vocabulary",
      error
    );
  } finally {
    setBusy(false);
  }
}


async function handleClearGrammarQuestions() {
  if (busy) {
    return;
  }

  const confirmed =
    window.confirm(
      "ลบ Grammar Questions ทั้งหมดหรือไม่?\n\n" +
      "Game Settings จะไม่ถูกลบ"
    );

  if (!confirmed) {
    return;
  }

  const typed =
    window.prompt(
      "พิมพ์ DELETE GRAMMAR เพื่อยืนยัน"
    );

  if (
    String(typed || "")
      .trim()
      .toUpperCase() !==
    "DELETE GRAMMAR"
  ) {
    showMessage(
      "ยกเลิกการลบ Grammar Questions",
      "info"
    );
    return;
  }

  try {
    setBusy(true);

    const snapshot =
      await getDocs(
        collection(
          db,
          COLLECTIONS.gameSettings
        )
      );

    const grammarDocs =
      snapshot.docs.filter(
        (item) =>
          item.data()?.type ===
          "grammarQuestion"
      );

    const chunkSize = 400;

    for (
      let start = 0;
      start < grammarDocs.length;
      start += chunkSize
    ) {
      const batch =
        writeBatch(db);

      grammarDocs
        .slice(
          start,
          start + chunkSize
        )
        .forEach(
          (item) =>
            batch.delete(
              item.ref
            )
        );

      await batch.commit();
    }

    showMessage(
      "ลบ Grammar Questions สำเร็จ " +
      grammarDocs.length +
      " รายการ",
      "success"
    );

    setDataText(
      "healthGrammarCount",
      "—"
    );

  } catch (error) {
    handleError(
      "Clear Grammar Questions",
      error
    );
  } finally {
    setBusy(false);
  }
}


function setDataText(
  id,
  value
) {
  const element =
    $(id);

  if (element) {
    element.textContent =
      String(value);
  }
}


function escapeDataHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
