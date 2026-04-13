/**
 * Driver Login Page Logic
 * Limpopo Road Traffic Fine Management System
 */

document.getElementById('driverLoginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const idNumber = document.getElementById('idNumber').value.trim();
  const licenseNumber = document.getElementById('licenseNumber').value.trim();
  const errorDiv = document.getElementById('loginError');

  if (!idNumber || !licenseNumber) {
    errorDiv.textContent = 'Please enter both ID Number and License Number';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!validateIDNumber(idNumber)) {
    errorDiv.textContent = 'ID Number must be exactly 13 digits';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    // Check if driver exists in database
    const { data: driver, error } = await supabaseClient
      .from('drivers')
      .select('id, full_name, id_number, license_number')
      .eq('id_number', idNumber)
      .eq('license_number', licenseNumber)
      .single();

    if (error || !driver) {
      errorDiv.textContent = 'Invalid ID Number or License Number. Please try again.';
      errorDiv.classList.remove('hidden');
      return;
    }

    // Store driver session
    sessionStorage.setItem('driverLoggedIn', 'true');
    sessionStorage.setItem('driverId', driver.id);
    sessionStorage.setItem('driverName', driver.full_name);
    sessionStorage.setItem('driverIdNumber', driver.id_number);
    
    // Redirect to driver portal
    window.location.href = 'driver-portal.html';
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'An error occurred. Please try again.';
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