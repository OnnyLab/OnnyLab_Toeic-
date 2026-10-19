import {

  loginWithEmail,

  redirectByRole,

  watchAuth

} from "./auth.js";



document.addEventListener(
  "DOMContentLoaded",
  initLogin
);



function initLogin() {


  /* =========================================================
     DOM
  ========================================================= */

  const loginForm =
    document.getElementById(
      "loginForm"
    );


  const emailInput =
    document.getElementById(
      "email"
    );


  const passwordInput =
    document.getElementById(
      "password"
    );


  const togglePassword =
    document.getElementById(
      "togglePassword"
    );


  const togglePasswordText =
    document.getElementById(
      "togglePasswordText"
    );


  const loginMessage =
    document.getElementById(
      "loginMessage"
    );


  const loginButton =
    document.getElementById(
      "loginButton"
    );


  const loginButtonText =
    document.getElementById(
      "loginButtonText"
    );


  const forgotPasswordBtn =
    document.getElementById(
      "forgotPasswordBtn"
    );


  const signUpBtn =
    document.getElementById(
      "signUpBtn"
    );



  /* =========================================================
     CHECK
  ========================================================= */

  if (
    !loginForm ||
    !emailInput ||
    !passwordInput
  ) {

    console.error(
      "Login form elements not found."
    );


    return;

  }



  /* =========================================================
     CHECK CURRENT SESSION
  ========================================================= */

  let initialAuthCheck =
    false;


  watchAuth(
    async function (user) {


      if (
        initialAuthCheck
      ) {

        return;

      }


      initialAuthCheck =
        true;


      if (user) {


        showMessage(
          "กำลังเข้าสู่ระบบ...",
          "loading"
        );


        try {

          await redirectByRole(
            user
          );


        } catch (error) {

          console.error(
            "Redirect error:",
            error
          );

        }

      }

    }
  );



  /* =========================================================
     SHOW / HIDE PASSWORD
  ========================================================= */

  togglePassword
    ?.addEventListener(
      "click",
      function () {


        const passwordHidden =
          passwordInput.type ===
          "password";


        passwordInput.type =
          passwordHidden
            ? "text"
            : "password";


        if (
          togglePasswordText
        ) {

          togglePasswordText.textContent =
            passwordHidden
              ? "Hide"
              : "Show";

        }


        togglePassword.setAttribute(
          "aria-label",
          passwordHidden
            ? "Hide password"
            : "Show password"
        );

      }
    );



  /* =========================================================
     LOGIN
  ========================================================= */

  loginForm.addEventListener(
    "submit",
    async function (event) {


      event.preventDefault();


      clearMessage();



      const email =
        emailInput.value
          .trim()
          .toLowerCase();


      const password =
        passwordInput.value;



      /* =========================================
         EMAIL VALIDATION
      ========================================== */

      if (!email) {


        showMessage(
          "กรุณากรอกอีเมล",
          "error"
        );


        emailInput.focus();


        return;

      }



      if (
        !isValidEmail(
          email
        )
      ) {


        showMessage(
          "รูปแบบอีเมลไม่ถูกต้อง",
          "error"
        );


        emailInput.focus();


        return;

      }



      /* =========================================
         PASSWORD
      ========================================== */

      if (!password) {


        showMessage(
          "กรุณากรอกรหัสผ่าน",
          "error"
        );


        passwordInput.focus();


        return;

      }



      /* =========================================
         LOADING
      ========================================== */

      setLoading(
        true
      );


      showMessage(
        "กำลังตรวจสอบบัญชี...",
        "loading"
      );



      try {


        const result =
          await loginWithEmail(
            email,
            password
          );



        if (
          !result.success
        ) {


          setLoading(
            false
          );


          showMessage(
            result.message ||
            "เข้าสู่ระบบไม่สำเร็จ",
            "error"
          );


          passwordInput.select();


          return;

        }



        /* =========================================
           SUCCESS
        ========================================== */

        showMessage(
          "เข้าสู่ระบบสำเร็จ",
          "success"
        );


        setTimeout(
          async function () {


            try {


              await redirectByRole(
                result.user
              );


            } catch (error) {


              console.error(
                "Redirect error:",
                error
              );


              setLoading(
                false
              );


              showMessage(
                "ไม่สามารถเปิด Dashboard ได้",
                "error"
              );

            }


          },
          250
        );


      } catch (error) {


        console.error(
          "Login error:",
          error
        );


        setLoading(
          false
        );


        showMessage(
          "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
          "error"
        );

      }

    }
  );



  /* =========================================================
     FORGOT PASSWORD
     ตอนนี้เป็น UI เตรียมไว้ก่อน
  ========================================================= */

  forgotPasswordBtn
    ?.addEventListener(
      "click",
      function () {


        const email =
          emailInput.value
            .trim();


        if (!email) {


          showMessage(
            "กรอก Email ก่อน แล้วค่อยกด Forgot password",
            "error"
          );


          emailInput.focus();


          return;

        }


        showMessage(
          "ระบบ Reset Password จะเพิ่มในขั้นถัดไป",
          "loading"
        );

      }
    );



  /* =========================================================
     SIGN UP
  ========================================================= */

  signUpBtn
    ?.addEventListener(
      "click",
      function () {


        /*
          ถ้ามี register.html
          สามารถเปลี่ยนเป็น:

          window.location.href =
            "./register.html";
        */


        showMessage(
          "ระบบ Sign Up จะเพิ่มในขั้นถัดไป",
          "loading"
        );

      }
    );



  /* =========================================================
     MESSAGE
  ========================================================= */

  function showMessage(
    text,
    type = ""
  ) {


    if (
      !loginMessage
    ) {

      return;

    }


    loginMessage.textContent =
      text;


    loginMessage.dataset.type =
      type;


    loginMessage.classList.remove(
      "error",
      "success",
      "loading"
    );


    if (type) {


      loginMessage.classList.add(
        type
      );

    }

  }



  function clearMessage() {


    if (
      !loginMessage
    ) {

      return;

    }


    loginMessage.textContent =
      "";


    loginMessage.dataset.type =
      "";


    loginMessage.classList.remove(
      "error",
      "success",
      "loading"
    );

  }



  /* =========================================================
     LOADING
  ========================================================= */

  function setLoading(
    loading
  ) {


    if (
      loginButton
    ) {


      loginButton.disabled =
        loading;


      loginButton.classList.toggle(
        "is-loading",
        loading
      );

    }


    if (
      loginButtonText
    ) {


      loginButtonText.textContent =
        loading
          ? "SIGNING IN..."
          : "SIGN IN & PLAY";

    }


    emailInput.disabled =
      loading;


    passwordInput.disabled =
      loading;


    if (
      togglePassword
    ) {


      togglePassword.disabled =
        loading;

    }


    if (
      forgotPasswordBtn
    ) {


      forgotPasswordBtn.disabled =
        loading;

    }


    if (
      signUpBtn
    ) {


      signUpBtn.disabled =
        loading;

    }

  }

}



/* =========================================================
   EMAIL VALIDATION
========================================================= */

function isValidEmail(
  email
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      email
    );

}