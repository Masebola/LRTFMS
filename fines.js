/**
 * Fines Management Page Logic
 * Limpopo Road Traffic Fine Management System
 */

let currentOfficer = null;

// Check authentication
async function checkAuth() {
  const user = await getCurrentOfficer();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// Load drivers into dropdown
async function loadDriversDropdown() {
  try {
    const { data: drivers, error } = await supabaseClient
      .from('drivers')
      .select('id, full_name, id_number')
      .order('full_name', { ascending: true });

    if (error) throw error;

    const select = document.getElementById('qDriver');
    select.innerHTML = '<option value="">-- Select Driver --</option>';

    drivers.forEach(driver => {
      const option = document.createElement('option');
      option.value = driver.id;
      option.textContent = `${driver.full_name} (${driver.id_number})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading drivers:', error);
    showToast('Failed to load drivers list', 'error');
  }
}

// Update fine amount based on selected offense
function updateFineAmount() {
  const select = document.getElementById('qOffense');
  const selectedOption = select.options[select.selectedIndex];
  const amount = selectedOption.dataset.amount;
  if (amount) {
    document.getElementById('qAmount').value = amount;
  }
}

// Issue new fine
async function issueFine(e) {
  e.preventDefault();

  const driverId = document.getElementById('qDriver').value;
  const offense = document.getElementById('qOffense').value;
  const amount = document.getElementById('qAmount').value;
  const location = document.getElementById('qLocation').value;
  const offenseDate = document.getElementById('qDate').value;

  if (!driverId || !offense || !amount || !location || !offenseDate) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    // Generate fine number
    const fineNumber = await generateSequentialNumber('FIN', 'fines', 'fine_number');

    // Get officer ID from auth user
    const { data: officerData } = await supabaseClient
      .from('officers')
      .select('id')
      .eq('id', currentOfficer.id)
      .single();

    const { data: fine, error } = await supabaseClient
      .from('fines')
      .insert([{
        fine_number: fineNumber,
        driver_id: driverId,
        officer_id: officerData?.id || null,
        offense: offense,
        amount: parseFloat(amount),
        location: location,
        offense_date: offenseDate,
        status: 'unpaid'
      }])
      .select(`
        fine_number,
        offense,
        amount,
        location,
        offense_date,
        drivers!inner(full_name, id_number)
      `)
      .single();

    if (error) throw error;

    // Display fine record
    const formattedDate = new Date(fine.offense_date).toLocaleDateString('en-ZA', { 
      day: '2-digit', month: 'short', year: 'numeric' 
    });

    document.getElementById('fineRecordContent').innerHTML = `
      <div class="fine-detail">
        <span>Fine ID:</span>
        <span>${fine.fine_number}</span>
      </div>
      <div class="fine-detail">
        <span>Driver:</span>
        <span>${fine.drivers.full_name} (${fine.drivers.id_number})</span>
      </div>
      <div class="fine-detail">
        <span>Offense:</span>
        <span>${fine.offense}</span>
      </div>
      <div class="fine-detail">
        <span>Amount:</span>
        <span>${formatCurrency(fine.amount)}</span>
      </div>
      <div class="fine-detail">
        <span>Location:</span>
        <span>${fine.location}</span>
      </div>
      <div class="fine-detail">
        <span>Date:</span>
        <span>${formattedDate}</span>
      </div>
      <div class="fine-detail">
        <span>Issued By:</span>
        <span>${currentOfficer.user_metadata?.full_name || currentOfficer.email}</span>
      </div>
    `;
    document.getElementById('fineRecordDisplay').classList.remove('hidden');

    // Reset form
    document.getElementById('quickFineForm').reset();
    document.getElementById('qDate').valueAsDate = new Date();
    
    // Refresh fines table
    await loadFines();
    
    showToast('Fine issued successfully', 'success');
  } catch (error) {
    console.error('Error issuing fine:', error);
    showToast('Failed to issue fine', 'error');
  }
}

// Load fines into table
async function loadFines() {
  try {
    const { data: fines, error } = await supabaseClient
      .from('fines')
      .select(`
        id,
        fine_number,
        offense,
        amount,
        offense_date,
        status,
        drivers!inner(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('finesTable');
    tbody.innerHTML = '';

    if (fines.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No fines issued yet.</td></tr>`;
      return;
    }

    fines.forEach(fine => {
      const row = document.createElement('tr');
      row.dataset.status = fine.status;
      row.dataset.driver = fine.drivers.full_name.toLowerCase();
      
      const formattedDate = new Date(fine.offense_date).toLocaleDateString('en-ZA', { 
        day: '2-digit', month: 'short', year: 'numeric' 
      });

      let statusClass = '';
      let statusText = '';
      if (fine.status === 'unpaid') {
        statusClass = 'status-unpaid';
        statusText = 'Unpaid';
      } else if (fine.status === 'paid') {
        statusClass = 'status-paid';
        statusText = 'Paid';
      } else if (fine.status === 'pending') {
        statusClass = 'status-pending';
        statusText = 'Under Appeal';
      }

      let actionButton = '';
      if (fine.status === 'unpaid') {
        actionButton = `<button class="btn btn-sm btn-success" onclick="markAsPaid('${fine.id}', this)">Mark Paid</button>`;
      } else if (fine.status === 'paid') {
        actionButton = `<button class="btn btn-sm btn-primary" disabled>Paid</button>`;
      } else {
        actionButton = `<button class="btn btn-sm btn-primary" disabled>Pending</button>`;
      }

      row.innerHTML = `
        <td>${fine.fine_number}</td>
        <td>${fine.drivers.full_name}</td>
        <td>${fine.offense}</td>
        <td>${formatCurrency(fine.amount)}</td>
        <td>${formattedDate}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>${actionButton}</td>
      `;
      tbody.appendChild(row);
    });

    // Re-apply filters if any
    filterFines();
  } catch (error) {
    console.error('Error loading fines:', error);
    showToast('Failed to load fines', 'error');
  }
}

// Mark fine as paid (simulated payment)
async function markAsPaid(fineId, btn) {
  try {
    // Update fine status
    const { error: updateError } = await supabaseClient
      .from('fines')
      .update({ status: 'paid' })
      .eq('id', fineId);

    if (updateError) throw updateError;

    // Insert payment record
    const { data: fine } = await supabaseClient
      .from('fines')
      .select('amount')
      .eq('id', fineId)
      .single();

    await supabaseClient
      .from('payments')
      .insert([{
        fine_id: fineId,
        amount: fine.amount,
        payment_method: 'simulated',
        transaction_ref: `SIM-${Date.now()}`
      }]);

    // Update UI
    const row = btn.closest('tr');
    row.dataset.status = 'paid';
    row.querySelector('.status').className = 'status status-paid';
    row.querySelector('.status').textContent = 'Paid';
    btn.textContent = 'Paid';
    btn.disabled = true;
    btn.className = 'btn btn-sm btn-primary';

    showToast('Fine marked as paid successfully', 'success');
  } catch (error) {
    console.error('Error marking fine as paid:', error);
    showToast('Failed to mark fine as paid', 'error');
  }
}

// Filter fines table
function filterFines() {
  const statusFilter = document.getElementById('filterStatus').value;
  const driverFilter = document.getElementById('filterDriver').value.toLowerCase();
  const rows = document.querySelectorAll('#finesTable tr');

  rows.forEach(row => {
    const status = row.dataset.status;
    const driver = row.dataset.driver;

    const statusMatch = statusFilter === 'all' || status === statusFilter;
    const driverMatch = !driverFilter || driver.includes(driverFilter);

    row.style.display = statusMatch && driverMatch ? '' : 'none';
  });
}

// Print fine record
function printFine() {
  window.print();
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
  currentOfficer = user;

  // Display officer name
  const officerName = user.user_metadata?.full_name || user.email.split('@')[0];
  document.getElementById('officerName').textContent = 'Officer: ' + officerName;

  // Set default date to today
  document.getElementById('qDate').valueAsDate = new Date();

  // Load drivers dropdown
  await loadDriversDropdown();

  // Load fines table
  await loadFines();

  // Attach event listeners
  document.getElementById('quickFineForm').addEventListener('submit', issueFine);
  document.getElementById('qOffense').addEventListener('change', updateFineAmount);
  document.getElementById('filterStatus').addEventListener('change', filterFines);
  document.getElementById('filterDriver').addEventListener('input', filterFines);
});