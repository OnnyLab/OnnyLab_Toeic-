import {
  db
} from "./firebase.js";


import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   CREATE USER PROFILE
========================================================= */

export async function createUserProfileIfNeeded(
  user
) {

  if (
    !user
  ) {

    return null;

  }


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


  /*
    มี Profile แล้ว
  */

  if (
    snapshot.exists()
  ) {

    return {
      id:
        snapshot.id,

      ...snapshot.data()
    };

  }


  /*
    Account ใหม่เป็น User เท่านั้น
  */

  const displayName =
    user.displayName
    ||
    getNameFromEmail(
      user.email
    );


  const userData = {

    uid:
      user.uid,

    email:
      user.email ||
      "",

    displayName,

    role:
      "user",

    status:
      "active",

    avatarType:
      "initial",

    streak:
      0,

    isOnline:
      false,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp()

  };


  await setDoc(
    userRef,
    userData
  );


  return userData;

}


/* =========================================================
   GET PROFILE
========================================================= */

export async function getUserProfile(
  uid
) {

  if (
    !uid
  ) {

    return null;

  }


  const userRef =
    doc(
      db,
      "users",
      uid
    );


  const snapshot =
    await getDoc(
      userRef
    );


  if (
    !snapshot.exists()
  ) {

    return null;

  }


  return {
    id:
      snapshot.id,

    ...snapshot.data()
  };

}


/* =========================================================
   GET OR CREATE
========================================================= */

export async function getOrCreateUserProfile(
  user
) {

  if (
    !user
  ) {

    return null;

  }


  let profile =
    await getUserProfile(
      user.uid
    );


  if (
    !profile
  ) {

    profile =
      await createUserProfileIfNeeded(
        user
      );

  }


  return profile;

}


/* =========================================================
   UPDATE PROFILE
========================================================= */

export async function updateUserProfile(
  uid,
  data
) {

  if (
    !uid
  ) {

    throw new Error(
      "UID is required"
    );

  }


  const safeData = {
    ...data
  };


  /*
    ห้าม User ฝั่ง Client
    แก้ Field สำคัญ
  */

  delete safeData.uid;

  delete safeData.email;

  delete safeData.role;

  delete safeData.status;

  delete safeData.createdAt;


  const userRef =
    doc(
      db,
      "users",
      uid
    );


  await updateDoc(
    userRef,
    {
      ...safeData,

      updatedAt:
        serverTimestamp()
    }
  );

}


/* =========================================================
   GET ROLE
========================================================= */

export async function getUserRoleFromFirestore(
  user
) {

  if (
    !user
  ) {

    return null;

  }


  const profile =
    await getUserProfile(
      user.uid
    );


  if (
    !profile
  ) {

    return null;

  }


  return (
    profile.role ||
    "user"
  );

}


/* =========================================================
   DISPLAY NAME
========================================================= */

export function getProfileDisplayName(
  profile,
  user
) {

  if (
    profile
      ?.displayName
      ?.trim()
  ) {

    return profile
      .displayName
      .trim();

  }


  if (
    user
      ?.displayName
      ?.trim()
  ) {

    return user
      .displayName
      .trim();

  }


  return getNameFromEmail(
    user?.email
  );

}


/* =========================================================
   EMAIL -> NAME
========================================================= */

function getNameFromEmail(
  email
) {

  if (
    !email
  ) {

    return "User";

  }


  const name =
    email
      .split("@")[0]
      .trim();


  if (
    !name
  ) {

    return "User";

  }


  return (
    name
      .charAt(0)
      .toUpperCase()
    +
    name.slice(1)
  );

}