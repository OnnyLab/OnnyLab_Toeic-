import "./presence.js";

import {
  auth
} from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getOrCreateUserProfile,
  getUserProfile,
  getProfileDisplayName
} from "./user-service.js";


/* =========================================================
   HELPERS
========================================================= */

function getEmailName(email) {
  if (!email) return "User";

  const name = email
    .split("@")[0]
    .trim();

  if (!name) return "User";

  return (
    name.charAt(0).toUpperCase()
    +
    name.slice(1)
  );
}


function getAuthErrorMessage(code) {
  switch (code) {

    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง";

    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดการใช้งาน";

    case "auth/too-many-requests":
      return "มีการเข้าสู่ระบบผิดหลายครั้ง กรุณารอสักครู่";

    case "auth/network-request-failed":
      return "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้";

    default:
      return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
  }
}


/* =========================================================
   LOGIN
========================================================= */

export async function loginWithEmail(
  email,
  password
) {

  try {

    const credential =
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );


    const user =
      credential.user;


    /*
      โหลด/สร้าง Firestore profile
    */

    const profile =
      await getOrCreateUserProfile(
        user
      );


    /*
      App-level Disabled User

      แม้ Firebase Authentication
      จะยังอนุญาต Email/Password
      แต่ตัว App จะไม่อนุญาตให้เข้าระบบ
    */

    if (
      profile?.status ===
      "disabled"
    ) {

      await signOut(
        auth
      );


      return {
        success: false,
        code: "app/user-disabled",
        message:
          "บัญชีนี้ถูกปิดการใช้งาน"
      };

    }


    return {
      success: true,
      user,
      profile
    };

  }

  catch (error) {

    console.error(
      "Login error:",
      error
    );


    return {
      success: false,
      code: error.code,
      message:
        getAuthErrorMessage(
          error.code
        )
    };

  }

}


/* =========================================================
   LOGOUT
========================================================= */

export async function logoutUser() {

  try {

    await signOut(
      auth
    );


    return {
      success: true
    };

  }

  catch (error) {

    console.error(
      "Logout error:",
      error
    );


    return {
      success: false,
      error
    };

  }

}


/* =========================================================
   WATCH AUTH
========================================================= */

export function watchAuth(
  callback
) {

  return onAuthStateChanged(
    auth,
    callback
  );

}


/* =========================================================
   WAIT FOR FIREBASE AUTH RESTORE

   สำคัญ:
   ใช้ onAuthStateChanged รอให้ Firebase
   Restore Login State ให้เสร็จก่อน
========================================================= */

export function waitForAuthUser(
  timeoutMs = 8000
) {

  return new Promise(
    function (
      resolve
    ) {

      let settled =
        false;


      let unsubscribe =
        null;


      const finish =
        function (
          user
        ) {

          if (
            settled
          ) {

            return;

          }


          settled =
            true;


          clearTimeout(
            timer
          );


          if (
            typeof unsubscribe ===
            "function"
          ) {

            unsubscribe();

          }


          resolve(
            user ||
            null
          );

        };


      const timer =
        setTimeout(
          function () {

            finish(
              auth.currentUser ||
              null
            );

          },
          timeoutMs
        );


      try {

        unsubscribe =
          onAuthStateChanged(

            auth,

            function (
              user
            ) {

              finish(
                user
              );

            },

            function (
              error
            ) {

              console.error(
                "Auth state error:",
                error
              );


              finish(
                null
              );

            }

          );

      }

      catch (error) {

        console.error(
          "waitForAuthUser error:",
          error
        );


        finish(
          auth.currentUser ||
          null
        );

      }

    }
  );

}


/* =========================================================
   CURRENT PROFILE
========================================================= */

export async function getCurrentUserProfile(
  user
) {

  if (
    !user
  ) {

    return null;

  }


  return await getOrCreateUserProfile(
    user
  );

}


/* =========================================================
   USER ACCESS
========================================================= */

