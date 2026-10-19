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
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   DOM
========================================================= */

const $ = (id) => {
  return document.getElementById(id);
};



const vocabTableBody =
  $("vocabTableBody");


const totalWords =
  $("totalWords");


const activeWords =
  $("activeWords");


const inactiveWords =
  $("inactiveWords");


const searchInput =
  $("searchInput");


const levelFilter =
  $("levelFilter");


const statusFilter =
  $("statusFilter");



const openAddModalBtn =
  $("openAddModalBtn");


const vocabModal =
  $("vocabModal");


const closeModalBtn =
  $("closeModalBtn");


const cancelBtn =
  $("cancelBtn");


const vocabForm =
  $("vocabForm");


const editDocumentId =
  $("editDocumentId");


const modalTitle =
  $("modalTitle");


const saveBtn =
  $("saveBtn");


const saveBtnText =
  $("saveBtnText");


const formMessage =
  $("formMessage");



const wordInput =
  $("wordInput");


const thaiInput =
  $("thaiInput");


const meaningInput =
  $("meaningInput");


const exampleSentenceInput =
  $("exampleSentenceInput");


const synonymsInput =
  $("synonymsInput");


const levelInput =
  $("levelInput");


const activeInput =
  $("activeInput");



/* =========================================================
   STATE
========================================================= */

let vocabulary = [];

let currentAdminUid = "";



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

      const userSnap =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !userSnap.exists()
      ) {

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


      await loadVocabulary();


    } catch (error) {

      console.error(
        "Vocabulary auth error:",
        error
      );

    }

  }
);



/* =========================================================
   PROFILE
========================================================= */

function renderAdminProfile(
  user,
  profile
) {

  const name =
    profile.displayName ||
    "Administrator";


  const email =
    profile.email ||
    user.email ||
    "";


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
      email;

  }


  if (avatarElement) {

    avatarElement.textContent =
      name
        .charAt(0)
        .toUpperCase() || "A";

  }

}



/* =========================================================
   LOAD VOCABULARY
========================================================= */

async function loadVocabulary() {

  renderLoading();


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "vocabulary"
        )
      );


    vocabulary =
      snapshot.docs.map(
        (documentSnapshot) => {

          const data =
            documentSnapshot.data();


          return {

            id:
              documentSnapshot.id,

            word:
              data.word || "",

            thai:
              data.thai || "",

            meaning:
              data.meaning || "",

            exampleSentence:
              data.exampleSentence || "",

            synonyms:
              Array.isArray(
                data.synonyms
              )
                ? data.synonyms
                : [],

            level:
              data.level || "",

            active:
              data.active !== false,

            createdAt:
              data.createdAt || null,

            updatedAt:
              data.updatedAt || null

          };

        }
      );


    vocabulary.sort(
      (a, b) => {

        return a.word.localeCompare(
          b.word
        );

      }
    );


    renderVocabulary();


  } catch (error) {

    console.error(
      "Load vocabulary error:",
      error
    );


    vocabTableBody.innerHTML = `

      <tr>

        <td
          colspan="7"
          class="empty-table"
        >
          ไม่สามารถโหลดคำศัพท์ได้
        </td>

      </tr>

    `;

  }

}



/* =========================================================
   RENDER
========================================================= */

function renderVocabulary() {

  const keyword =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedLevel =
    levelFilter.value;


  const selectedStatus =
    statusFilter.value;



  const filtered =
    vocabulary.filter(
      (item) => {

        const searchText =
          [
            item.word,
            item.thai,
            item.meaning,
            item.exampleSentence,
            ...item.synonyms
          ]
            .join(" ")
            .toLowerCase();


        if (
          keyword &&
          !searchText.includes(
            keyword
          )
        ) {

          return false;
        }


        if (
          selectedLevel &&
          item.level !==
          selectedLevel
        ) {

          return false;
        }


        if (
          selectedStatus ===
            "active" &&
          !item.active
        ) {

          return false;
        }


        if (
          selectedStatus ===
            "inactive" &&
          item.active
        ) {

          return false;
        }


        return true;

      }
    );


  renderStats();

  const resultCount =
    $("vocabResultCount");

  if (resultCount) {
    resultCount.textContent =
      filtered.length +
      (filtered.length === 1
        ? " result"
        : " results");
  }


  if (
    filtered.length === 0
  ) {

    vocabTableBody.innerHTML = `

      <tr>

        <td
          colspan="7"
          class="empty-table"
        >
          ไม่พบคำศัพท์
        </td>

      </tr>

    `;


    return;
  }


  vocabTableBody.innerHTML =
    filtered
      .map(
        createRowHTML
      )
      .join("");


  bindTableActions();

}



