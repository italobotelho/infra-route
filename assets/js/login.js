document.addEventListener('DOMContentLoaded', () =>; { 
  const loginForm = document.getElementById('loginForm'); 
  
  if (loginForm) { 
    loginForm.addEventListener('submit', (e) => { 
      e.preventDefault(); 
      
      const email = document.getElementById('email').value; 
      const password = document.getElementById('password').value; 
      const crea = document.getElementById('crea').value; 
      
      console.log('Dados do Login para autenticação:', { email, password, crea }); 
      
      alert(`Autenticando no InfraRoute...\nE-mail: ${email}\nCREA: ${crea}`); 
    }); 
  } 
});
