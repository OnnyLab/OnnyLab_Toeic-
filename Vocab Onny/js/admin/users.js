import {
  app,
  auth,
  db
} from "../core/firebase.js";


import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";


import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as signOutSecondary
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig =
  app.options;



/* =========================================================
   SECONDARY AUTH

   ใช้สร้าง User โดย Admin ไม่หลุด Login
========================================================= */

const secondaryApp =
  initializeApp(
    firebaseConfig,
    "VocabOnnySecondaryAuth"
  );


const secondaryAuth =
  getAuth(
    secondaryApp
  );



/* =========================================================
   DOM
========================================================= */

const $ = (id) =>
  document.getElementById(id);



const totalUsers =
  $("totalUsers");


const onlineUsers =
  $("onlineUsers");


const activeUsers =
  $("activeUsers");


const disabledUsers =
  $("disabledUsers");


const userSearch =
  $("userSearch");


const statusFilter =
  $("statusFilter");


const roleFilter =
  $("roleFilter");


const usersTableBody =
  $("usersTableBody");


const addUserBtn =
  $("addUserBtn");


const userMessage =
  $("userMessage");



const userModal =
  $("userModal");


const userModalBackdrop =
  $("userModalBackdrop");


const closeUserModalBtn =
  $("closeUserModalBtn");


const cancelUserBtn =
  $("cancelUserBtn");


const userForm =
  $("userForm");


const editingUserId =
  $("editingUserId");


const createUserSection =
  $("createUserSection");


const userModalTitle =
  $("userModalTitle");



const userEmail =
  $("userEmail");


const userPassword =
  $("userPassword");


const userDisplayName =
  $("userDisplayName");


const userRole =
  $("userRole");


const userStatus =
  $("userStatus");


const saveUserBtn =
  $("saveUserBtn");


const toggleUserStatusBtn =
  $("toggleUserStatusBtn");



const userInfoPanel =
  $("userInfoPanel");


const infoUid =
  $("infoUid");


const infoOnline =
  $("infoOnline");


const infoLastSeen =
  $("infoLastSeen");


const infoLastLogin =
  $("infoLastLogin");


const infoCreated =
  $("infoCreated");



/* =========================================================
   STATE
========================================================= */

let users = [];

let currentAdminUid = "";

let messageTimer = null;



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

      const profileSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !profileSnapshot.exists()
      ) {

        window.location.href =
          "../user/dashboard.html";

        return;

      }


      const profile =
        profileSnapshot.data();


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


      await loadUsers();


    } catch (error) {

      console.error(
        "Users auth error:",
        error
      );


      showMessage(
        "ไม่สามารถเปิด User Management ได้",
        "error"
      );

    }

  }
);



/* =========================================================
   ADMIN PROFILE
========================================================= */

function renderAdminProfile(
  user,
  profile
) {

  const name =
    profile.displayName ||
    "Administrator";


  const nameElement =
    $("adminName");


  const emailElement =
    $("adminEmail");


  const avatarElement =
    $("adminAvatar");


  if (nameElement) {

    nameElement.textContent =
      name;

  }


  if (emailElement) {

    emailElement.textContent =
      profile.email ||
      user.email ||
      "";

  }


  if (avatarElement) {

    avatarElement.textContent =
      name
        .charAt(0)
        .toUpperCase() || "A";

  }

}



/* =========================================================
   LOAD USERS
========================================================= */

