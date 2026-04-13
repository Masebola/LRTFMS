/**
 * Driver Portal Page Logic
 * Limpopo Road Traffic Fine Management System
 */

let currentDriver = null;

// Check driver login
function checkDriverAuth() {
  const loggedIn = sessionStorage.getItem('driverLoggedIn');
  if (!loggedIn) {
    window.location.href = 'driver-login.html';
    return false;
  }
  currentDriver = {
    id: sessionStorage.getItem('driverId'),
    name: sessionStorage.getItem('driverName'),
    idNumber: sessionStorage.getItem('driverIdNumber')
  };
  return true;
}

// Load driver's fines
async function loadDriverFines() {
  try {
    const { data: fines, error } = await supabaseClient
      .from('fines')
      .select('*')
      .eq('driver_id', currentDriver.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('driverFinesTable');
    tbody.innerHTML = '';

    let totalOwed = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    if (fines.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No fines on record.</td></tr>`;
    } else {
      fines.forEach(fine => {
        const formattedDate = new Date(fine.offense_date).toLocaleDateString('en-ZA', {
          day: '2-digit', month: 'short', year: 'numeric'
        });

        let statusClass = fine.status === 'paid' ? 'status-paid' : 
                         fine.status === 'unpaid' ? 'status-unpaid' : 'status-pending';
        let statusText = fine.status.charAt(0).toUpperCase() + fine.status.slice(1);

        let actionBtn = '';
        if (fine.status === 'unpaid') {
          actionBtn = `<button class="btn btn-sm btn-gold" onclick="openAppealModal('${fine.id}')">Appeal</button>`;
          unpaidCount++;
          totalOwed += parseFloat(fine.amount);
        } else if (fine.status === 'paid') {
          actionBtn = `<span style="color: var(--text-muted); font-size: 0.875rem;">—</span>`;
          paidCount++;
        } else {
          actionBtn = `<span style="color: var(--text-muted); font-size: 0.875rem;">Under Appeal</span>`;
          unpaidCount++;
          totalOwed += parseFloat(fine.amount);
        }

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${fine.fine_number}</td>
          <td>${formattedDate}</td>
          <td>${fine.offense}</td>
          <td>${fine.location}</td>
          <td>${formatCurrency(fine.amount)}</td>
          <td><span class="status ${statusClass}">${statusText}</span></td>
          <td>${actionBtn}</td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById('totalDriverFines').textContent = fines.length;
    document.getElementById('paidDriverFines').textContent = paidCount;
    document.getElementById('unpaidDriverFines').textContent = unpaidCount;
    document.getElementById('totalOwed').textContent = formatCurrency(totalOwed);
  } catch (error) {
    console.error('Error loading fines:', error);
    showToast('Failed to load your fines', 'error');
  }
}

// Load driver's appeals
async function loadDriverAppeals() {
  try {
    const { data: appeals, error } = await supabaseClient
      .from('appeals')
      .select(`
        appeal_number,
        reason,
        status,
        submitted_at,
        fines!inner(fine_number)
      `)
      .eq('driver_id', currentDriver.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('driverAppealsTable');
    const noAppealsDiv = document.getElementById('noAppeals');
    
    if (appeals.length === 0) {
      tbody.innerHTML = '';
      noAppealsDiv.classList.remove('hidden');
      return;
    }

    noAppealsDiv.classList.add('hidden');
    tbody.innerHTML = '';

    appeals.forEach(appeal => {
      const submittedDate = new Date(appeal.submitted_at).toLocaleDateString('en-ZA', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      let statusClass = appeal.status === 'pending' ? 'status-pending' :
                        appeal.status === 'approved' ? 'status-approved' : 'status-rejected';
      let statusText = appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1);
      let responseText = appeal.status === 'pending' ? 'Pending' :
                         appeal.status === 'approved' ? 'Fine cancelled' : 'Appeal denied';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${appeal.appeal_number}</td>
        <td>${appeal.fines.fine_number}</td>
        <td>${appeal.reason}</td>
        <td>${submittedDate}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td><span style="color: ${appeal.status === 'approved' ? 'var(--success)' : 'var(--text-muted)'}; font-size: 0.875rem;">${responseText}</span></td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading appeals:', error);
    showToast('Failed to load appeals', 'error');
  }
}

// Open quick appeal modal
let currentFineId = '';
function openAppealModal(fineId) {
  currentFineId = fineId;
  document.getElementById('modalFineId').textContent = fineId;
  openModal('appealModal');
}

// Submit quick appeal from modal
async function submitQuickAppeal() {
  const reason = document.getElementById('quickAppealReason').value;
  const details = document.getElementById('quickAppealDetails').value;

  if (!reason || !details) {
    showToast('Please provide a reason and explanation', 'error');
    return;
  }

  try {
    // Generate appeal number
    const appealNumber = await generateSequentialNumber('APL', 'appeals', 'appeal_number');

    const { error } = await supabaseClient
      .from('appeals')
      .insert([{
        appeal_number: appealNumber,
        fine_id: currentFineId,
        driver_id: currentDriver.id,
        reason: reason,
        details: details,
        status: 'pending'
      }]);

    if (error) throw error;

    closeModal('appealModal');
    showToast('Appeal submitted successfully! Reference: ' + appealNumber, 'success');
    
    // Refresh fines and appeals
    await loadDriverFines();
    await loadDriverAppeals();
    
    // Reset modal form
    document.getElementById('quickAppealReason').value = '';
    document.getElementById('quickAppealDetails').value = '';
  } catch (error) {
    console.error('Error submitting appeal:', error);
    showToast('Failed to submit appeal', 'error');
  }
}

// Submit new appeal from full form
async function submitFullAppeal(e) {
  e.preventDefault();

  const fineId = document.getElementById('fineId').value.trim();
  const reason = document.getElementById('appealReason').value;
  const details = document.getElementById('appealDetails').value;
  const contactNumber = document.getElementById('contactNumber').value.trim();
  const email = document.getElementById('email').value.trim();

  if (!fineId || !reason || !details || !contactNumber || !email) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    // Verify the fine belongs to this driver
    const { data: fine, error: fineError } = await supabaseClient
      .from('fines')
      .select('id, status')
      .eq('fine_number', fineId)
      .eq('driver_id', currentDriver.id)
      .single();

    if (fineError || !fine) {
      showToast('Fine not found or does not belong to you', 'error');
      return;
    }

    if (fine.status !== 'unpaid') {
      showToast('This fine cannot be appealed (already paid or under appeal)', 'error');
      return;
    }

    const appealNumber = await generateSequentialNumber('APL', 'appeals', 'appeal_number');

    const { error } = await supabaseClient
      .from('appeals')
      .insert([{
        appeal_number: appealNumber,
        fine_id: fine.id,
        driver_id: currentDriver.id,
        reason: reason,
        details: details,
        status: 'pending'
      }]);

    if (error) throw error;

    document.getElementById('appealRef').textContent = appealNumber;
    document.getElementById('appealSuccess').classList.remove('hidden');
    document.getElementById('appealForm').reset();

    await loadDriverFines();
    await loadDriverAppeals();
    
    showToast('Appeal submitted successfully', 'success');
  } catch (error) {
    console.error('Error submitting appeal:', error);
    showToast('Failed to submit appeal', 'error');
  }
}

// Section navigation
function showSection(section) {
  document.querySelectorAll('.portal-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(section + '-section').classList.remove('hidden');
  
  document.querySelectorAll('.dashboard-nav .nav-link').forEach(link => {
    link.classList.remove('active');
  });
  event.target.classList.add('active');
}

// Logout
function logout() {
  sessionStorage.removeItem('driverLoggedIn');
  sessionStorage.removeItem('driverId');
  sessionStorage.removeItem('driverName');
  sessionStorage.removeItem('driverIdNumber');
  window.location.href = 'index.html';
}

// Mobile menu
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
  if (!checkDriverAuth()) return;

  // Display driver info
  const maskedId = currentDriver.idNumber.substring(0, 6) + '****' + currentDriver.idNumber.substring(10);
  document.getElementById('driverInfo').textContent = `${currentDriver.name} (${maskedId})`;

  // Load data
  await loadDriverFines();
  await loadDriverAppeals();

  // Set up form submission
  document.getElementById('appealForm').addEventListener('submit', submitFullAppeal);

  // Expose functions to global scope
  window.openAppealModal = openAppealModal;
  window.submitQuickAppeal = submitQuickAppeal;
  window.showSection = showSection;
  window.logout = logout;
  window.toggleMenu = toggleMenu;
  window.closeMenu = closeMenu;
});