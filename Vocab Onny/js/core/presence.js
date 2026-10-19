/* =========================================================
   VOCAB ONNY
   PHASE F - USER PRESENCE
========================================================= */

import {
  auth,
  db
} from "./firebase.js";


import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   SETTINGS
========================================================= */

const HEARTBEAT_INTERVAL =
  60 * 1000;


/* =========================================================
   STATE
========================================================= */

let currentUserId = null;

let heartbeatTimer = null;

let initialized = false;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
  auth,

  async (user) => {

    const previousUserId =
      currentUserId;


    clearHeartbeat();


    /*
      Logout
    */

    if (!user) {

      if (previousUserId) {

        markOffline(
          previousUserId
        );

      }


      currentUserId =
        null;


      return;

    }


    currentUserId =
      user.uid;


    try {

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );


      const snapshot =
        await getDoc(
          userRef
        );


      if (!snapshot.exists()) {

        return;

      }


      const profile =
        snapshot.data();


      /*
        Disabled user
        ห้ามขึ้น Online
      */

      if (
        profile?.status ===
        "disabled"
      ) {

        await markOffline(
          user.uid
        );


        return;

      }


      /*
        Online ทันที
      */

      await markOnline(
        user.uid
      );


      startHeartbeat(
        user.uid
      );


      if (!initialized) {

        bindPresenceEvents();

        initialized =
          true;

      }


    } catch (error) {

      console.warn(
        "Presence initialization failed:",
        error
      );

    }

  }
);


/* =========================================================
   HEARTBEAT
========================================================= */

function startHeartbeat(
  uid
) {

  clearHeartbeat();


  heartbeatTimer =
    window.setInterval(
      () => {

        if (
          document.visibilityState !==
          "visible"
        ) {

          return;

        }


        if (!navigator.onLine) {

          return;

        }


        markOnline(
          uid
        );

      },

      HEARTBEAT_INTERVAL
    );

}


function clearHeartbeat() {

  if (!heartbeatTimer) {

    return;

  }


  window.clearInterval(
    heartbeatTimer
  );


  heartbeatTimer =
    null;

}


/* =========================================================
   ONLINE
========================================================= */

async function markOnline(
  uid
) {

  if (!uid) {

    return;

  }


  if (
    uid !== currentUserId
  ) {

    return;

  }


  try {

    await updateDoc(
      doc(
        db,
        "users",
        uid
      ),

      {

        isOnline:
          true,

        lastSeenAt:
          serverTimestamp(),

        lastActivityAt:
          serverTimestamp()

      }
    );


  } catch (error) {

    /*
      Presence ไม่ควรทำให้หน้าเว็บพัง
    */

    console.warn(
      "Presence online update failed:",
      error
    );

  }

}


/* =========================================================
   OFFLINE
========================================================= */

async function markOffline(
  uid
) {

  if (!uid) {

    return;

  }


  try {

    await updateDoc(
      doc(
        db,
        "users",
        uid
      ),

      {

        isOnline:
          false,

        lastSeenAt:
          serverTimestamp(),

        lastActivityAt:
          serverTimestamp()

      }
    );


  } catch (error) {

    /*
      ตอนปิด Tab browser อาจหยุด request
      ก่อน Firestore เขียนเสร็จได้
      จึงไม่ throw error ออกจาก Presence
    */

    console.warn(
      "Presence offline update failed:",
      error
    );

  }

}


/* =========================================================
   BROWSER EVENTS
========================================================= */

function bindPresenceEvents() {

  /*
    เปลี่ยน Tab
  */

  document.addEventListener(
    "visibilitychange",

    () => {

      if (!currentUserId) {

        return;

      }


      if (
        document.visibilityState ===
        "visible"
      ) {

        markOnline(
          currentUserId
        );


        startHeartbeat(
          currentUserId
        );


        return;

      }


      clearHeartbeat();


      markOffline(
        currentUserId
      );

    }
  );


  /*
    Internet กลับมา
  */

  window.addEventListener(
    "online",

    () => {

      if (!currentUserId) {

        return;

      }


      markOnline(
        currentUserId
      );


      startHeartbeat(
        currentUserId
      );

    }
  );


  /*
    Internet หลุด
  */

  window.addEventListener(
    "offline",

    () => {

      clearHeartbeat();

    }
  );


  /*
    ปิดหน้า / เปลี่ยนหน้า
  */

  window.addEventListener(
    "pagehide",

    () => {

      if (!currentUserId) {

        return;

      }


      clearHeartbeat();


      markOffline(
        currentUserId
      );

    }
  );


  /*
    กลับมาจาก Back/Forward Cache
  */

  window.addEventListener(
    "pageshow",

    () => {

      if (!currentUserId) {

        return;

      }


      if (!navigator.onLine) {

        return;

      }


      markOnline(
        currentUserId
      );


      startHeartbeat(
        currentUserId
      );

    }
  );

}


/* =========================================================
   EXPORT
========================================================= */

export {
  markOnline,
  markOffline
};