/* =========================================================
   TABLE ROW
========================================================= */

function createRowHTML(
  item
) {

  const synonyms =
    item.synonyms.length
      ? item.synonyms
          .map(
            (synonym) => {

              return `

                <span class="synonym-chip">
                  ${escapeHTML(synonym)}
                </span>

              `;

            }
          )
          .join("")
      : `<span class="muted">-</span>`;


  const meaning =
    item.meaning
      ? escapeHTML(item.meaning)
      : `<span class="muted">-</span>`;


  return `

    <tr>


      <td>

        <strong>
          ${escapeHTML(item.word)}
        </strong>

      </td>


      <td>

        ${escapeHTML(item.thai)}

      </td>


      <td class="meaning-cell">

        ${meaning}

      </td>


      <td>

        <div class="synonym-list">
          ${synonyms}
        </div>

      </td>


      <td>

        ${
          item.level
            ? escapeHTML(item.level)
            : `<span class="muted">-</span>`
        }

      </td>


      <td>

        <button
          type="button"
          class="status-button ${
            item.active
              ? "status-active"
              : "status-inactive"
          }"
          data-toggle-status="${item.id}"
        >

          ${
            item.active
              ? "Active"
              : "Inactive"
          }

        </button>

      </td>


      <td>

        <div class="table-actions">

          <button
            type="button"
            class="edit-button"
            data-edit-id="${item.id}"
          >
            Edit
          </button>


          <button
            type="button"
            class="delete-button"
            data-delete-id="${item.id}"
          >
            Delete
          </button>

        </div>

      </td>


    </tr>

  `;

}



/* =========================================================
   STATS
========================================================= */

function renderStats() {

  totalWords.textContent =
    vocabulary.length;


  activeWords.textContent =
    vocabulary.filter(
      (item) =>
        item.active
    ).length;


  inactiveWords.textContent =
    vocabulary.filter(
      (item) =>
        !item.active
    ).length;

  const incomplete =
    $("incompleteWords");

  if (incomplete) {
    incomplete.textContent =
      vocabulary.filter(
        (item) =>
          !item.meaning ||
          !Array.isArray(item.synonyms) ||
          item.synonyms.length === 0
      ).length;
  }

}



/* =========================================================
   FILTER EVENTS
========================================================= */

searchInput.addEventListener(
  "input",
  renderVocabulary
);


levelFilter.addEventListener(
  "change",
  renderVocabulary
);


statusFilter.addEventListener(
  "change",
  renderVocabulary
);



/* =========================================================
   TABLE ACTIONS
========================================================= */

function bindTableActions() {

  document
    .querySelectorAll(
      "[data-edit-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openEditModal(
              button.dataset.editId
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-delete-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            deleteVocabulary(
              button.dataset.deleteId
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-toggle-status]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            toggleVocabularyStatus(
              button.dataset.toggleStatus
            );

          }
        );

      }
    );

}



/* =========================================================
   OPEN ADD
========================================================= */

openAddModalBtn.addEventListener(
  "click",
  openAddModal
);


function openAddModal() {

  vocabForm.reset();


  editDocumentId.value =
    "";


  activeInput.checked =
    true;


  modalTitle.textContent =
    "Add Vocabulary";


  saveBtnText.textContent =
    "Save Vocabulary";


  clearFormMessage();


  openModal();

}



/* =========================================================
   EDIT
========================================================= */

function openEditModal(
  id
) {

  const item =
    vocabulary.find(
      (vocab) =>
        vocab.id === id
    );


  if (!item) {
    return;
  }


  editDocumentId.value =
    item.id;


  wordInput.value =
    item.word;


  thaiInput.value =
    item.thai;


  meaningInput.value =
    item.meaning;


  if (exampleSentenceInput) {

    exampleSentenceInput.value =
      item.exampleSentence;

  }


  synonymsInput.value =
    item.synonyms.join(
      ", "
    );


  levelInput.value =
    item.level;


  activeInput.checked =
    item.active;


  modalTitle.textContent =
    "Edit Vocabulary";


  saveBtnText.textContent =
    "Save Changes";


  clearFormMessage();


  openModal();

}



/* =========================================================
   SAVE FORM
========================================================= */

vocabForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const word =
      wordInput.value
        .trim();


    const thai =
      thaiInput.value
        .trim();


    const meaning =
      meaningInput.value
        .trim();


    const exampleSentence =
      exampleSentenceInput
        ? exampleSentenceInput.value
            .trim()
        : "";


    const level =
      levelInput.value;


    const active =
      activeInput.checked;


    const synonyms =
      parseSynonyms(
        synonymsInput.value
      );


    if (
      !word ||
      !thai
    ) {

      showFormMessage(
        "กรุณากรอก English Word และ Thai Translation",
        "error"
      );


      return;
    }


    const duplicate =
      vocabulary.find(
        (item) => {

          return (
            item.word
              .toLowerCase() ===
              word.toLowerCase() &&
            item.id !==
              editDocumentId.value
          );

        }
      );


    if (duplicate) {

      showFormMessage(
        "คำศัพท์นี้มีอยู่แล้ว",
        "error"
      );


      return;
    }


    setSaving(
      true
    );


    try {

      const data = {

        word:
          word,

        thai:
          thai,

        meaning:
          meaning,

        exampleSentence:
          exampleSentence,

        synonyms:
          synonyms,

        level:
          level,

        active:
          active,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          currentAdminUid

      };


      if (
        editDocumentId.value
      ) {

        await updateDoc(
          doc(
            db,
            "vocabulary",
            editDocumentId.value
          ),
          data
        );


      } else {

        await addDoc(
          collection(
            db,
            "vocabulary"
          ),
          {

            ...data,

            createdAt:
              serverTimestamp(),

            createdBy:
              currentAdminUid

          }
        );

      }


      closeModal();


      await loadVocabulary();


    } catch (error) {

      console.error(
        "Save vocabulary error:",
        error
      );


      showFormMessage(
        "บันทึกคำศัพท์ไม่สำเร็จ",
        "error"
      );


    } finally {

      setSaving(
        false
      );

    }

  }
);



/* =========================================================
   STATUS
========================================================= */

async function toggleVocabularyStatus(
  id
) {

  const item =
    vocabulary.find(
      (vocab) =>
        vocab.id === id
    );


  if (!item) {
    return;
  }


  try {

    await updateDoc(
      doc(
        db,
        "vocabulary",
        id
      ),
      {

        active:
          !item.active,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          currentAdminUid

      }
    );


    await loadVocabulary();


  } catch (error) {

    console.error(
      "Toggle status error:",
      error
    );

  }

}



/* =========================================================
   DELETE
========================================================= */

async function deleteVocabulary(
  id
) {

  const item =
    vocabulary.find(
      (vocab) =>
        vocab.id === id
    );


  if (!item) {
    return;
  }


  const confirmed =
    window.confirm(
      `ต้องการลบ "${item.word}" หรือไม่?`
    );


  if (!confirmed) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "vocabulary",
        id
      )
    );


    await loadVocabulary();


  } catch (error) {

    console.error(
      "Delete vocabulary error:",
      error
    );

  }

}



/* =========================================================
   MODAL
========================================================= */

function openModal() {

  vocabModal.classList.add(
    "show"
  );


  document.body.style.overflow =
    "hidden";

}


function closeModal() {

  vocabModal.classList.remove(
    "show"
  );


  document.body.style.overflow =
    "";

}


closeModalBtn.addEventListener(
  "click",
  closeModal
);


cancelBtn.addEventListener(
  "click",
  closeModal
);


const backdrop =
  vocabModal.querySelector(
    ".modal-backdrop"
  );


if (backdrop) {

  backdrop.addEventListener(
    "click",
    closeModal
  );

}



/* =========================================================
   HELPERS
========================================================= */

function parseSynonyms(
  value
) {

  const unique =
    new Set();


  value
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean)
    .forEach(
      (item) => {

        unique.add(
          item.toLowerCase()
        );

      }
    );


  return [
    ...unique
  ];

}



function setSaving(
  saving
) {

  saveBtn.disabled =
    saving;


  saveBtnText.textContent =
    saving
      ? "Saving..."
      : (
          editDocumentId.value
            ? "Save Changes"
            : "Save Vocabulary"
        );

}



function showFormMessage(
  message,
  type
) {

  formMessage.textContent =
    message;


  formMessage.className =
    `form-message ${type}`;

}



function clearFormMessage() {

  formMessage.textContent =
    "";


  formMessage.className =
    "form-message";

}



