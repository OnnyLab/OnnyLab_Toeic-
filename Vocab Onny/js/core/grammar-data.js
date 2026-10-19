import { db } from "./firebase.js";

import {
  inferGrammarChapterId
} from "./grammar-curriculum.js";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\\/]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 160);
}

export async function getGrammarQuestions({
  mode = "",
  activeOnly = true
} = {}) {
  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "gameSettings"
        )
      );

    const managedRows =
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

    const normalizedMode =
      String(mode || "")
        .toLowerCase();

    let modeRows =
      normalizedMode
        ? managedRows.filter(function (item) {
            const itemMode =
              String(item.mode || "")
                .toLowerCase();

            if (
              normalizedMode === "part5"
              && itemMode === "tenses"
            ) {
              return true;
            }

            return (
              itemMode ===
              normalizedMode
            );
          })
        : [...managedRows];

    const representedChapters =
      new Set(
        modeRows.map(function (item) {
          return (
            item.chapterId ||
            inferGrammarChapterId(
              item.topic || ""
            )
          );
        })
      );

    if (activeOnly) {
      modeRows =
        modeRows.filter(function (item) {
          return item.active !== false;
        });
    }

    const fallbackRows =
      getFallbackGrammarQuestions(
        normalizedMode
      )
        .filter(function (item) {
          return (
            !representedChapters.has(
              item.chapterId
            )
          );
        });

    return [
      ...modeRows,
      ...fallbackRows
    ];

  } catch (error) {
    console.warn(
      "Grammar question cloud read failed. Using starter bank.",
      error
    );

    return getFallbackGrammarQuestions(
      mode
    );
  }
}

export async function getGrammarStatsCloud(uid) {
  if (!uid) return {};

  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "users",
          uid,
          "wordStats"
        )
      );

    const result = {};

    snapshot.forEach((item) => {
      const data =
        item.data();

      if (
        data?.kind !== "grammar"
      ) {
        return;
      }

      result[item.id] = {
        id: item.id,
        ...data
      };
    });

    return result;

  } catch (error) {
    console.warn(
      "Grammar stats read failed:",
      error
    );

    return {};
  }
}

export async function recordGrammarAttemptCloud(uid, {
  mode,
  chapterId = "",
  chapterTitle = "",
  topic,
  outcome,
  responseTimeMs = 0
} = {}) {
  if (!uid) {
    throw new Error("UID is required.");
  }

  const topicName =
    String(
      topic || mode || "grammar"
    ).trim();

  const topicId =
    safeId(
      String(mode || "grammar") +
      "-" +
      String(chapterId || "mixed") +
      "-" +
      topicName
    ) ||
    "grammar";
  const statRef = doc(
    db,
    "users",
    uid,
    "wordStats",
    topicId
  );

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(statRef);
    const previous = snapshot.exists()
      ? snapshot.data()
      : {};

    const correctDelta = outcome === "correct" ? 1 : 0;
    const wrongDelta = outcome === "wrong" ? 1 : 0;
    const timeoutDelta = outcome === "timeout" ? 1 : 0;

    const attempts = number(previous.attempts) + 1;
    const correct = number(previous.correct) + correctDelta;
    const wrong = number(previous.wrong) + wrongDelta;
    const timeout = number(previous.timeout) + timeoutDelta;
    const totalResponseTimeMs =
      number(previous.totalResponseTimeMs) +
      Math.max(0, number(responseTimeMs));
    const averageResponseMs =
      attempts > 0
        ? Math.round(totalResponseTimeMs / attempts)
        : 0;
    const accuracy = attempts > 0
      ? Math.round((correct / attempts) * 100)
      : 0;

    const data = {
      id: topicId,
      uid,
      kind: "grammar",
      topic: topicName,
      chapterId: String(chapterId || ""),
      chapterTitle: String(chapterTitle || ""),
      grammarMode:
        String(mode || ""),
      mode:
        String(mode || ""),
      attempts,
      correct,
      wrong,
      timeout,
      totalResponseTimeMs,
      averageResponseMs,
      accuracy,
      lastResult:
        outcome === "correct"
          ? "correct"
          : outcome === "timeout"
            ? "timeout"
            : "wrong",
      updatedAt:
        serverTimestamp()
    };

    transaction.set(statRef, data, { merge: true });

    return data;
  });
}

