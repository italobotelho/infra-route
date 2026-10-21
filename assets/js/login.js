document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("form-login");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("email")?.value.trim();
      const senha = document.getElementById("senha")?.value;

      if (!email || !senha) {
        return;
      }

      sessionStorage.setItem("infraroute_user", JSON.stringify({ email }));
      window.location.href = "index.html";
    });
  }
});