function renderLoading() {

  vocabTableBody.innerHTML = `

    <tr>

      <td
        colspan="7"
        class="empty-table"
      >
        Loading vocabulary...
      </td>

    </tr>

  `;

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

/* =========================================================
   VOCABULARY IMPORT CENTER
========================================================= */

let importPreviewRows = [];
let importSourceName = "";


function setupVocabularyImport() {
  const openButtons = [
    $("openImportModalBtn"),
    $("openImportModalBtnSecondary")
  ].filter(Boolean);

  openButtons.forEach((button) => {
    button.addEventListener(
      "click",
      openImportModal
    );
  });

  $("closeImportModalBtn")
    ?.addEventListener(
      "click",
      closeImportModal
    );

  $("cancelImportBtn")
    ?.addEventListener(
      "click",
      closeImportModal
    );

  document
    .querySelectorAll(
      "[data-close-import]"
    )
    .forEach((element) => {
      element.addEventListener(
        "click",
        closeImportModal
      );
    });

  $("vocabImportFile")
    ?.addEventListener(
      "change",
      async (event) => {
        const file =
          event.target.files?.[0];

        if (file) {
          await handleVocabularyImportFile(
            file
          );
        }
      }
    );

  const dropzone =
    $("vocabImportDropzone");

  if (dropzone) {
    [
      "dragenter",
      "dragover"
    ].forEach((eventName) => {
      dropzone.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
          dropzone.classList.add(
            "dragging"
          );
        }
      );
    });

    [
      "dragleave",
      "drop"
    ].forEach((eventName) => {
      dropzone.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
          dropzone.classList.remove(
            "dragging"
          );
        }
      );
    });

    dropzone.addEventListener(
      "drop",
      async (event) => {
        const file =
          event.dataTransfer
            ?.files?.[0];

        if (file) {
          await handleVocabularyImportFile(
            file
          );
        }
      }
    );
  }

  $("confirmImportBtn")
    ?.addEventListener(
      "click",
      importVocabularyRows
    );

  $("downloadCsvTemplateBtn")
    ?.addEventListener(
      "click",
      downloadVocabularyCsvTemplate
    );

  $("downloadJsonTemplateBtn")
    ?.addEventListener(
      "click",
      downloadVocabularyJsonTemplate
    );

  $("downloadExcelTemplateBtn")
    ?.addEventListener(
      "click",
      downloadVocabularyExcelTemplate
    );
}


function openImportModal() {
  resetImportState();

  $("vocabImportModal")
    ?.classList.add(
      "show"
    );

  document.body.style.overflow =
    "hidden";
}


function closeImportModal() {
  $("vocabImportModal")
    ?.classList.remove(
      "show"
    );

  document.body.style.overflow =
    "";
}


function resetImportState() {
  importPreviewRows = [];
  importSourceName = "";

  const fileInput =
    $("vocabImportFile");

  if (fileInput) {
    fileInput.value = "";
  }

  [
    "importFileSummary",
    "importValidationSummary",
    "importOptionsPanel",
    "importPreviewPanel"
  ].forEach((id) => {
    const element = $(id);

    if (element) {
      element.hidden = true;
    }
  });

  const body =
    $("importPreviewBody");

  if (body) {
    body.innerHTML = "";
  }

  const button =
    $("confirmImportBtn");

  if (button) {
    button.disabled = true;
    button.textContent =
      "Import Vocabulary";
  }

  showImportMessage(
    "",
    ""
  );
}


async function handleVocabularyImportFile(
  file
) {
  try {
    showImportMessage(
      "กำลังอ่านไฟล์...",
      "info"
    );

    const extension =
      getFileExtension(
        file.name
      );

    let rawRows = [];

    if (extension === "json") {
      rawRows =
        parseVocabularyJson(
          await file.text()
        );
    } else if (
      extension === "csv"
      || extension === "tsv"
      || extension === "txt"
    ) {
      const text =
        await file.text();

      rawRows =
        parseVocabularyDelimited(
          text,
          extension
        );
    } else if (
      extension === "xlsx"
      || extension === "xls"
      || extension === "ods"
    ) {
      rawRows =
        await parseVocabularyExcel(
          file
        );
    } else {
      throw new Error(
        "Unsupported file type"
      );
    }

    importSourceName =
      file.name;

    importPreviewRows =
      validateVocabularyImportRows(
        rawRows
      );

    renderVocabularyImportPreview(
      file
    );

    showImportMessage(
      importPreviewRows.length
        ? "ตรวจไฟล์เรียบร้อย เลือกวิธีจัดการ Duplicate แล้วกด Import ได้เลย"
        : "ไม่พบข้อมูลที่สามารถ Import ได้",
      importPreviewRows.length
        ? "info"
        : "error"
    );

  } catch (error) {
    console.error(
      "Vocabulary import parse error:",
      error
    );

    importPreviewRows = [];

    showImportMessage(
      getImportErrorMessage(
        error
      ),
      "error"
    );

    const button =
      $("confirmImportBtn");

    if (button) {
      button.disabled = true;
    }
  }
}


