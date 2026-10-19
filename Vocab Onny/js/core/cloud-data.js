/* =========================================================
   Vocab Onny - Cloud Data Layer
   Final Phase B

   Firestore structure:

   users/{uid}
   ├── wordStats/{wordId}
   ├── history/{gameId}
   └── dailyStats/{YYYY-MM-DD}

   IMPORTANT
   - Firebase Auth remains source of truth for authentication.
   - This file handles learning data only.
   - Firestore is the single source of truth for persistent learning data.
========================================================= */

import { db } from "./firebase.js";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   CONSTANTS
========================================================= */

export const LEARNING_SCHEMA_VERSION = 1;

export const CLOUD_COLLECTIONS = Object.freeze({
  WORD_STATS: "wordStats",
  HISTORY: "history",
  DAILY_STATS: "dailyStats"
});


/* =========================================================
   HELPERS
========================================================= */

function requireUid(uid) {
  const normalized = String(uid || "").trim();

  if (!normalized) {
    throw new Error("Firebase UID is required.");
  }

  return normalized;
}


function isPlainObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}


function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function sanitizeForFirestore(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeForFirestore(item)
    );
  }

  if (isPlainObject(value)) {
    const result = {};

    Object.entries(value).forEach(([key, item]) => {
      if (item !== undefined) {
        result[key] =
          sanitizeForFirestore(item);
      }
    });

    return result;
  }

  /*
    Preserve Firestore SDK special values such as:
    - serverTimestamp() FieldValue
    - Timestamp
    - GeoPoint
    - DocumentReference

    These are class instances, not plain objects.
    Converting them to String/Object would corrupt the value.
  */
  if (typeof value === "object") {
    return value;
  }

  return String(value);
}


function normalizeTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "object" &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value === "object" &&
    Number.isFinite(value.seconds)
  ) {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}


function makeSafeDocumentId(value) {
  const raw = String(value || "")
    .trim();

  if (!raw) {
    return "";
  }

  return raw
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 500);
}


function createHistoryId(game = {}) {
  if (game.id) {
    return makeSafeDocumentId(game.id);
  }

  const timestamp =
    normalizeTimestamp(game.completedAt) ||
    normalizeTimestamp(game.createdAt) ||
    Date.now();

  const mode =
    makeSafeDocumentId(
      game.mode || "practice"
    ) || "practice";

  const random = Math.random()
    .toString(36)
    .slice(2, 9);

  return `${timestamp}_${mode}_${random}`;
}


function getLocalDateId(date = new Date()) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function calculateAccuracy({
  attempts = 0,
  correct = 0
} = {}) {
  const total = toNumber(attempts);
  const good = toNumber(correct);

  if (total <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (good / total) * 100
      )
    )
  );
}


function calculateGameAccuracy(game = {}) {
  if (
    game.accuracy !== undefined &&
    game.accuracy !== null
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          toNumber(game.accuracy)
        )
      )
    );
  }

  const total =
    toNumber(game.totalQuestions) ||
    (
      toNumber(game.correct) +
      toNumber(game.wrong) +
      toNumber(game.timeout)
    );

  if (total <= 0) {
    return 0;
  }

  return Math.round(
    (
      toNumber(game.correct) /
      total
    ) * 100
  );
}


/* =========================================================
   FIRESTORE REFERENCES
========================================================= */

function userRef(uid) {
  return doc(
    db,
    "users",
    requireUid(uid)
  );
}


function wordStatsCollection(uid) {
  return collection(
    db,
    "users",
    requireUid(uid),
    CLOUD_COLLECTIONS.WORD_STATS
  );
}


function wordStatRef(uid, wordId) {
  const safeWordId =
    makeSafeDocumentId(wordId);

  if (!safeWordId) {
    throw new Error(
      "wordId is required."
    );
  }

  return doc(
    db,
    "users",
    requireUid(uid),
    CLOUD_COLLECTIONS.WORD_STATS,
    safeWordId
  );
}


function historyCollection(uid) {
  return collection(
    db,
    "users",
    requireUid(uid),
    CLOUD_COLLECTIONS.HISTORY
  );
}


function historyRef(uid, historyId) {
  const safeHistoryId =
    makeSafeDocumentId(historyId);

  if (!safeHistoryId) {
    throw new Error(
      "historyId is required."
    );
  }

  return doc(
    db,
    "users",
    requireUid(uid),
    CLOUD_COLLECTIONS.HISTORY,
    safeHistoryId
  );
}


