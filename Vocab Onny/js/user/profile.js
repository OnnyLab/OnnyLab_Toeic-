import {
  auth
} from "../core/firebase.js";


import {
  updateProfile
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


import {
  requireUserPage,
  logoutUser
} from "../core/auth.js";


import {
  updateUserProfile,
  getProfileDisplayName
} from "../core/user-service.js";


let currentUser =
  null;


let currentProfile =
  null;


document.addEventListener(
  "DOMContentLoaded",
  initProfile
);


/* =========================================================
   INIT
========================================================= */

async function initProfile() {

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


  await renderProfile();


  setupProfileForm();

  setupCopyUid();

  setupNavigation();

  setupLogout();

}


/* =========================================================
   RENDER PROFILE
========================================================= */

async function renderProfile() {

  if (
    !currentUser
  ) {

    return;

  }


  const name =
    getProfileDisplayName(
      currentProfile,
      currentUser
    );


  const email =
    currentUser.email ||
    "";


  const uid =
    currentUser.uid ||
    "";


  const initial =
    getInitial(
      name
    );


  setText(
    "sidebarPlayerName",
    name
  );


  setText(
    "sidebarUserEmail",
    email
  );


  setText(
    "heroDisplayName",
    name
  );


  setText(
    "heroEmail",
    email
  );


  [
    "sidebarAvatarInitial",
    "mobileAvatarInitial",
    "profileAvatarInitial",
    "avatarPreviewInitial"
  ].forEach(

    function (
      id
    ) {

      setText(
        id,
        initial
      );

    }

  );


  const displayNameInput =
    document.getElementById(
      "displayName"
    );


  const dailyGoalInput =
    document.getElementById(
      "dailyGoal"
    );

  if (dailyGoalInput) {
    dailyGoalInput.value =
      String(
        Math.max(
          10,
          Number(
            currentProfile?.dailyGoal
          ) || 10
        )
      );
  }


  const emailInput =
    document.getElementById(
      "email"
    );


  const uidInput =
    document.getElementById(
      "uid"
    );


  if (
    displayNameInput
  ) {

    displayNameInput.value =
      name;

  }


  if (
    emailInput
  ) {

    emailInput.value =
      email;

  }


  if (
    uidInput
  ) {

    uidInput.value =
      uid;

  }

}


/* =========================================================
   SAVE PROFILE
========================================================= */

function setupProfileForm() {

  const profileForm =
    document.getElementById(
      "profileForm"
    );


  const displayNameInput =
    document.getElementById(
      "displayName"
    );


  const profileMessage =
    document.getElementById(
      "profileMessage"
    );


  profileForm
    ?.addEventListener(

      "submit",

      async function (
        event
      ) {

        event.preventDefault();


        if (
          !currentUser ||
          !auth.currentUser
        ) {

          return;

        }


        clearMessage(
          profileMessage
        );


        const newName =

          displayNameInput
            ?.value
            .trim()

          ||

          "";

        const dailyGoal =
          Math.max(
            10,
            Math.min(
              50,
              Number(
                document
                  .getElementById(
                    "dailyGoal"
                  )
                  ?.value
              ) || 10
            )
          );


        if (
          !newName
        ) {

          showMessage(
            profileMessage,
            "กรุณากรอกชื่อ",
            "error"
          );


          return;

        }


        if (
          newName.length <
          2
        ) {

          showMessage(
            profileMessage,
            "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร",
            "error"
          );


          return;

        }


        if (
          newName.length >
          40
        ) {

          showMessage(
            profileMessage,
            "ชื่อต้องไม่เกิน 40 ตัวอักษร",
            "error"
          );


          return;

        }


        setSaveLoading(
          true
        );


        try {

          /*
            Firebase Auth
          */

          await updateProfile(

            auth.currentUser,

            {
              displayName:
                newName,
              dailyGoal
            }

          );


          /*
            Firestore Profile
          */

          await updateUserProfile(

            auth.currentUser.uid,

            {
              displayName:
                newName
            }

          );


          currentUser =
            auth.currentUser;


          currentProfile = {

            ...currentProfile,

            displayName:
              newName,

            dailyGoal

          };


          await renderProfile();


          showMessage(
            profileMessage,
            "บันทึกข้อมูลเรียบร้อยแล้ว ✓",
            "success"
          );

        }

        catch (
          error
        ) {

          console.error(
            "Save profile error:",
            error
          );


          showMessage(
            profileMessage,
            "บันทึกข้อมูลไม่สำเร็จ",
            "error"
          );

        }

        finally {

          setSaveLoading(
            false
          );

        }

      }

    );

}


/* =========================================================
   COPY UID
========================================================= */

function setupCopyUid() {

  const copyUidBtn =
    document.getElementById(
      "copyUidBtn"
    );


  copyUidBtn
    ?.addEventListener(

      "click",

      async function () {

        if (
          !currentUser
        ) {

          return;

        }


        try {

          await navigator
            .clipboard
            .writeText(
              currentUser.uid
            );


          const oldText =
            copyUidBtn.textContent;


          copyUidBtn.textContent =
            "Copied ✓";


          setTimeout(

            function () {

              copyUidBtn.textContent =
                oldText;

            },

            1200

          );

        }

        catch (
          error
        ) {

          console.error(
            "Copy UID error:",
            error
          );

        }

      }

    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

  const routes = {

    gamesBtn:
      "./practice.html",

    backToGamesBtn:
      "./practice.html",

    mobileBackBtn:
      "./practice.html",

    dashboardBtn:
      "./dashboard.html",

    weakWordsBtn:
      "./review.html",

    historyBtn:
      "./history.html"

  };


  Object.entries(
    routes
  )
    .forEach(

      function (
        [
          id,
          href
        ]
      ) {

        document
          .getElementById(
            id
          )
          ?.addEventListener(

            "click",

            function () {

              window.location.href =
                href;

            }

          );

      }

    );

}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

  const logoutBtn =
    document.getElementById(
      "logoutBtn"
    );


  logoutBtn
    ?.addEventListener(

      "click",

      async function () {

        logoutBtn.disabled =
          true;


        const result =
          await logoutUser();


        if (
          !result.success
        ) {

          logoutBtn.disabled =
            false;


          showMessage(

            document.getElementById(
              "profileMessage"
            ),

            "ออกจากระบบไม่สำเร็จ",

            "error"

          );


          return;

        }


        window.location.replace(
          "../index.html"
        );

      }

    );

}


/* =========================================================
   HELPERS
========================================================= */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (
    element
  ) {

    element.textContent =
      value;

  }

}


function getInitial(
  name
) {

  if (
    !name?.trim()
  ) {

    return "U";

  }


  return name
    .trim()
    .charAt(0)
    .toUpperCase();

}


function setSaveLoading(
  loading
) {

  const button =
    document.getElementById(
      "saveProfileBtn"
    );


  const text =
    document.getElementById(
      "saveProfileText"
    );


  if (
    button
  ) {

    button.disabled =
      loading;

  }


  if (
    text
  ) {

    text.textContent =

      loading

        ? "Saving..."

        : "Save changes";

  }

}


function showMessage(
  element,
  text,
  type = ""
) {

  if (
    !element
  ) {

    return;

  }


  element.textContent =
    text;


  element.classList.remove(
    "success",
    "error"
  );


  if (
    type
  ) {

    element.classList.add(
      type
    );

  }

}


function clearMessage(
  element
) {

  if (
    !element
  ) {

    return;

  }


  element.textContent =
    "";


  element.classList.remove(
    "success",
    "error"
  );

}