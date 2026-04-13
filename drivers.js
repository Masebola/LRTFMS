/**
 * Drivers Management Page Logic
 * Limpopo Road Traffic Fine Management System
 */

// Check authentication and get current officer
async function checkAuth() {
  const user = await getCurrentOfficer();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// Load and display all drivers
async function loadDrivers() {
  try {
    const { data: drivers, error } = await supabaseClient
      .from('drivers')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;

    const tbody = document.getElementById('driversTable');
    tbody.innerHTML = '';

    if (drivers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No drivers registered yet.</td></tr>`;
      return;
    }

    drivers.forEach(driver => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${driver.full_name}</td>
        <td>${driver.id_number}</td>
        <td>${driver.license_number}</td>
        <td>${driver.phone || '—'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewDriver('${driver.id}')">View</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading drivers:', error);
    showToast('Failed to load drivers', 'error');
  }
}

// View driver details in modal
async function viewDriver(driverId) {
  try {
    const { data: driver, error } = await supabaseClient
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (error) throw error;

    // Also fetch fines count for this driver
    const { count: finesCount, error: finesError } = await supabaseClient
      .from('fines')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId);

    if (finesError) console.warn('Could not fetch fines count:', finesError);

    const detailsDiv = document.getElementById('driverDetails');
    detailsDiv.innerHTML = `
      <div class="fine-record">
        <div class="fine-detail">
          <span>Full Name:</span>
          <span>${driver.full_name}</span>
        </div>
        <div class="fine-detail">
          <span>ID Number:</span>
          <span>${driver.id_number}</span>
        </div>
        <div class="fine-detail">
          <span>License Number:</span>
          <span>${driver.license_number}</span>
        </div>
        <div class="fine-detail">
          <span>Phone:</span>
          <span>${driver.phone || '—'}</span>
        </div>
        <div class="fine-detail">
          <span>Email:</span>
          <span>${driver.email || '—'}</span>
        </div>
        <div class="fine-detail">
          <span>Address:</span>
          <span>${driver.address || '—'}</span>
        </div>
        <div class="fine-detail">
          <span>Registered:</span>
          <span>${new Date(driver.created_at).toLocaleDateString('en-ZA')}</span>
        </div>
        <div class="fine-detail">
          <span>Total Fines:</span>
          <span>${finesCount || 0}</span>
        </div>
      </div>
    `;
    openModal('viewDriverModal');
  } catch (error) {
    console.error('Error viewing driver:', error);
    showToast('Failed to load driver details', 'error');
  }
}

// Add new driver
async function addDriver() {
  const name = document.getElementById('driverName').value.trim();
  const idNumber = document.getElementById('idNumber').value.trim();
  const license = document.getElementById('licenseNumber').value.trim();
  const phone = document.getElementById('contactNumber').value.trim();
  const email = document.getElementById('email').value.trim();
  const address = document.getElementById('address').value.trim();

  // Basic validation
  if (!name || !idNumber || !license || !phone) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  if (!validateIDNumber(idNumber)) {
    showToast('ID Number must be exactly 13 digits', 'error');
    return;
  }

  if (!validatePhoneNumber(phone)) {
    showToast('Phone number must be 10 digits starting with 0', 'error');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('drivers')
      .insert([{
        full_name: name,
        id_number: idNumber,
        license_number: license,
        phone: phone,
        email: email || null,
        address: address || null
      }])
      .select();

    if (error) {
      // Check for duplicate key violation
      if (error.code === '23505') {
        if (error.message.includes('id_number')) {
          showToast('A driver with this ID Number already exists', 'error');
        } else if (error.message.includes('license_number')) {
          showToast('A driver with this License Number already exists', 'error');
        } else {
          showToast('Duplicate entry error', 'error');
        }
      } else {
        throw error;
      }
      return;
    }

    // Reset form and close modal
    document.getElementById('addDriverForm').reset();
    closeModal('addDriverModal');
    showToast('Driver added successfully', 'success');
    
    // Refresh the drivers list
    await loadDrivers();
  } catch (error) {
    console.error('Error adding driver:', error);
    showToast('Failed to add driver', 'error');
  }
}

// Search/filter drivers
function searchDrivers() {
  const searchTerm = document.getElementById('searchDriver').value.toLowerCase();
  const rows = document.querySelectorAll('#driversTable tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

// Logout function
function logout() {
  supabaseClient.auth.signOut().then(() => {
    sessionStorage.removeItem('officerLoggedIn');
    sessionStorage.removeItem('officerName');
    window.location.href = 'index.html';
  });
}

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

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  // Display officer name
  const officerName = user.user_metadata?.full_name || user.email.split('@')[0];
  document.getElementById('officerName').textContent = 'Officer: ' + officerName;

  // Load drivers list
  await loadDrivers();

  // Set up search input listener
  document.getElementById('searchDriver').addEventListener('input', searchDrivers);

  // Set up add driver form submission
  document.getElementById('addDriverForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addDriver();
  });
});