function dailyStatsCollection(uid) {
  return collection(
    db,
    "users",
    requireUid(uid),
    CLOUD_COLLECTIONS.DAILY_STATS
  );
}


function dailyStatRef(uid, dateId) {
  const safeDateId =
    makeSafeDocumentId(dateId);

  if (!safeDateId) {
    throw new Error(
      "dateId is required."
    );
  }

  return doc(
    db,
    "users",
    requireUid(uid),
    CLOUD_COLLECTIONS.DAILY_STATS,
    safeDateId
  );
}


/* =========================================================
   WORD STATS — READ
========================================================= */

export async function getWordStatsCloud(uid) {
  const snapshot =
    await getDocs(
      wordStatsCollection(uid)
    );

  const result = {};

  snapshot.forEach((item) => {
    result[item.id] = {
      id: item.id,
      ...item.data()
    };
  });

  return result;
}


export async function getWordStatCloud(
  uid,
  wordId
) {
  const snapshot =
    await getDoc(
      wordStatRef(uid, wordId)
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}


/* =========================================================
   WORD STATS — WRITE
========================================================= */

export async function saveWordStatCloud(
  uid,
  wordId,
  stat = {}
) {
  const normalizedUid =
    requireUid(uid);

  const safeId =
    makeSafeDocumentId(
      wordId ||
      stat.id ||
      stat.word
    );

  if (!safeId) {
    throw new Error(
      "Cannot save Word Stat without wordId."
    );
  }

  const attempts =
    toNumber(stat.attempts);

  const correct =
    toNumber(stat.correct);

  const data =
    sanitizeForFirestore({
      ...stat,

      id: safeId,

      attempts,

      correct,

      wrong:
        toNumber(stat.wrong),

      timeout:
        toNumber(stat.timeout),

      accuracy:
        stat.accuracy !== undefined
          ? toNumber(stat.accuracy)
          : calculateAccuracy({
              attempts,
              correct
            }),

      uid: normalizedUid,

      schemaVersion:
        LEARNING_SCHEMA_VERSION,

      updatedAt:
        serverTimestamp()
    });

  await setDoc(
    wordStatRef(
      normalizedUid,
      safeId
    ),
    data,
    {
      merge: true
    }
  );

  return {
    id: safeId,
    ...stat
  };
}


/*
  ใช้ตอน Game Engine มี stat ล่าสุดทั้งก้อนแล้ว

  หมายเหตุ:
  Phase C จะเป็นคนเรียก function นี้
  หลังจาก LocalStorage คำนวณ stat เสร็จ
*/

export async function syncWordStatCloud(
  uid,
  wordId,
  stat
) {
  return saveWordStatCloud(
    uid,
    wordId,
    stat
  );
}


/* =========================================================
   WORD STATS — CLOUD-ONLY ATOMIC ATTEMPT
========================================================= */

export async function recordWordAttemptCloud({
  uid, word, mode, outcome, responseTimeMs = 0
} = {}) {
  const normalizedUid = requireUid(uid);
  const source = word && typeof word === "object" ? word : {};
  const safeId = makeSafeDocumentId(source.id || source.word);
  if (!safeId) throw new Error("Word ID is required.");
  if (!["translation", "meaning", "synonym", "weak"].includes(mode)) throw new Error("Invalid game mode.");
  if (!["correct", "wrong", "timeout"].includes(outcome)) throw new Error("Invalid attempt outcome.");

  const ref = wordStatRef(normalizedUid, safeId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists() ? snapshot.data() : {};
    const attempts = toNumber(previous.attempts) + 1;
    const correct = toNumber(previous.correct) + (outcome === "correct" ? 1 : 0);
    const wrong = toNumber(previous.wrong) + (outcome === "wrong" ? 1 : 0);
    const timeout = toNumber(previous.timeout) + (outcome === "timeout" ? 1 : 0);
    const previousStreak =
      Math.max(
        0,
        toNumber(
          previous.consecutiveCorrect
        )
      );

    const consecutiveCorrect =
      outcome === "correct"
        ? previousStreak + 1
        : 0;

    const intervalDays =
      outcome !== "correct"
        ? 1
        : consecutiveCorrect <= 1
          ? 1
          : consecutiveCorrect === 2
            ? 3
            : consecutiveCorrect === 3
              ? 7
              : consecutiveCorrect === 4
                ? 14
                : 30;

    const reviewedAt =
      new Date();

    const nextReview =
      new Date(
        reviewedAt.getTime() +
        intervalDays *
        24 *
        60 *
        60 *
        1000
      );

    const modeKey = mode.charAt(0).toUpperCase() + mode.slice(1);
    const data = sanitizeForFirestore({
      ...previous, id: safeId, uid: normalizedUid,
      word: source.word || previous.word || "", thai: source.thai || previous.thai || "",
      meaning: source.meaning || previous.meaning || "", exampleSentence: source.exampleSentence || previous.exampleSentence || "",
      level: source.level || previous.level || "", attempts, correct, wrong, timeout,
      totalResponseTime: toNumber(previous.totalResponseTime) + Math.max(0, toNumber(responseTimeMs)),
      [mode + "Attempts"]: toNumber(previous[mode + "Attempts"]) + 1,
      [mode + (outcome === "correct" ? "Correct" : outcome === "wrong" ? "Wrong" : "Timeout")]:
        toNumber(previous[mode + (outcome === "correct" ? "Correct" : outcome === "wrong" ? "Wrong" : "Timeout")]) + 1,
      lastResult: outcome,
      lastMode: mode,
      lastPlayedAt:
        reviewedAt.toISOString(),
      lastReviewedAt:
        reviewedAt.toISOString(),
      nextReviewAt:
        nextReview.toISOString(),
      intervalDays,
      consecutiveCorrect,
      accuracy: calculateAccuracy({ attempts, correct }),
      schemaVersion: LEARNING_SCHEMA_VERSION,
      updatedAt: serverTimestamp()
    });
    transaction.set(ref, data, { merge: true });
    return data;
  });
}