function parseVocabularyJson(
  text
) {
  const data =
    JSON.parse(text);

  if (Array.isArray(data)) {
    return data;
  }

  if (
    Array.isArray(
      data.vocabulary
    )
  ) {
    return data.vocabulary;
  }

  if (
    Array.isArray(
      data.words
    )
  ) {
    return data.words;
  }

  if (
    Array.isArray(
      data.data
    )
  ) {
    return data.data;
  }

  throw new Error(
    "JSON must contain an array of vocabulary rows"
  );
}


function parseVocabularyDelimited(
  text,
  extension
) {
  const clean =
    String(text || "")
      .replace(
        /^\uFEFF/,
        ""
      );

  const delimiter =
    extension === "tsv"
      ? "\t"
      : extension === "txt"
        ? (
            clean.includes("\t")
              ? "\t"
              : ","
          )
        : ",";

  const matrix =
    parseDelimitedText(
      clean,
      delimiter
    );

  if (matrix.length < 2) {
    return [];
  }

  const headers =
    matrix[0]
      .map(
        normalizeHeader
      );

  return matrix
    .slice(1)
    .filter(
      (row) =>
        row.some(
          (cell) =>
            String(cell || "")
              .trim()
        )
    )
    .map((row) => {
      const item = {};

      headers.forEach(
        (header, index) => {
          if (header) {
            item[header] =
              row[index] ?? "";
          }
        }
      );

      return item;
    });
}


function parseDelimitedText(
  text,
  delimiter
) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char =
      text[index];

    const next =
      text[index + 1];

    if (char === '"') {
      if (
        quoted
        && next === '"'
      ) {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (
      char === delimiter
      && !quoted
    ) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (char === "\n"
        || char === "\r")
      && !quoted
    ) {
      if (
        char === "\r"
        && next === "\n"
      ) {
        index += 1;
      }

      row.push(cell);
      rows.push(row);

      row = [];
      cell = "";

      continue;
    }

    cell += char;
  }

  if (
    cell.length
    || row.length
  ) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}


async function parseVocabularyExcel(
  file
) {
  if (
    typeof window.XLSX ===
    "undefined"
  ) {
    throw new Error(
      "Excel reader is unavailable. Check internet connection or use CSV/JSON."
    );
  }

  const buffer =
    await file.arrayBuffer();

  const workbook =
    window.XLSX.read(
      buffer,
      {
        type: "array"
      }
    );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const sheet =
    workbook.Sheets[
      sheetName
    ];

  return window.XLSX.utils
    .sheet_to_json(
      sheet,
      {
        defval: "",
        raw: false
      }
    );
}


function validateVocabularyImportRows(
  rows
) {
  const existingMap =
    new Map(
      vocabulary.map(
        (item) => [
          normalizeWordKey(
            item.word
          ),
          item
        ]
      )
    );

  const seenFileWords =
    new Set();

  return rows.map(
    (raw, index) => {
      const item =
        normalizeVocabularyImportRow(
          raw
        );

      const key =
        normalizeWordKey(
          item.word
        );

      let status =
        "valid";

      let reason = "";

      let existingId =
        "";

      if (
        !item.word
        || !item.thai
      ) {
        status =
          "invalid";

        reason =
          !item.word
            ? "Missing English word"
            : "Missing Thai translation";
      } else if (
        seenFileWords.has(key)
      ) {
        status =
          "duplicate";

        reason =
          "Duplicate inside file";
      } else if (
        existingMap.has(key)
      ) {
        status =
          "duplicate";

        reason =
          "Already exists";

        existingId =
          existingMap.get(key).id;
      }

      if (key) {
        seenFileWords.add(key);
      }

      return {
        index:
          index + 1,
        data:
          item,
        status,
        reason,
        existingId
      };
    }
  );
}