export async function getGrammarQuestionById(id) {
  if (!id) return null;

  const snapshot = await getDoc(
    doc(db, "gameSettings", id)
  );

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

const TOEIC_CHAPTER_STARTERS = Object.freeze([
  {
    chapterId: "word-forms",
    topic: "Word Forms",
    mc: {
      prompt: "The manager gave a ___ explanation of the new policy.",
      options: ["clear", "clearly", "clarity", "cleared"],
      correctAnswer: "clear",
      explanation: "ตำแหน่งหน้าคำนาม explanation ต้องใช้ adjective: clear."
    },
    error: {
      prompt: "Which part is incorrect? The assistant responded quick to the request.",
      options: ["The assistant", "responded", "quick", "to the request"],
      correctAnswer: "quick",
      explanation: "ขยายกริยา responded ต้องใช้ adverb: quickly."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["The", "new", "policy", "is", "highly", "effective."],
      correctAnswer: "The new policy is highly effective.",
      explanation: "Adverb highly ขยาย adjective effective."
    }
  },
  {
    chapterId: "nouns-quantifiers",
    topic: "Nouns & Quantifiers",
    mc: {
      prompt: "Only a few ___ remain available for the seminar.",
      options: ["seat", "seats", "seating", "seated"],
      correctAnswer: "seats",
      explanation: "a few ใช้กับคำนามนับได้พหูพจน์."
    },
    error: {
      prompt: "Which part is incorrect? There are much applicants for the position.",
      options: ["There are", "much", "applicants", "for the position"],
      correctAnswer: "much",
      explanation: "Applicants เป็นคำนามนับได้พหูพจน์ จึงใช้ many."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["Several", "employees", "attended", "the", "training."],
      correctAnswer: "Several employees attended the training.",
      explanation: "Several ตามด้วยคำนามพหูพจน์."
    }
  },
  {
    chapterId: "pronouns",
    topic: "Pronouns",
    mc: {
      prompt: "Please send the revised contract to Ms. Lee or ___.",
      options: ["I", "me", "my", "mine"],
      correctAnswer: "me",
      explanation: "หลัง preposition to ต้องใช้ object pronoun: me."
    },
    error: {
      prompt: "Which part is incorrect? The supervisor asked we to attend the meeting.",
      options: ["The supervisor", "asked", "we", "to attend"],
      correctAnswer: "we",
      explanation: "หลัง asked ต้องใช้ object pronoun: us."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["She", "prepared", "the", "presentation", "herself."],
      correctAnswer: "She prepared the presentation herself.",
      explanation: "Reflexive pronoun herself ใช้เน้นว่าทำด้วยตนเอง."
    }
  },
  {
    chapterId: "articles-determiners",
    topic: "Articles & Determiners",
    mc: {
      prompt: "Mr. Brown is ___ experienced engineer.",
      options: ["a", "an", "the", "no article"],
      correctAnswer: "an",
      explanation: "Experienced ขึ้นต้นด้วยเสียงสระ จึงใช้ an."
    },
    error: {
      prompt: "Which part is incorrect? We hired an new consultant last week.",
      options: ["We", "hired", "an", "new consultant"],
      correctAnswer: "an",
      explanation: "New ขึ้นต้นด้วยเสียงพยัญชนะ จึงใช้ a."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["The", "company", "opened", "a", "new", "branch."],
      correctAnswer: "The company opened a new branch.",
      explanation: "ใช้ a กับคำนามเอกพจน์ที่กล่าวถึงครั้งแรก."
    }
  },
  {
    chapterId: "subject-verb",
    topic: "Subject–Verb Agreement",
    mc: {
      prompt: "Each of the employees ___ a security badge.",
      options: ["have", "has", "having", "are having"],
      correctAnswer: "has",
      explanation: "Each เป็นเอกพจน์ จึงใช้ has."
    },
    error: {
      prompt: "Which part is incorrect? The list of participants are on the desk.",
      options: ["The list", "of participants", "are", "on the desk"],
      correctAnswer: "are",
      explanation: "ประธานหลักคือ The list จึงใช้ is."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["Every", "department", "has", "a", "monthly", "meeting."],
      correctAnswer: "Every department has a monthly meeting.",
      explanation: "Every + singular noun ใช้กริยาเอกพจน์."
    }
  },
  {
    chapterId: "tenses",
    topic: "Verb Tenses",
    mc: {
      prompt: "The company ___ its annual report yesterday.",
      options: ["releases", "released", "has released", "will release"],
      correctAnswer: "released",
      explanation: "Yesterday เป็นสัญญาณของ Past Simple."
    },
    error: {
      prompt: "Which part is incorrect? She has sent the invoice yesterday.",
      options: ["She", "has sent", "the invoice", "yesterday"],
      correctAnswer: "has sent",
      explanation: "มีเวลาจบในอดีตชัดเจน จึงใช้ sent."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["They", "have", "already", "completed", "the", "project."],
      correctAnswer: "They have already completed the project.",
      explanation: "Present Perfect ใช้กับผลที่เกี่ยวข้องกับปัจจุบัน."
    }
  },
  {
    chapterId: "passive",
    topic: "Passive Voice",
    mc: {
      prompt: "The documents ___ by the legal team before noon.",
      options: ["reviewed", "were reviewed", "reviewing", "have review"],
      correctAnswer: "were reviewed",
      explanation: "ประธาน documents เป็นผู้ถูกกระทำ จึงใช้ Passive Voice."
    },
    error: {
      prompt: "Which part is incorrect? The package delivered by courier this morning.",
      options: ["The package", "delivered", "by courier", "this morning"],
      correctAnswer: "delivered",
      explanation: "ต้องมี be verb: was delivered."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["The", "meeting", "was", "postponed", "until", "Friday."],
      correctAnswer: "The meeting was postponed until Friday.",
      explanation: "Passive = be + past participle."
    }
  },
  {
    chapterId: "modals",
    topic: "Modals & Auxiliaries",
    mc: {
      prompt: "Employees ___ wear identification badges at all times.",
      options: ["must", "must to", "must be", "musting"],
      correctAnswer: "must",
      explanation: "Modal verb ตามด้วย base verb โดยไม่ใช้ to."
    },
    error: {
      prompt: "Which part is incorrect? You should to submit the form today.",
      options: ["You", "should", "to submit", "the form today"],
      correctAnswer: "to submit",
      explanation: "หลัง should ใช้ base verb: submit."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["We", "should", "confirm", "the", "reservation", "today."],
      correctAnswer: "We should confirm the reservation today.",
      explanation: "Modal + base verb."
    }
  },
  {
    chapterId: "gerunds-infinitives",
    topic: "Gerunds & Infinitives",
    mc: {
      prompt: "The manager agreed ___ the proposal again.",
      options: ["review", "reviewing", "to review", "reviewed"],
      correctAnswer: "to review",
      explanation: "agree ตามด้วย to-infinitive."
    },
    error: {
      prompt: "Which part is incorrect? She enjoys to work with international clients.",
      options: ["She", "enjoys", "to work", "with international clients"],
      correctAnswer: "to work",
      explanation: "enjoy ตามด้วย gerund: working."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["They", "decided", "to", "extend", "the", "deadline."],
      correctAnswer: "They decided to extend the deadline.",
      explanation: "decide ตามด้วย to-infinitive."
    }
  },
  {
    chapterId: "participles",
    topic: "Participles",
    mc: {
      prompt: "Customers were ___ with the improved service.",
      options: ["satisfy", "satisfying", "satisfied", "satisfaction"],
      correctAnswer: "satisfied",
      explanation: "ความรู้สึกของคนใช้ -ed adjective: satisfied."
    },
    error: {
      prompt: "Which part is incorrect? The bored presentation lasted two hours.",
      options: ["The", "bored", "presentation", "lasted two hours"],
      correctAnswer: "bored",
      explanation: "สิ่งที่ทำให้รู้สึกเบื่อใช้ boring."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["The", "updated", "schedule", "was", "sent", "yesterday."],
      correctAnswer: "The updated schedule was sent yesterday.",
      explanation: "Past participle updated ใช้ขยาย schedule."
    }
  },
  {
    chapterId: "adj-adv-comparison",
    topic: "Adjectives, Adverbs & Comparisons",
    mc: {
      prompt: "This model operates more ___ than the previous one.",
      options: ["efficient", "efficiently", "efficiency", "most efficient"],
      correctAnswer: "efficiently",
      explanation: "ขยายกริยา operates ต้องใช้ adverb."
    },
    error: {
      prompt: "Which part is incorrect? Sales increased significant last quarter.",
      options: ["Sales", "increased", "significant", "last quarter"],
      correctAnswer: "significant",
      explanation: "ขยาย increased ต้องใช้ significantly."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["This", "system", "is", "more", "reliable", "than", "the", "old", "one."],
      correctAnswer: "This system is more reliable than the old one.",
      explanation: "Comparison ใช้ more + adjective + than."
    }
  },
  {
    chapterId: "prepositions",
    topic: "Prepositions",
    mc: {
      prompt: "The conference will begin ___ 9 a.m.",
      options: ["in", "on", "at", "by"],
      correctAnswer: "at",
      explanation: "ใช้ at กับเวลาที่เฉพาะเจาะจง."
    },
    error: {
      prompt: "Which part is incorrect? The office is closed in Monday.",
      options: ["The office", "is closed", "in", "Monday"],
      correctAnswer: "in",
      explanation: "ใช้ on กับวัน: on Monday."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["The", "meeting", "is", "scheduled", "for", "Monday", "morning."],
      correctAnswer: "The meeting is scheduled for Monday morning.",
      explanation: "scheduled for ใช้บอกเวลาที่กำหนดไว้."
    }
  },
  {
    chapterId: "conjunctions",
    topic: "Conjunctions & Connectors",
    mc: {
      prompt: "___ the weather was poor, the event continued as planned.",
      options: ["Although", "Because of", "Despite of", "Therefore"],
      correctAnswer: "Although",
      explanation: "Although ตามด้วย clause และแสดงความขัดแย้ง."
    },
    error: {
      prompt: "Which part is incorrect? Because the delay, the meeting started late.",
      options: ["Because", "the delay", "the meeting", "started late"],
      correctAnswer: "Because",
      explanation: "หน้าคำนามใช้ because of."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["Although", "sales", "fell,", "profits", "remained", "stable."],
      correctAnswer: "Although sales fell, profits remained stable.",
      explanation: "Although เชื่อมสอง clause ที่มีความหมายขัดแย้ง."
    }
  },
  {
    chapterId: "relative-clauses",
    topic: "Relative Clauses",
    mc: {
      prompt: "The consultant ___ prepared the report will join the meeting.",
      options: ["who", "which", "where", "whose"],
      correctAnswer: "who",
      explanation: "ใช้ who แทนบุคคลและทำหน้าที่เป็นประธานใน relative clause."
    },
    error: {
      prompt: "Which part is incorrect? The office who is on the fifth floor is being renovated.",
      options: ["The office", "who", "is on the fifth floor", "is being renovated"],
      correctAnswer: "who",
      explanation: "สิ่งของใช้ which หรือ that."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["The", "employee", "who", "won", "the", "award", "works", "here."],
      correctAnswer: "The employee who won the award works here.",
      explanation: "who won the award เป็น relative clause ขยาย employee."
    }
  },
  {
    chapterId: "conditionals",
    topic: "Conditionals",
    mc: {
      prompt: "If you submit the form today, we ___ it tomorrow.",
      options: ["process", "processed", "will process", "would processed"],
      correctAnswer: "will process",
      explanation: "First conditional: if + present, will + base verb."
    },
    error: {
      prompt: "Which part is incorrect? If the shipment arrives today, we would notify you.",
      options: ["If", "arrives", "would notify", "you"],
      correctAnswer: "would notify",
      explanation: "First conditional ใช้ will notify."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["If", "you", "need", "help,", "please", "contact", "us."],
      correctAnswer: "If you need help, please contact us.",
      explanation: "If-clause สามารถใช้กับ imperative ใน main clause."
    }
  },
  {
    chapterId: "sentence-clauses",
    topic: "Sentence Structure & Clauses",
    mc: {
      prompt: "Please let us know ___ you will attend the workshop.",
      options: ["whether", "because", "despite", "during"],
      correctAnswer: "whether",
      explanation: "whether ใช้นำ noun clause เมื่อต้องการสื่อความหมายว่า 'หรือไม่'."
    },
    error: {
      prompt: "Which part is incorrect? Could you tell me where is the station?",
      options: ["Could you", "tell me", "where is", "the station"],
      correctAnswer: "where is",
      explanation: "Embedded question ใช้ statement order: where the station is."
    },
    sentence: {
      prompt: "Build the correct sentence.",
      options: ["Please", "tell", "me", "when", "the", "meeting", "will", "begin."],
      correctAnswer: "Please tell me when the meeting will begin.",
      explanation: "Embedded question ใช้ subject + verb order."
    }
  }
]);

function expandStarterQuestions() {
  const rows = [];

  TOEIC_CHAPTER_STARTERS.forEach(function (chapter, chapterIndex) {
    const base = {
      chapterId: chapter.chapterId,
      topic: chapter.topic,
      level: chapterIndex < 6 ? "Beginner" : chapterIndex < 12 ? "Intermediate" : "Advanced",
      active: true
    };

    rows.push({
      ...base,
      id: "starter-part5-" + chapter.chapterId,
      mode: "part5",
      ...chapter.mc
    });

    rows.push({
      ...base,
      id: "starter-fill-" + chapter.chapterId,
      mode: "fill",
      ...chapter.mc
    });

    rows.push({
      ...base,
      id: "starter-error-" + chapter.chapterId,
      mode: "error",
      ...chapter.error
    });

    rows.push({
      ...base,
      id: "starter-sentence-" + chapter.chapterId,
      mode: "sentence",
      ...chapter.sentence
    });
  });

  return rows;
}

const FALLBACK_GRAMMAR_QUESTIONS = Object.freeze(
  expandStarterQuestions()
);

function getFallbackGrammarQuestions(mode = "") {
  const normalizedMode =
    String(mode || "").toLowerCase();

  return FALLBACK_GRAMMAR_QUESTIONS
    .filter(function (item) {
      return (
        !normalizedMode ||
        item.mode === normalizedMode
      );
    })
    .map(function (item) {
      return {
        ...item,
        options: [...item.options]
      };
    });
}