export async function getUserAccess(
  user
) {

  if (
    !user
  ) {

    return {
      allowed: false,
      reason: "not-authenticated",
      role: null,
      profile: null
    };

  }


  try {

    const profile =
      await getOrCreateUserProfile(
        user
      );


    if (
      !profile
    ) {

      return {
        allowed: false,
        reason: "profile-missing",
        role: null,
        profile: null
      };

    }


    if (
      profile.status ===
      "disabled"
    ) {

      return {
        allowed: false,
        reason: "disabled",
        role:
          profile.role ||
          "user",
        profile
      };

    }


    const role =
      profile.role ||
      "user";


    return {
      allowed: true,
      reason: null,
      role,
      profile
    };

  }

  catch (error) {

    console.error(
      "Get user access error:",
      error
    );


    return {
      allowed: false,
      reason: "profile-error",
      role: null,
      profile: null,
      error
    };

  }

}


/* =========================================================
   GET ROLE
========================================================= */

export async function getUserRole(
  user
) {

  const access =
    await getUserAccess(
      user
    );


  if (
    !access.allowed
  ) {

    return null;

  }


  return access.role;

}


/* =========================================================
   DISPLAY NAME
========================================================= */

export async function getUserDisplayName(
  user
) {

  if (
    !user
  ) {

    return "User";

  }


  try {

    const profile =
      await getUserProfile(
        user.uid
      );


    return getProfileDisplayName(
      profile,
      user
    );

  }

  catch (error) {

    console.error(
      "Display name error:",
      error
    );


    if (
      user.displayName
    ) {

      return user.displayName;

    }


    return getEmailName(
      user.email
    );

  }

}


/* =========================================================
   USER PAGE GUARD

   ใช้กับ:
   Games
   Dashboard
   Weak Words
   History
   Profile
========================================================= */

export async function requireUserPage(
  {
    loginPath =
      "../index.html",

    adminPath =
      "../admin/index.html"
  } = {}
) {

  const user =
    await waitForAuthUser();


  /*
    ไม่มี Firebase User
  */

  if (
    !user
  ) {

    window.location.replace(
      loginPath
    );


    return null;

  }


  const access =
    await getUserAccess(
      user
    );


  /*
    ไม่มีสิทธิ์ / Disabled
  */

  if (
    !access.allowed
  ) {

    if (
      access.reason ===
      "disabled"
    ) {

      await logoutUser();

    }


    window.location.replace(
      loginPath
    );


    return null;

  }


  /*
    Admin เข้า User Page
  */

  if (
    access.role ===
    "admin"
  ) {

    window.location.replace(
      adminPath
    );


    return null;

  }


  /*
    Role ไม่ถูกต้อง
  */

  if (
    access.role !==
    "user"
  ) {

    await logoutUser();


    window.location.replace(
      loginPath
    );


    return null;

  }


  return {
    user,
    profile:
      access.profile,
    role:
      access.role
  };

}


/* =========================================================
   ADMIN PAGE GUARD
========================================================= */

export async function requireAdminPage(
  {
    loginPath =
      "../index.html",

    userPath =
      "../user/practice.html"
  } = {}
) {

  const user =
    await waitForAuthUser();


  if (
    !user
  ) {

    window.location.replace(
      loginPath
    );


    return null;

  }


  const access =
    await getUserAccess(
      user
    );


  if (
    !access.allowed
  ) {

    if (
      access.reason ===
      "disabled"
    ) {

      await logoutUser();

    }


    window.location.replace(
      loginPath
    );


    return null;

  }


  if (
    access.role !==
    "admin"
  ) {

    window.location.replace(
      userPath
    );


    return null;

  }


  return {
    user,
    profile:
      access.profile,
    role:
      access.role
  };

}


/* =========================================================
   REDIRECT BY ROLE
========================================================= */

export async function redirectByRole(
  user
) {

  if (
    !user
  ) {

    window.location.replace(
      "./index.html"
    );


    return;

  }


  const access =
    await getUserAccess(
      user
    );


  if (
    !access.allowed
  ) {

    if (
      access.reason ===
      "disabled"
    ) {

      await logoutUser();

    }


    window.location.replace(
      "./index.html"
    );


    return;

  }


  if (
    access.role ===
    "admin"
  ) {

    window.location.replace(
      "./admin/index.html"
    );


    return;

  }


  window.location.replace(
    "./user/practice.html"
  );

}