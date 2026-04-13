document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');

  if (!username || !password) {
    errorDiv.textContent = 'Please enter both username and password';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!supabaseClient || !supabaseClient.auth) {
    errorDiv.textContent = 'System configuration error. Please contact support.';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const email = username.includes('@') ? username : `${username}@limpopo.gov.za`;
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    sessionStorage.setItem('officerLoggedIn', 'true');
    sessionStorage.setItem('officerName', data.user.user_metadata?.full_name || username);
    window.location.href = 'dashboard.html';
  } catch (error) {
    errorDiv.textContent = error.message || 'Invalid login credentials';
    errorDiv.classList.remove('hidden');
  }
});

// Mobile menu functions
function toggleMenu() {
  document.getElementById('mainNav').classList.toggle('active');
  document.getElementById('navOverlay').classList.toggle('active');
  document.body.style.overflow = document.getElementById('mainNav').classList.contains('active') ? 'hidden' : '';
}

function closeMenu() {
  document.getElementById('mainNav').classList.remove('active');
  document.getElementById('navOverlay').classList.remove('active');
  document.body.style.overflow = '';
}