async function loadUsers() {

  usersTableBody.innerHTML = `

    <tr>

      <td
        colspan="6"
        class="users-empty"
      >
        Loading users...
      </td>

    </tr>

  `;


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "users"
        )
      );


    users =
      snapshot.docs.map(
        (documentSnapshot) => {

          return {

            id:
              documentSnapshot.id,

            ...documentSnapshot.data()

          };

        }
      );


    users.sort(
      (a, b) => {

        if (
          a.role === "admin" &&
          b.role !== "admin"
        ) {

          return -1;

        }


        if (
          b.role === "admin" &&
          a.role !== "admin"
        ) {

          return 1;

        }


        return (
          a.displayName || ""
        ).localeCompare(
          b.displayName || ""
        );

      }
    );


    renderUsers();


  } catch (error) {

    console.error(
      "Load users error:",
      error
    );


    usersTableBody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="users-empty"
        >
          ไม่สามารถโหลด Users ได้
        </td>

      </tr>

    `;


    showMessage(
      "โหลด Users ไม่สำเร็จ",
      "error"
    );

  }

}



/* =========================================================
   ONLINE
========================================================= */

function isOnline(
  user
) {

  if (
    getAccountStatus(user) ===
    "disabled"
  ) {

    return false;

  }


  const lastSeen =
    timestampToMilliseconds(
      user.lastSeenAt
    );


  if (!lastSeen) {

    return false;

  }


  const ONLINE_LIMIT =
    2 * 60 * 1000;


  return (
    Date.now() -
    lastSeen
  ) <= ONLINE_LIMIT;

}



function getAccountStatus(
  user
) {

  return (
    user.status ===
    "disabled"
      ? "disabled"
      : "active"
  );

}



/* =========================================================
   RENDER
========================================================= */

function renderUsers() {

  const keyword =
    userSearch.value
      .trim()
      .toLowerCase();


  const status =
    statusFilter.value;


  const role =
    roleFilter.value;



  const filtered =
    users.filter(
      (user) => {

        const search =
          `${user.displayName || ""} ${user.email || ""}`
            .toLowerCase();


        if (
          keyword &&
          !search.includes(
            keyword
          )
        ) {

          return false;

        }


        if (
          role !== "all" &&
          user.role !== role
        ) {

          return false;

        }


        const online =
          isOnline(user);


        const accountStatus =
          getAccountStatus(user);


        if (
          status === "online" &&
          !online
        ) {

          return false;

        }


        if (
          status === "offline" &&
          online
        ) {

          return false;

        }


        if (
          status === "active" &&
          accountStatus !== "active"
        ) {

          return false;

        }


        if (
          status === "disabled" &&
          accountStatus !== "disabled"
        ) {

          return false;

        }


        return true;

      }
    );


  renderSummary();


  if (
    filtered.length === 0
  ) {

    usersTableBody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="users-empty"
        >
          ไม่พบ User
        </td>

      </tr>

    `;


    return;

  }


  usersTableBody.innerHTML =
    filtered
      .map(
        createUserRow
      )
      .join("");


  bindEditButtons();

}



/* =========================================================
   USER ROW
========================================================= */

function createUserRow(
  user
) {

  const accountStatus =
    getAccountStatus(user);


  const online =
    isOnline(user);


  let statusHTML = "";


  if (
    accountStatus ===
    "disabled"
  ) {

    statusHTML = `

      <span class="user-status disabled">

        <span class="user-status-dot">
        </span>

        Disabled

      </span>

    `;


  } else if (online) {

    statusHTML = `

      <span class="user-status online">

        <span class="user-status-dot">
        </span>

        Online

      </span>

    `;


  } else {

    statusHTML = `

      <span class="user-status offline">

        <span class="user-status-dot">
        </span>

        Offline

      </span>

    `;

  }


  const name =
    user.displayName ||
    "Unnamed User";


  const email =
    user.email ||
    "-";


  const role =
    user.role ||
    "user";


  const initial =
    name
      .charAt(0)
      .toUpperCase() || "U";


  return `

    <tr>


      <td>

        <div class="user-cell">

          <div class="user-avatar">
            ${escapeHTML(initial)}
          </div>

          <div>

            <strong>
              ${escapeHTML(name)}
            </strong>

            <small>
              ${escapeHTML(email)}
            </small>

          </div>

        </div>

      </td>



      <td>
        ${statusHTML}
      </td>



      <td>

        <span
          class="user-role-badge ${
            role === "admin"
              ? "admin"
              : ""
          }"
        >
          ${escapeHTML(role)}
        </span>

      </td>



      <td>
        ${escapeHTML(
          formatRelativeTime(
            user.lastSeenAt
          )
        )}
      </td>



      <td>
        ${escapeHTML(
          formatDate(
            user.createdAt
          )
        )}
      </td>



      <td>

        <button
          class="user-action-button"
          type="button"
          data-edit-user="${user.id}"
        >
          View / Edit
        </button>

      </td>


    </tr>

  `;

}



/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

  totalUsers.textContent =
    users.length;


  onlineUsers.textContent =
    users.filter(
      isOnline
    ).length;


  activeUsers.textContent =
    users.filter(
      (user) =>
        getAccountStatus(user) ===
        "active"
    ).length;


  disabledUsers.textContent =
    users.filter(
      (user) =>
        getAccountStatus(user) ===
        "disabled"
    ).length;

}



/* =========================================================
   FILTERS
========================================================= */

userSearch.addEventListener(
  "input",
  renderUsers
);


statusFilter.addEventListener(
  "change",
  renderUsers
);


roleFilter.addEventListener(
  "change",
  renderUsers
);



/* =========================================================
   ADD USER
========================================================= */

addUserBtn.addEventListener(
  "click",
  openCreateUserModal
);


function openCreateUserModal() {

  editingUserId.value =
    "";


  userModalTitle.textContent =
    "Add User";


  createUserSection.hidden =
    false;


  userInfoPanel.hidden =
    true;


  toggleUserStatusBtn.hidden =
    true;


  userEmail.value =
    "";


  userPassword.value =
    "";


  userDisplayName.value =
    "";


  userRole.value =
    "user";


  userStatus.value =
    "active";


  userEmail.required =
    true;


  userPassword.required =
    true;


  userRole.disabled =
    false;


  userStatus.disabled =
    false;


  saveUserBtn.textContent =
    "Create User";


  openModal();

}