export async function getWeakWordIdsCloud(uid, { minAttempts = 1, maxAccuracy = 70 } = {}) {
  const stats = await getWordStatsCloud(uid);
  return Object.entries(stats).filter(([id, stat]) => {
    if (stat?.kind === "grammar") {
      return false;
    }

    const attempts = toNumber(stat?.attempts);
    const correct = toNumber(stat?.correct);

    return (
      id &&
      attempts >= minAttempts &&
      calculateAccuracy({
        attempts,
        correct
      }) <= maxAccuracy
    );
  }).map(([id]) => id);
}

/* =========================================================
   WORD STATS — BULK
========================================================= */

export async function saveWordStatsCloud(
  uid,
  stats = {}
) {
  const normalizedUid =
    requireUid(uid);

  if (!isPlainObject(stats)) {
    throw new Error(
      "Word Stats must be an object."
    );
  }

  const entries =
    Object.entries(stats);

  if (!entries.length) {
    return {
      saved: 0
    };
  }

  /*
    Firestore batch มีข้อจำกัดจำนวน operations
    จึงแบ่งเป็นชุดเล็ก
  */

  const CHUNK_SIZE = 400;

  let saved = 0;

  for (
    let start = 0;
    start < entries.length;
    start += CHUNK_SIZE
  ) {
    const chunk =
      entries.slice(
        start,
        start + CHUNK_SIZE
      );

    const batch =
      writeBatch(db);

    chunk.forEach(
      ([wordId, stat]) => {
        const safeId =
          makeSafeDocumentId(
            wordId ||
            stat?.id ||
            stat?.word
          );

        if (!safeId) {
          return;
        }

        const attempts =
          toNumber(stat?.attempts);

        const correct =
          toNumber(stat?.correct);

        const data =
          sanitizeForFirestore({
            ...stat,

            id: safeId,

            uid: normalizedUid,

            attempts,

            correct,

            wrong:
              toNumber(stat?.wrong),

            timeout:
              toNumber(stat?.timeout),

            accuracy:
              stat?.accuracy !== undefined
                ? toNumber(stat.accuracy)
                : calculateAccuracy({
                    attempts,
                    correct
                  }),

            schemaVersion:
              LEARNING_SCHEMA_VERSION,

            updatedAt:
              serverTimestamp()
          });

        batch.set(
          wordStatRef(
            normalizedUid,
            safeId
          ),
          data,
          {
            merge: true
          }
        );

        saved += 1;
      }
    );

    await batch.commit();
  }

  return {
    saved
  };
}


