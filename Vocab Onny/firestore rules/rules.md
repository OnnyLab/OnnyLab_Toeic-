rules_version = '2';

service cloud.firestore {

  match /databases/{database}/documents {


    /* =====================================================
       AUTH / USER HELPERS
    ===================================================== */

    function loggedIn() {
      return request.auth != null;
    }


    function ownDocument(userId) {
      return loggedIn()
        && request.auth.uid == userId;
    }


    function userExists() {
      return loggedIn()
        && exists(
          /databases/$(database)/documents/users/$(request.auth.uid)
        );
    }


    function currentUser() {
      return get(
        /databases/$(database)/documents/users/$(request.auth.uid)
      ).data;
    }


    /*
      รองรับ User เก่าที่อาจไม่มี status

      ไม่มี status       = active
      status == active   = active
      status == disabled = disabled
    */

    function isActiveUser() {
      return userExists()
        && (
          !("status" in currentUser())
          ||
          currentUser().status != "disabled"
        );
    }


    /*
      ADMIN

      Admin เก่าที่ไม่มี status
      ยังคงใช้งานได้

      User ปกติไม่สามารถแก้ role ตัวเองได้
      เพราะ users/{uid} update มี field whitelist
    */

    function isAdmin() {
      return userExists()
        && currentUser().role == "admin"
        && (
          !("status" in currentUser())
          ||
          currentUser().status != "disabled"
        );
    }


    function isActiveOwner(userId) {
      return ownDocument(userId)
        && isActiveUser();
    }



    /* =====================================================
       GENERIC VALIDATION HELPERS
    ===================================================== */

    function isNonNegativeNumber(value) {
      return value is number
        && value >= 0;
    }


    function isPercentage(value) {
      return value is number
        && value >= 0
        && value <= 100;
    }


    function validMode(value) {
      return value == "translation"
        || value == "meaning"
        || value == "synonym"
        || value == "weak"
        || value == "grammar-part5"
        || value == "grammar-tenses"
        || value == "grammar-fill"
        || value == "grammar-error"
        || value == "grammar-sentence";
    }


    function validOutcome(value) {
      return value == "correct"
        || value == "wrong"
        || value == "timeout";
    }



    /* =====================================================
       WORD STATS VALIDATION
    ===================================================== */

    function validWordStatIdentity(userId, wordId) {
      return request.resource.data.uid == userId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.id == wordId;
    }


    function validWordStatCounters() {
      return isNonNegativeNumber(
          request.resource.data.attempts
        )
        && isNonNegativeNumber(
          request.resource.data.correct
        )
        && isNonNegativeNumber(
          request.resource.data.wrong
        )
        && isNonNegativeNumber(
          request.resource.data.timeout
        )
        && request.resource.data.correct
             + request.resource.data.wrong
             + request.resource.data.timeout
             == request.resource.data.attempts;
    }


    function validWordStatAccuracy() {
      return isPercentage(
        request.resource.data.accuracy
      );
    }


    /*
      Optional fields จาก storage.js / cloud-data.js

      เช็กเฉพาะเมื่อ field นั้นมีอยู่
      เพื่อรองรับข้อมูลเก่าและ migration
    */

    function validWordStatOptionalFields() {
      return (
          !("totalResponseTime" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.totalResponseTime
          )
        )

        && (
          !("translationAttempts" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.translationAttempts
          )
        )

        && (
          !("translationCorrect" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.translationCorrect
          )
        )

        && (
          !("translationWrong" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.translationWrong
          )
        )

        && (
          !("translationTimeout" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.translationTimeout
          )
        )

        && (
          !("meaningAttempts" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.meaningAttempts
          )
        )

        && (
          !("meaningCorrect" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.meaningCorrect
          )
        )

        && (
          !("meaningWrong" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.meaningWrong
          )
        )

        && (
          !("meaningTimeout" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.meaningTimeout
          )
        )

        && (
          !("synonymAttempts" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.synonymAttempts
          )
        )

        && (
          !("synonymCorrect" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.synonymCorrect
          )
        )

        && (
          !("synonymWrong" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.synonymWrong
          )
        )

        && (
          !("synonymTimeout" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.synonymTimeout
          )
        )

        && (
          !("weakAttempts" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.weakAttempts
          )
        )

        && (
          !("weakCorrect" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.weakCorrect
          )
        )

        && (
          !("weakWrong" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.weakWrong
          )
        )

        && (
          !("weakTimeout" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.weakTimeout
          )
        )

        && (
          !("lastMode" in request.resource.data)
          ||
          validMode(
            request.resource.data.lastMode
          )
        )

        && (
          !("lastResult" in request.resource.data)
          ||
          validOutcome(
            request.resource.data.lastResult
          )
        )

        && (
          !("schemaVersion" in request.resource.data)
          ||
          (
            request.resource.data.schemaVersion is number
            && request.resource.data.schemaVersion >= 1
          )
        );
    }


    function validWordStat(userId, wordId) {
      return validWordStatIdentity(
          userId,
          wordId
        )
        && validWordStatCounters()
        && validWordStatAccuracy()
        && validWordStatOptionalFields();
    }



    /* =====================================================
       GAME HISTORY VALIDATION
    ===================================================== */

    function validHistoryIdentity(userId, gameId) {
      return request.resource.data.uid == userId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.id == gameId;
    }


    function validHistoryMode() {
      return validMode(
        request.resource.data.mode
      );
    }


    function validHistoryCounters() {
      return isNonNegativeNumber(
          request.resource.data.totalQuestions
        )
        && isNonNegativeNumber(
          request.resource.data.correct
        )
        && isNonNegativeNumber(
          request.resource.data.wrong
        )
        && isNonNegativeNumber(
          request.resource.data.timeout
        )
        && request.resource.data.correct
             + request.resource.data.wrong
             + request.resource.data.timeout
             == request.resource.data.totalQuestions;
    }


    function validHistoryScore() {
      return isNonNegativeNumber(
          request.resource.data.score
        )
        && isPercentage(
          request.resource.data.accuracy
        );
    }


    function validHistoryOptionalFields() {
      return (
          !("plannedQuestions" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.plannedQuestions
          )
        )

        && (
          !("averageResponse" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.averageResponse
          )
        )

        && (
          !("averageResponseMs" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.averageResponseMs
          )
        )

        && (
          !("durationMs" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.durationMs
          )
        )

        && (
          !("weakWordCount" in request.resource.data)
          ||
          isNonNegativeNumber(
            request.resource.data.weakWordCount
          )
        )

        && (
          !("endedByWrongLimit" in request.resource.data)
          ||
          request.resource.data.endedByWrongLimit is bool
        )

        && (
          !("schemaVersion" in request.resource.data)
          ||
          (
            request.resource.data.schemaVersion is number
            && request.resource.data.schemaVersion >= 1
          )
        );
    }


    function validHistory(userId, gameId) {
      return validHistoryIdentity(
          userId,
          gameId
        )
        && validHistoryMode()
        && validHistoryCounters()
        && validHistoryScore()
        && validHistoryOptionalFields();
    }



    /* =====================================================
       DAILY STATS VALIDATION

       dailyStats infrastructure มีอยู่ใน cloud-data.js
       แต่ยังไม่ได้เป็น Game Flow หลัก

       จึง validate identity ก่อน
       โดยไม่ล็อก schema ที่ยังไม่ได้ใช้งานจริง
    ===================================================== */

    function validDailyStatIdentity(userId, dateId) {
      return request.resource.data.uid == userId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.id == dateId;
    }


    function validDailyStat(userId, dateId) {
      return validDailyStatIdentity(
          userId,
          dateId
        )
        && (
          !("schemaVersion" in request.resource.data)
          ||
          (
            request.resource.data.schemaVersion is number
            && request.resource.data.schemaVersion >= 1
          )
        );
    }



    /* =====================================================
       GRAMMAR STATS VALIDATION
    ===================================================== */

    function validGrammarStat(userId, statId) {
      return request.resource.data.uid == userId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.id == statId
        && request.resource.data.attempts is number
        && request.resource.data.correct is number
        && request.resource.data.wrong is number
        && request.resource.data.accuracy is number
        && request.resource.data.attempts >= 0
        && request.resource.data.correct >= 0
        && request.resource.data.wrong >= 0
        && request.resource.data.accuracy >= 0
        && request.resource.data.accuracy <= 100
        && request.resource.data.correct
             + request.resource.data.wrong
             == request.resource.data.attempts;
    }


    /* =====================================================
       USERS
    ===================================================== */

    match /users/{userId} {


      /*
        User อ่าน profile ตัวเอง
        Admin อ่าน profile ทุกคน
      */

      allow read:
        if ownDocument(userId)
        || isAdmin();


      /*
        สมัคร User ใหม่

        User ไม่สามารถสร้างตัวเองเป็น admin
        และไม่สามารถสร้าง document ให้ UID อื่น

        Admin สามารถสร้าง User document ได้
      */

      allow create:
        if (
          ownDocument(userId)

          && request.resource.data.uid
            == request.auth.uid

          && request.resource.data.email
            == request.auth.token.email

          && request.resource.data.role
            == "user"

          && request.resource.data.status
            == "active"
        )
        || isAdmin();


      /*
        Admin แก้ User ได้

        User ปกติแก้ได้เฉพาะ field
        ที่ระบบอนุญาตเท่านั้น

        role / status / uid / email
        แก้เองไม่ได้
      */

      allow update:
        if isAdmin()

        || (
          isActiveOwner(userId)

          && request.resource.data
            .diff(resource.data)
            .affectedKeys()
            .hasOnly([
              "displayName",
              "avatarType",
              "streak",
              "isOnline",
              "lastSeenAt",
              "lastActivityAt",
              "lastLoginAt",
              "currentActivity",
              "currentActivityAt",
              "updatedAt",
              "learningSchemaVersion",
              "learningMigratedAt"
            ])
        );


      /*
        ไม่อนุญาตลบ User document
        จาก Client
      */

      allow delete:
        if false;



      /* ===================================================
         WORD STATS
      =================================================== */

      match /wordStats/{wordId} {


        allow read:
          if isActiveOwner(userId)
          || isAdmin();


        /*
          User เขียนได้เฉพาะ Word Stats ของตัวเอง

          เพิ่ม validation:
          - uid ต้องตรง Auth
          - id ต้องตรง Document ID
          - counters ห้ามติดลบ
          - correct + wrong + timeout = attempts
          - accuracy 0-100
          - mode/result ถูกต้อง
        */

        allow create, update:
          if isActiveOwner(userId)
          && validWordStat(
            userId,
            wordId
          );


        allow delete:
          if isActiveOwner(userId)
          || isAdmin();

      }



      /* ===================================================
         GRAMMAR STATS
      =================================================== */

      match /grammarStats/{statId} {

        allow read:
          if isActiveOwner(userId)
          || isAdmin();

        allow create, update:
          if isActiveOwner(userId)
          && validGrammarStat(
            userId,
            statId
          );

        allow delete:
          if isActiveOwner(userId)
          || isAdmin();

      }


      /* ===================================================
         GAME HISTORY
      =================================================== */

      match /history/{gameId} {


        allow read:
          if isActiveOwner(userId)
          || isAdmin();


        /*
          Game History สร้างได้เมื่อจบเกม

          หลังสร้างแล้ว User ไม่สามารถแก้ย้อนหลังได้
          เพื่อให้ History เป็น immutable
        */

        allow create:
          if isActiveOwner(userId)
          && validHistory(
            userId,
            gameId
          );


        /*
          ปิดการแก้ History เก่าจาก Client

          Game Engine ปัจจุบันสร้าง History ใหม่
          ไม่จำเป็นต้อง update เกมเก่า
        */

        allow update:
          if false;


        /*
          User สามารถลบ History ตัวเอง
          Admin สามารถลบได้

          รองรับ Reset Progress /
          Admin Data Management
        */

        allow delete:
          if isActiveOwner(userId)
          || isAdmin();

      }



      /* ===================================================
         DAILY STATS
      =================================================== */

      match /dailyStats/{dateId} {


        allow read:
          if isActiveOwner(userId)
          || isAdmin();


        /*
          ตอนนี้ Daily Stats ยังไม่ได้เป็น
          Game Flow หลัก

          จึงตรวจ identity + schemaVersion ก่อน
          โดยยังไม่ล็อก field อื่น
        */

        allow create, update:
          if isActiveOwner(userId)
          && validDailyStat(
            userId,
            dateId
          );


        allow delete:
          if isActiveOwner(userId)
          || isAdmin();

      }

    }



    /* =====================================================
       VOCABULARY
    ===================================================== */

    match /vocabulary/{wordId} {


      /*
        Active User อ่านคำศัพท์ได้
      */

      allow read:
        if isActiveUser();


      /*
        เฉพาะ Active Admin
        เพิ่ม / แก้ไข / ลบ Vocabulary
      */

      allow create, update, delete:
        if isAdmin();

    }



    /* =====================================================
       GRAMMAR QUESTIONS
    ===================================================== */

    match /grammarQuestions/{questionId} {

      allow read:
        if isActiveUser();

      allow create, update, delete:
        if isAdmin();

    }


    /* =====================================================
       GAME SETTINGS
    ===================================================== */

    match /gameSettings/{settingId} {


      /*
        Active User อ่าน Game Settings ได้
      */

      allow read:
        if isActiveUser();


      /*
        เฉพาะ Active Admin
        เพิ่ม / แก้ไข / ลบ
      */

      allow create, update, delete:
        if isAdmin();

    }



    /* =====================================================
       DENY EVERYTHING ELSE
    ===================================================== */

    match /{document=**} {

      allow read, write:
        if false;

    }

  }

}