function normalizeVocabularyImportRow(
  raw
) {
  const source =
    raw &&
    typeof raw === "object"
      ? raw
      : {};

  const normalized = {};

  Object.entries(source)
    .forEach(
      ([key, value]) => {
        normalized[
          normalizeHeader(key)
        ] = value;
      }
    );

  const word =
    pickImportValue(
      normalized,
      [
        "word",
        "english",
        "englishword",
        "vocabulary",
        "term"
      ]
    );

  const thai =
    pickImportValue(
      normalized,
      [
        "thai",
        "translation",
        "thaitranslation",
        "meaningthai",
        "thaimeaning"
      ]
    );

  const meaning =
    pickImportValue(
      normalized,
      [
        "meaning",
        "definition",
        "englishmeaning",
        "description"
      ]
    );

  const exampleSentence =
    pickImportValue(
      normalized,
      [
        "examplesentence",
        "example",
        "sentence",
        "sample"
      ]
    );

  const synonymValue =
    pickImportRawValue(
      normalized,
      [
        "synonyms",
        "synonym",
        "similarwords",
        "similar"
      ]
    );

  const levelRaw =
    String(
      pickImportValue(
        normalized,
        [
          "level",
          "cefr",
          "difficulty"
        ]
      ) || ""
    )
      .trim()
      .toUpperCase();

  const activeRaw =
    pickImportRawValue(
      normalized,
      [
        "active",
        "status",
        "enabled"
      ]
    );

  return {
    word:
      String(word || "")
        .trim(),
    thai:
      String(thai || "")
        .trim(),
    meaning:
      String(meaning || "")
        .trim(),
    exampleSentence:
      String(
        exampleSentence || ""
      ).trim(),
    synonyms:
      normalizeImportSynonyms(
        synonymValue
      ),
    level:
      [
        "A1",
        "A2",
        "B1",
        "B2",
        "C1",
        "C2"
      ].includes(levelRaw)
        ? levelRaw
        : "",
    active:
      parseImportActive(
        activeRaw
      )
  };
}


function normalizeHeader(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9ก-๙]+/g,
      ""
    );
}


function pickImportValue(
  source,
  keys
) {
  const value =
    pickImportRawValue(
      source,
      keys
    );

  return Array.isArray(value)
    ? value.join(", ")
    : value;
}


function pickImportRawValue(
  source,
  keys
) {
  for (const key of keys) {
    if (
      source[key] !==
      undefined
    ) {
      return source[key];
    }
  }

  return "";
}


function normalizeImportSynonyms(
  value
) {
  const values =
    Array.isArray(value)
      ? value
      : String(value || "")
          .split(
            /[;,|]/g
          );

  return [
    ...new Set(
      values
        .map(
          (item) =>
            String(item || "")
              .trim()
              .toLowerCase()
        )
        .filter(Boolean)
    )
  ];
}


function parseImportActive(
  value
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  const text =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    [
      "false",
      "0",
      "no",
      "inactive",
      "disabled"
    ].includes(text)
  ) {
    return false;
  }

  return true;
}


function renderVocabularyImportPreview(
  file
) {
  const summary =
    $("importFileSummary");

  if (summary) {
    summary.hidden = false;
    summary.textContent =
      file.name +
      " · " +
      formatFileSize(
        file.size
      );
  }

  const valid =
    importPreviewRows.filter(
      (row) =>
        row.status ===
        "valid"
    );

  const duplicate =
    importPreviewRows.filter(
      (row) =>
        row.status ===
        "duplicate"
    );

  const invalid =
    importPreviewRows.filter(
      (row) =>
        row.status ===
        "invalid"
    );

  setImportText(
    "importRowsCount",
    importPreviewRows.length
  );

  setImportText(
    "importValidCount",
    valid.length
  );

  setImportText(
    "importDuplicateCount",
    duplicate.length
  );

  setImportText(
    "importInvalidCount",
    invalid.length
  );

  [
    "importValidationSummary",
    "importOptionsPanel",
    "importPreviewPanel"
  ].forEach((id) => {
    const element = $(id);

    if (element) {
      element.hidden = false;
    }
  });

  setImportText(
    "importPreviewMeta",
    importPreviewRows.length +
      " parsed rows · showing first " +
      Math.min(
        importPreviewRows.length,
        100
      )
  );

  const body =
    $("importPreviewBody");

  if (body) {
    body.innerHTML =
      importPreviewRows
        .slice(
          0,
          100
        )
        .map(
          (row) => {
            const label =
              row.status === "valid"
                ? "Ready"
                : row.status ===
                    "duplicate"
                  ? "Duplicate"
                  : "Invalid";

            return (
              "<tr>" +
                "<td>" +
                  '<span class="import-row-status ' +
                    row.status +
                  '" title="' +
                    escapeHTML(
                      row.reason
                    ) +
                  '">' +
                    label +
                  "</span>" +
                "</td>" +
                "<td><strong>" +
                  escapeHTML(
                    row.data.word ||
                    "—"
                  ) +
                "</strong></td>" +
                "<td>" +
                  escapeHTML(
                    row.data.thai ||
                    "—"
                  ) +
                "</td>" +
                "<td>" +
                  escapeHTML(
                    row.data.meaning ||
                    "—"
                  ) +
                "</td>" +
                "<td>" +
                  escapeHTML(
                    row.data.level ||
                    "—"
                  ) +
                "</td>" +
              "</tr>"
            );
          }
        )
        .join("");
  }

  const button =
    $("confirmImportBtn");

  if (button) {
    button.disabled =
      valid.length === 0
      && duplicate.filter(
        (row) =>
          Boolean(
            row.existingId
          )
      ).length === 0;
  }
}