/* =========================================================
   WORD STATS — DELETE
========================================================= */

export async function deleteWordStatCloud(
  uid,
  wordId
) {
  await deleteDoc(
    wordStatRef(uid, wordId)
  );
}


/* =========================================================
   GAME HISTORY — READ
========================================================= */

export async function getGameHistoryCloud(
  uid,
  {
    maxItems = 500
  } = {}
) {
  const normalizedLimit =
    Math.max(
      1,
      Math.min(
        500,
        toNumber(maxItems) || 500
      )
    );

  try {
    /*
      ถ้า completedAt เป็น Timestamp/String/Number
      Firestore สามารถ orderBy field ได้
      แต่เอกสารเก่าที่ไม่มี field จะไม่อยู่ในผล query
      จึงมี fallback ด้านล่าง
    */

    const historyQuery =
      query(
        historyCollection(uid),
        orderBy(
          "completedAt",
          "desc"
        ),
        limit(normalizedLimit)
      );

    const snapshot =
      await getDocs(historyQuery);

    return snapshot.docs.map(
      (item) => ({
        id: item.id,
        ...item.data()
      })
    );

  } catch (error) {

    console.warn(
      "Ordered history query failed. Using fallback.",
      error
    );

    const snapshot =
      await getDocs(
        historyCollection(uid)
      );

    return snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data()
      }))
      .sort(
        (a, b) =>
          normalizeTimestamp(
            b.completedAt ||
            b.createdAt
          ) -
          normalizeTimestamp(
            a.completedAt ||
            a.createdAt
          )
      )
      .slice(
        0,
        normalizedLimit
      );
  }
}


/* =========================================================
   GAME HISTORY — WRITE
========================================================= */

export async function saveGameHistoryCloud(
  uid,
  game = {}
) {
  const normalizedUid =
    requireUid(uid);

  if (!isPlainObject(game)) {
    throw new Error(
      "Game History must be an object."
    );
  }

  const id =
    createHistoryId(game);

  const totalQuestions =
    toNumber(game.totalQuestions) ||
    (
      toNumber(game.correct) +
      toNumber(game.wrong) +
      toNumber(game.timeout)
    );

  const completedAt =
    game.completedAt ||
    new Date().toISOString();

  const data =
    sanitizeForFirestore({
      ...game,

      id,

      uid: normalizedUid,

      totalQuestions,

      correct:
        toNumber(game.correct),

      wrong:
        toNumber(game.wrong),

      timeout:
        toNumber(game.timeout),

      score:
        toNumber(game.score),

      accuracy:
        calculateGameAccuracy({
          ...game,
          totalQuestions
        }),

      completedAt,

      schemaVersion:
        LEARNING_SCHEMA_VERSION,

      syncedAt:
        serverTimestamp()
    });

  await setDoc(
    historyRef(
      normalizedUid,
      id
    ),
    data
  );

  return {
    id,
    ...game,
    completedAt
  };
}


/* =========================================================
   GAME HISTORY — BULK
========================================================= */

export async function saveGameHistoryBulkCloud(
  uid,
  history = []
) {
  const normalizedUid =
    requireUid(uid);

  if (!Array.isArray(history)) {
    throw new Error(
      "Game History must be an array."
    );
  }

  if (!history.length) {
    return {
      saved: 0
    };
  }

  const CHUNK_SIZE = 400;

  let saved = 0;

  for (
    let start = 0;
    start < history.length;
    start += CHUNK_SIZE
  ) {
    const chunk =
      history.slice(
        start,
        start + CHUNK_SIZE
      );

    const batch =
      writeBatch(db);

    chunk.forEach((game) => {
      if (!isPlainObject(game)) {
        return;
      }

      const id =
        createHistoryId(game);

      const totalQuestions =
        toNumber(game.totalQuestions) ||
        (
          toNumber(game.correct) +
          toNumber(game.wrong) +
          toNumber(game.timeout)
        );

      const completedAt =
        game.completedAt ||
        game.createdAt ||
        game.date ||
        new Date().toISOString();

      const data =
        sanitizeForFirestore({
          ...game,

          id,

          uid: normalizedUid,

          totalQuestions,

          correct:
            toNumber(game.correct),

          wrong:
            toNumber(game.wrong),

          timeout:
            toNumber(game.timeout),

          score:
            toNumber(game.score),

          accuracy:
            calculateGameAccuracy({
              ...game,
              totalQuestions
            }),

          completedAt,

          schemaVersion:
            LEARNING_SCHEMA_VERSION,

          syncedAt:
            serverTimestamp()
        });

      batch.set(
        historyRef(
          normalizedUid,
          id
        ),
        data,
        {
          merge: true
        }
      );

      saved += 1;
    });

    await batch.commit();
  }

  return {
    saved
  };
}