/* =========================================================
   EDIT USER
========================================================= */

function bindEditButtons() {

  document
    .querySelectorAll(
      "[data-edit-user]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openEditUser(
              button.dataset.editUser
            );

          }
        );

      }
    );

}



function openEditUser(
  userId
) {

  const user =
    users.find(
      (item) =>
        item.id === userId
    );


  if (!user) {

    return;

  }


  editingUserId.value =
    user.id;


  userModalTitle.textContent =
    user.displayName ||
    "User";


  createUserSection.hidden =
    true;


  userInfoPanel.hidden =
    false;


  userDisplayName.value =
    user.displayName || "";


  userRole.value =
    user.role || "user";


  userStatus.value =
    getAccountStatus(user);


  infoUid.textContent =
    user.id;


  infoOnline.textContent =
    isOnline(user)
      ? "Online"
      : "Offline";


  infoLastSeen.textContent =
    formatDateTime(
      user.lastSeenAt
    );


  infoLastLogin.textContent =
    formatDateTime(
      user.lastLoginAt
    );


  infoCreated.textContent =
    formatDateTime(
      user.createdAt
    );


  const editingSelf =
    user.id ===
    currentAdminUid;


  userRole.disabled =
    editingSelf;


  userStatus.disabled =
    editingSelf;


  toggleUserStatusBtn.hidden =
    editingSelf;


  toggleUserStatusBtn.textContent =
    getAccountStatus(user) ===
      "disabled"
      ? "Enable User"
      : "Disable User";


  saveUserBtn.textContent =
    "Save Changes";


  openModal();

}



/* =========================================================
   FORM
========================================================= */

userForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    if (
      editingUserId.value
    ) {

      await updateUser(
        editingUserId.value
      );


    } else {

      await createUser();

    }

  }
);



/* =========================================================
   CREATE
========================================================= */