async function importVocabularyRows() {
  const button =
    $("confirmImportBtn");

  const strategy =
    $("importDuplicateStrategy")
      ?.value ||
    "skip";

  if (
    !button
    || button.disabled
  ) {
    return;
  }

  const importable = [];

  importPreviewRows
    .forEach(
      (row) => {
        if (
          row.status === "invalid"
        ) {
          return;
        }

        if (
          row.status === "duplicate"
          && !row.existingId
        ) {
          return;
        }

        if (
          row.status === "duplicate"
          && strategy === "skip"
        ) {
          return;
        }

        importable.push(row);
      }
    );

  if (!importable.length) {
    showImportMessage(
      "ไม่มีรายการที่จะ Import ตามตัวเลือกปัจจุบัน",
      "error"
    );

    return;
  }

  button.disabled = true;
  button.textContent =
    "Importing...";

  showImportMessage(
    "กำลังบันทึก " +
      importable.length +
      " คำศัพท์...",
    "info"
  );

  try {
    const chunkSize = 400;

    for (
      let start = 0;
      start < importable.length;
      start += chunkSize
    ) {
      const chunk =
        importable.slice(
          start,
          start + chunkSize
        );

      const batch =
        writeBatch(db);

      chunk.forEach(
        (row) => {
          const data = {
            ...row.data,
            importSource:
              importSourceName,
            importedAt:
              serverTimestamp(),
            importedBy:
              currentAdminUid,
            updatedAt:
              serverTimestamp(),
            updatedBy:
              currentAdminUid
          };

          if (
            row.existingId
            && strategy ===
              "update"
          ) {
            batch.update(
              doc(
                db,
                "vocabulary",
                row.existingId
              ),
              data
            );
          } else {
            const reference =
              doc(
                collection(
                  db,
                  "vocabulary"
                )
              );

            batch.set(
              reference,
              {
                ...data,
                createdAt:
                  serverTimestamp(),
                createdBy:
                  currentAdminUid
              }
            );
          }
        }
      );

      await batch.commit();
    }

    showImportMessage(
      "Import สำเร็จ " +
        importable.length +
        " รายการ",
      "success"
    );

    await loadVocabulary();

    window.setTimeout(
      closeImportModal,
      850
    );

  } catch (error) {
    console.error(
      "Vocabulary import write error:",
      error
    );

    showImportMessage(
      "Import ไม่สำเร็จ กรุณาตรวจ Firestore permission หรือรูปแบบข้อมูล",
      "error"
    );

    button.disabled = false;
    button.textContent =
      "Import Vocabulary";
  }
}