/* =========================================================
   GAME HISTORY — DELETE
========================================================= */

export async function deleteGameHistoryCloud(
  uid,
  historyId
) {
  await deleteDoc(
    historyRef(
      uid,
      historyId
    )
  );
}


/* =========================================================
   DAILY STATS — GAME AGGREGATE
========================================================= */

export async function recordDailyGameCloud(uid, game = {}) {
  const normalizedUid = requireUid(uid);
  const dateId = getLocalDateId();
  const ref = dailyStatRef(normalizedUid, dateId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists() ? snapshot.data() : {};
    const games = toNumber(previous.games) + 1;
    const questions = toNumber(previous.questions) + toNumber(game.totalQuestions);
    const correct = toNumber(previous.correct) + toNumber(game.correct);
    const wrong = toNumber(previous.wrong) + toNumber(game.wrong);
    const timeout = toNumber(previous.timeout) + toNumber(game.timeout);
    const data = { ...previous, id: dateId, uid: normalizedUid, games, questions, correct, wrong, timeout,
      score: toNumber(previous.score) + toNumber(game.score),
      accuracy: questions > 0 ? Math.round((correct / questions) * 100) : 0,
      schemaVersion: LEARNING_SCHEMA_VERSION, updatedAt: serverTimestamp() };
    transaction.set(ref, sanitizeForFirestore(data), { merge: true });
    return data;
  });
}

/* =========================================================
   DAILY STATS
========================================================= */

export async function getDailyStatsCloud(
  uid
) {
  const snapshot =
    await getDocs(
      dailyStatsCollection(uid)
    );

  const result = {};

  snapshot.forEach((item) => {
    result[item.id] = {
      id: item.id,
      ...item.data()
    };
  });

  return result;
}


