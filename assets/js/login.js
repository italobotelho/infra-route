document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('form-login');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('email')?.value;
      const senha = document.getElementById('senha')?.value;

      console.log('Dados do Login para autenticação:', { email, senha });

      alert(`Autenticando no InfraRoute...\nE-mail: ${email}`);
      window.location.href = 'index.html';
    });
  }
});
