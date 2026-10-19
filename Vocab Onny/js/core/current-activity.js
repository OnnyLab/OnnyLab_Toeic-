import {
  db
} from "./firebase.js";

import {
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


export async function setCurrentActivity(
  uid,
  activity = {}
) {
  if (!uid) return;

  try {
    await updateDoc(
      doc(
        db,
        "users",
        uid
      ),
      {
        currentActivity: {
          ...activity,
          active: true
        },
        currentActivityAt:
          serverTimestamp(),
        lastActivityAt:
          serverTimestamp()
      }
    );
  } catch (error) {
    console.warn(
      "Current activity update failed:",
      error
    );
  }
}


export async function clearCurrentActivity(
  uid
) {
  if (!uid) return;

  try {
    await updateDoc(
      doc(
        db,
        "users",
        uid
      ),
      {
        currentActivity: null,
        currentActivityAt:
          serverTimestamp(),
        lastActivityAt:
          serverTimestamp()
      }
    );
  } catch (error) {
    console.warn(
      "Current activity clear failed:",
      error
    );
  }
}