function downloadVocabularyCsvTemplate() {
  const rows = [
    [
      "word",
      "thai",
      "meaning",
      "exampleSentence",
      "synonyms",
      "level",
      "active"
    ],
    [
      "consider",
      "พิจารณา",
      "to think carefully about something",
      "We should consider the proposal.",
      "think about;review;examine",
      "B1",
      "true"
    ],
    [
      "negotiate",
      "เจรจา",
      "to discuss in order to reach an agreement",
      "The company will negotiate the contract.",
      "bargain;discuss",
      "B2",
      "true"
    ]
  ];

  const csv =
    rows
      .map(
        (row) =>
          row
            .map(
              csvEscape
            )
            .join(",")
      )
      .join("\n");

  downloadTextFile(
    "onnylab-vocabulary-template.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );
}


function downloadVocabularyJsonTemplate() {
  const rows = [
    {
      word: "consider",
      thai: "พิจารณา",
      meaning:
        "to think carefully about something",
      exampleSentence:
        "We should consider the proposal.",
      synonyms: [
        "think about",
        "review",
        "examine"
      ],
      level: "B1",
      active: true
    },
    {
      word: "negotiate",
      thai: "เจรจา",
      meaning:
        "to discuss in order to reach an agreement",
      exampleSentence:
        "The company will negotiate the contract.",
      synonyms: [
        "bargain",
        "discuss"
      ],
      level: "B2",
      active: true
    }
  ];

  downloadTextFile(
    "onnylab-vocabulary-template.json",
    JSON.stringify(
      rows,
      null,
      2
    ),
    "application/json;charset=utf-8"
  );
}


function downloadVocabularyExcelTemplate() {
  if (
    typeof window.XLSX ===
    "undefined"
  ) {
    showImportMessage(
      "ไม่สามารถโหลด Excel engine ได้ กรุณาใช้ CSV/JSON Template",
      "error"
    );

    return;
  }

  const rows = [
    {
      word: "consider",
      thai: "พิจารณา",
      meaning:
        "to think carefully about something",
      exampleSentence:
        "We should consider the proposal.",
      synonyms:
        "think about;review;examine",
      level: "B1",
      active: true
    },
    {
      word: "negotiate",
      thai: "เจรจา",
      meaning:
        "to discuss in order to reach an agreement",
      exampleSentence:
        "The company will negotiate the contract.",
      synonyms:
        "bargain;discuss",
      level: "B2",
      active: true
    }
  ];

  const sheet =
    window.XLSX.utils
      .json_to_sheet(
        rows
      );

  const workbook =
    window.XLSX.utils
      .book_new();

  window.XLSX.utils
    .book_append_sheet(
      workbook,
      sheet,
      "Vocabulary"
    );

  window.XLSX.writeFile(
    workbook,
    "onnylab-vocabulary-template.xlsx"
  );
}


function downloadTextFile(
  filename,
  content,
  mime
) {
  const blob =
    new Blob(
      [content],
      {
        type: mime
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

  anchor.href = url;
  anchor.download = filename;

  document.body
    .appendChild(
      anchor
    );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}


function csvEscape(
  value
) {
  const text =
    String(value ?? "");

  if (
    /[",\n\r]/.test(text)
  ) {
    return (
      '"' +
      text.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }

  return text;
}


function getFileExtension(
  name
) {
  const parts =
    String(name || "")
      .toLowerCase()
      .split(".");

  return parts.length > 1
    ? parts.pop()
    : "";
}


function normalizeWordKey(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}


function formatFileSize(
  bytes
) {
  const size =
    Number(bytes) || 0;

  if (size < 1024) {
    return size + " B";
  }

  if (size < 1024 * 1024) {
    return (
      (
        size /
        1024
      ).toFixed(1) +
      " KB"
    );
  }

  return (
    (
      size /
      (
        1024 *
        1024
      )
    ).toFixed(1) +
    " MB"
  );
}


function showImportMessage(
  message,
  type
) {
  const element =
    $("importMessage");

  if (!element) return;

  element.textContent =
    message || "";

  element.className =
    "import-message" +
    (
      type
        ? " " + type
        : ""
    );
}


function setImportText(
  id,
  value
) {
  const element =
    $(id);

  if (element) {
    element.textContent =
      value;
  }
}


function getImportErrorMessage(
  error
) {
  const message =
    String(
      error?.message ||
      error ||
      ""
    );

  if (
    message.includes(
      "Unexpected token"
    )
  ) {
    return "ไฟล์ JSON ไม่ถูกต้อง กรุณาตรวจ syntax";
  }

  if (
    message.includes(
      "Excel reader"
    )
  ) {
    return message;
  }

  if (
    message.includes(
      "Unsupported"
    )
  ) {
    return "ไฟล์ประเภทนี้ยังไม่รองรับ";
  }

  return (
    message ||
    "ไม่สามารถอ่านไฟล์ได้"
  );
}


setupVocabularyImport();