export async function getDailyStatCloud(
  uid,
  dateId = getLocalDateId()
) {
  const snapshot =
    await getDoc(
      dailyStatRef(
        uid,
        dateId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}


export async function saveDailyStatCloud(
  uid,
  dateId,
  data = {}
) {
  const id =
    dateId ||
    getLocalDateId();

  await setDoc(
    dailyStatRef(
      uid,
      id
    ),
    sanitizeForFirestore({
      ...data,

      id,

      uid:
        requireUid(uid),

      schemaVersion:
        LEARNING_SCHEMA_VERSION,

      updatedAt:
        serverTimestamp()
    }),
    {
      merge: true
    }
  );
}


/* =========================================================
   MIGRATION STATUS
========================================================= */

export async function getLearningMigrationStatus(
  uid
) {
  const snapshot =
    await getDoc(
      userRef(uid)
    );

  if (!snapshot.exists()) {
    return {
      migrated: false,
      version: 0
    };
  }

  const data =
    snapshot.data();

  const version =
    toNumber(
      data.learningSchemaVersion
    );

  return {
    migrated:
      version >=
      LEARNING_SCHEMA_VERSION,

    version,

    migratedAt:
      data.learningMigratedAt ||
      null
  };
}


export async function markLearningMigrationComplete(
  uid
) {
  await updateDoc(
    userRef(uid),
    {
      learningSchemaVersion:
        LEARNING_SCHEMA_VERSION,

      learningMigratedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    }
  );
}


/* =========================================================
   MIGRATION
========================================================= */

/*
  ใช้ migrate ข้อมูล LocalStorage เก่า
  ขึ้น Firestore เพียงครั้งเดียว

  Phase C/D จะเป็นคนส่งข้อมูล local เข้ามา

  ตัว function นี้ไม่ค้น LocalStorage เอง
  เพื่อป้องกันการหยิบข้อมูลของ User คนอื่น
  จาก browser เดียวกันโดยไม่ตั้งใจ
*/

export async function migrateLearningDataToCloud(
  uid,
  {
    wordStats = {},
    history = []
  } = {}
) {
  const normalizedUid =
    requireUid(uid);

  const migration =
    await getLearningMigrationStatus(
      normalizedUid
    );

  if (migration.migrated) {
    return {
      skipped: true,
      reason:
        "already-migrated",
      wordStatsSaved: 0,
      historySaved: 0
    };
  }

  /*
    Protect existing Cloud data.

    If this account already has learning data in Firestore,
    do not overwrite it with an older LocalStorage snapshot.
    This matters when the same account is opened on another
    browser/device before the migration flag was written.
  */
  const [
    remoteWordStats,
    remoteHistory
  ] = await Promise.all([
    getWordStatsCloud(
      normalizedUid
    ),
    getGameHistoryCloud(
      normalizedUid
    )
  ]);

  const hasRemoteWordStats =
    Object.keys(
      remoteWordStats || {}
    ).length > 0;

  const hasRemoteHistory =
    Array.isArray(remoteHistory) &&
    remoteHistory.length > 0;

  let wordStatsSaved = 0;
  let historySaved = 0;

  if (
    !hasRemoteWordStats &&
    isPlainObject(wordStats) &&
    Object.keys(wordStats).length
  ) {
    const result =
      await saveWordStatsCloud(
        normalizedUid,
        wordStats
      );

    wordStatsSaved =
      result.saved;
  }

  if (
    !hasRemoteHistory &&
    Array.isArray(history) &&
    history.length
  ) {
    const result =
      await saveGameHistoryBulkCloud(
        normalizedUid,
        history
      );

    historySaved =
      result.saved;
  }

  /*
    Mark complete only after every required read/write above
    succeeds. If Firestore throws, this line is not reached,
    so a later session can safely retry migration.
  */
  await markLearningMigrationComplete(
    normalizedUid
  );

  return {
    skipped: false,
    reason:
      hasRemoteWordStats ||
      hasRemoteHistory
        ? "remote-data-preserved"
        : "local-data-migrated",
    wordStatsSaved,
    historySaved,
    remoteWordStatsPreserved:
      hasRemoteWordStats,
    remoteHistoryPreserved:
      hasRemoteHistory
  };
}


/* =========================================================
   DELETE ALL USER LEARNING DATA
========================================================= */

/*
  ใช้ใน Admin Data Management
  หรือ Reset Progress ในอนาคต

  Firestore Web SDK ไม่มี recursive delete
  จึงลบทีละ subcollection เป็น batch
*/

async function deleteCollectionDocuments(
  collectionRef
) {
  const snapshot =
    await getDocs(collectionRef);

  if (snapshot.empty) {
    return 0;
  }

  const docs =
    snapshot.docs;

  const CHUNK_SIZE = 400;

  let deleted = 0;

  for (
    let start = 0;
    start < docs.length;
    start += CHUNK_SIZE
  ) {
    const batch =
      writeBatch(db);

    const chunk =
      docs.slice(
        start,
        start + CHUNK_SIZE
      );

    chunk.forEach((item) => {
      batch.delete(item.ref);
      deleted += 1;
    });

    await batch.commit();
  }

  return deleted;
}


export async function clearUserLearningCloud(
  uid
) {
  const normalizedUid =
    requireUid(uid);

  const wordStatsDeleted =
    await deleteCollectionDocuments(
      wordStatsCollection(
        normalizedUid
      )
    );

  const historyDeleted =
    await deleteCollectionDocuments(
      historyCollection(
        normalizedUid
      )
    );

  const dailyStatsDeleted =
    await deleteCollectionDocuments(
      dailyStatsCollection(
        normalizedUid
      )
    );

  return {
    wordStatsDeleted,
    historyDeleted,
    dailyStatsDeleted,

    totalDeleted:
      wordStatsDeleted +
      historyDeleted +
      dailyStatsDeleted
  };
}


/* =========================================================
   CLOUD SNAPSHOT
========================================================= */

export async function getLearningCloudSnapshot(
  uid
) {
  const normalizedUid =
    requireUid(uid);

  const [
    wordStats,
    history
  ] = await Promise.all([
    getWordStatsCloud(
      normalizedUid
    ),

    getGameHistoryCloud(
      normalizedUid
    )
  ]);

  return {
    uid: normalizedUid,
    wordStats,
    history
  };
}