async function createUser() {

  const email =
    userEmail.value
      .trim();


  const password =
    userPassword.value;


  const displayName =
    userDisplayName.value
      .trim();


  const role =
    userRole.value;


  if (
    !email ||
    !password ||
    !displayName
  ) {

    showMessage(
      "กรุณากรอกข้อมูลให้ครบ",
      "error"
    );


    return;

  }


  if (
    password.length < 6
  ) {

    showMessage(
      "Password ต้องมีอย่างน้อย 6 ตัว",
      "error"
    );


    return;

  }


  setSaveLoading(
    true
  );


  try {

    const credential =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );


    const createdUser =
      credential.user;


    await setDoc(
      doc(
        db,
        "users",
        createdUser.uid
      ),
      {

        uid:
          createdUser.uid,

        email:
          email,

        displayName:
          displayName,

        role:
          role,

        status:
          "active",

        avatarType:
          "initial",

        streak:
          0,

        isOnline:
          false,

        lastLoginAt:
          null,

        lastSeenAt:
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    await signOutSecondary(
      secondaryAuth
    );


    closeModal();


    showMessage(
      "สร้าง User เรียบร้อย",
      "success"
    );


    await loadUsers();


  } catch (error) {

    console.error(
      "Create user error:",
      error
    );


    try {

      await signOutSecondary(
        secondaryAuth
      );

    } catch {
      // ignore
    }


    showMessage(
      getFirebaseError(
        error
      ),
      "error"
    );


  } finally {

    setSaveLoading(
      false
    );

  }

}



/* =========================================================
   UPDATE
========================================================= */

async function updateUser(
  userId
) {

  const displayName =
    userDisplayName.value
      .trim();


  if (!displayName) {

    showMessage(
      "Display Name ห้ามว่าง",
      "error"
    );


    return;

  }


  setSaveLoading(
    true
  );


  try {

    const updates = {

      displayName:
        displayName,

      updatedAt:
        serverTimestamp()

    };


    if (
      userId !==
      currentAdminUid
    ) {

      updates.role =
        userRole.value;


      updates.status =
        userStatus.value;

    }


    await updateDoc(
      doc(
        db,
        "users",
        userId
      ),
      updates
    );


    closeModal();


    showMessage(
      "อัปเดต User เรียบร้อย",
      "success"
    );


    await loadUsers();


  } catch (error) {

    console.error(
      "Update user error:",
      error
    );


    showMessage(
      "อัปเดต User ไม่สำเร็จ",
      "error"
    );


  } finally {

    setSaveLoading(
      false
    );

  }

}



/* =========================================================
   DISABLE / ENABLE
========================================================= */

toggleUserStatusBtn.addEventListener(
  "click",
  async () => {

    const userId =
      editingUserId.value;


    if (
      !userId ||
      userId === currentAdminUid
    ) {

      return;

    }


    const user =
      users.find(
        (item) =>
          item.id === userId
      );


    if (!user) {
      return;
    }


    const nextStatus =
      getAccountStatus(user) ===
        "disabled"
        ? "active"
        : "disabled";


    const confirmed =
      confirm(
        nextStatus === "disabled"
          ? `Disable ${user.displayName || user.email}?`
          : `Enable ${user.displayName || user.email}?`
      );


    if (!confirmed) {

      return;

    }


    try {

      toggleUserStatusBtn.disabled =
        true;


      await updateDoc(
        doc(
          db,
          "users",
          userId
        ),
        {

          status:
            nextStatus,

          isOnline:
            false,

          updatedAt:
            serverTimestamp()

        }
      );


      closeModal();


      showMessage(
        nextStatus === "disabled"
          ? "Disable User เรียบร้อย"
          : "Enable User เรียบร้อย",
        "success"
      );


      await loadUsers();


    } catch (error) {

      console.error(
        error
      );


      showMessage(
        "เปลี่ยนสถานะไม่สำเร็จ",
        "error"
      );


    } finally {

      toggleUserStatusBtn.disabled =
        false;

    }

  }
);



/* =========================================================
   MODAL
========================================================= */

function openModal() {

  userModal.hidden =
    false;


  document.body.style.overflow =
    "hidden";

}


function closeModal() {

  userModal.hidden =
    true;


  document.body.style.overflow =
    "";


  userRole.disabled =
    false;


  userStatus.disabled =
    false;


  userEmail.required =
    false;


  userPassword.required =
    false;

}


closeUserModalBtn.addEventListener(
  "click",
  closeModal
);


cancelUserBtn.addEventListener(
  "click",
  closeModal
);


userModalBackdrop.addEventListener(
  "click",
  closeModal
);



/* =========================================================
   HELPERS
========================================================= */

function timestampToMilliseconds(
  value
) {

  if (!value) {

    return 0;

  }


  if (
    typeof value.toMillis ===
    "function"
  ) {

    return value.toMillis();

  }


  if (
    value.seconds
  ) {

    return value.seconds *
      1000;

  }


  return 0;

}



function formatRelativeTime(
  value
) {

  const time =
    timestampToMilliseconds(
      value
    );


  if (!time) {

    return "Never";

  }


  const diff =
    Date.now() -
    time;


  const minute =
    60000;


  const hour =
    minute * 60;


  const day =
    hour * 24;


  if (
    diff <
    minute
  ) {

    return "Now";

  }


  if (
    diff <
    hour
  ) {

    return `${Math.floor(
      diff / minute
    )} min ago`;

  }


  if (
    diff <
    day
  ) {

    return `${Math.floor(
      diff / hour
    )} hr ago`;

  }


  return `${Math.floor(
    diff / day
  )} days ago`;

}



function formatDate(
  value
) {

  const time =
    timestampToMilliseconds(
      value
    );


  if (!time) {

    return "-";

  }


  return new Date(
    time
  ).toLocaleDateString(
    "th-TH"
  );

}



function formatDateTime(
  value
) {

  const time =
    timestampToMilliseconds(
      value
    );


  if (!time) {

    return "-";

  }


  return new Date(
    time
  ).toLocaleString(
    "th-TH"
  );

}



function showMessage(
  message,
  type
) {

  clearTimeout(
    messageTimer
  );


  userMessage.textContent =
    message;


  userMessage.className =
    `user-message show ${type}`;


  messageTimer =
    setTimeout(
      () => {

        userMessage.className =
          "user-message";

      },
      3500
    );

}



function setSaveLoading(
  loading
) {

  saveUserBtn.disabled =
    loading;


  saveUserBtn.textContent =
    loading
      ? "Saving..."
      : (
          editingUserId.value
            ? "Save Changes"
            : "Create User"
        );

}



function getFirebaseError(
  error
) {

  switch (
    error?.code
  ) {

    case "auth/email-already-in-use":

      return "Email นี้ถูกใช้งานแล้ว";


    case "auth/invalid-email":

      return "Email ไม่ถูกต้อง";


    case "auth/weak-password":

      return "Password สั้นหรืออ่อนเกินไป";


    default:

      return (
        error?.message ||
        "เกิดข้อผิดพลาด"
      );

  }

}



function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}



/* =========================================================
   AUTO REFRESH
========================================================= */

setInterval(
  () => {

    if (
      users.length
    ) {

      renderUsers();

    }

  },
  30000
);



/* =========================================================
   LOGOUT
========================================================= */

function bindLogout() {

  const button =
    $("logoutBtn");


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    async () => {

      await signOut(
        auth
      );


      window.location.href =
        "../index.html";

    }
  );

}