/**
 * Officer Appeals Management Page Logic
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

// Load all appeals
async function loadAppeals() {
  try {
    const { data: appeals, error } = await supabaseClient
      .from('appeals')
      .select(`
        id,
        appeal_number,
        reason,
        details,
        status,
        submitted_at,
        reviewed_at,
        fines!inner(fine_number),
        drivers!inner(full_name, id_number)
      `)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    const tbody = document.querySelector('#appealsTable tbody');
    tbody.innerHTML = '';

    if (appeals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No appeals submitted yet.</td></tr>`;
      updateStats(0, 0, 0, 0);
      return;
    }

    let pending = 0, approved = 0, rejected = 0;

    appeals.forEach(appeal => {
      if (appeal.status === 'pending') pending++;
      else if (appeal.status === 'approved') approved++;
      else if (appeal.status === 'rejected') rejected++;

      const row = document.createElement('tr');
      row.dataset.status = appeal.status;
      row.dataset.appealId = appeal.id; // <-- allows us to find the row later

      const submittedDate = new Date(appeal.submitted_at).toLocaleDateString('en-ZA', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      let statusClass = '';
      let statusText = '';
      if (appeal.status === 'pending') {
        statusClass = 'status-pending';
        statusText = 'Under Review';
      } else if (appeal.status === 'approved') {
        statusClass = 'status-approved';
        statusText = 'Approved';
      } else {
        statusClass = 'status-rejected';
        statusText = 'Rejected';
      }

      // Build actions column
      let actions = '';
      if (appeal.status === 'pending') {
        actions += `
          <button class="btn btn-sm btn-success" onclick="approveAppeal('${appeal.id}', this)">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="rejectAppeal('${appeal.id}', this)">Reject</button>
        `;
      } else {
        actions += `<span style="color: var(--text-muted); font-size: 0.875rem;">Processed</span>`;
      }
      // View details button (always shown)
      actions += ` <button class="btn btn-sm btn-primary" onclick="viewAppealDetails('${appeal.id}')">View Details</button>`;

      // Mask ID number
      const idNumber = appeal.drivers.id_number;
      const maskedId = idNumber.substring(0, 6) + '****' + idNumber.substring(10);

      row.innerHTML = `
        <td>${appeal.appeal_number}</td>
        <td>${appeal.fines.fine_number}</td>
        <td>${appeal.drivers.full_name}</td>
        <td>${maskedId}</td>
        <td>${appeal.reason}</td>
        <td>${submittedDate}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>${actions}</td>
      `;

      // Store additional data on the row for the details modal
      row.dataset.details = appeal.details || '';
      row.dataset.appealNumber = appeal.appeal_number;
      row.dataset.reason = appeal.reason;
      row.dataset.driverName = appeal.drivers.full_name;
      row.dataset.fineNumber = appeal.fines.fine_number;
      row.dataset.submittedDate = submittedDate;
      row.dataset.status = appeal.status;

      tbody.appendChild(row);
    });

    updateStats(appeals.length, pending, approved, rejected);
    filterAppeals(); // Apply any active filters
  } catch (error) {
    console.error('Error loading appeals:', error);
    showToast('Failed to load appeals', 'error');
  }
}

// Show appeal details in modal
function viewAppealDetails(appealId) {
  const row = document.querySelector(`tr[data-appeal-id="${appealId}"]`);
  if (!row) return;

  const details = row.dataset.details || 'No explanation provided.';
  const appealNumber = row.dataset.appealNumber;
  const reason = row.dataset.reason;
  const driverName = row.dataset.driverName;
  const fineNumber = row.dataset.fineNumber;
  const submittedDate = row.dataset.submittedDate;
  const status = row.dataset.status;

  const content = document.getElementById('appealDetailContent');
  content.innerHTML = `
    <div class="fine-record">
      <div class="fine-detail"><span>Appeal ID:</span><span>${appealNumber}</span></div>
      <div class="fine-detail"><span>Fine ID:</span><span>${fineNumber}</span></div>
      <div class="fine-detail"><span>Driver:</span><span>${driverName}</span></div>
      <div class="fine-detail"><span>Reason:</span><span>${reason}</span></div>
      <div class="fine-detail"><span>Status:</span><span>${status}</span></div>
      <div class="fine-detail"><span>Submitted:</span><span>${submittedDate}</span></div>
      <div class="fine-detail" style="flex-direction: column; align-items: flex-start;">
        <span>Detailed Explanation:</span>
        <p style="margin-top: 0.5rem; white-space: pre-wrap; font-weight: normal;">${details}</p>
      </div>
    </div>
  `;
  openModal('appealDetailModal');
}

// Approve an appeal
async function approveAppeal(appealId, btn) {
  try {
    const { data: officerData } = await supabaseClient
      .from('officers')
      .select('id')
      .eq('id', currentOfficer.id)
      .single();

    const { error: appealError } = await supabaseClient
      .from('appeals')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewer_id: officerData?.id
      })
      .eq('id', appealId);

    if (appealError) throw appealError;

    showToast('Appeal approved successfully', 'success');
    await loadAppeals();
  } catch (error) {
    console.error('Error approving appeal:', error);
    showToast('Failed to approve appeal', 'error');
  }
}

// Reject an appeal
async function rejectAppeal(appealId, btn) {
  try {
    const { data: officerData } = await supabaseClient
      .from('officers')
      .select('id')
      .eq('id', currentOfficer.id)
      .single();

    const { error } = await supabaseClient
      .from('appeals')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewer_id: officerData?.id
      })
      .eq('id', appealId);

    if (error) throw error;

    showToast('Appeal rejected', 'warning');
    await loadAppeals();
  } catch (error) {
    console.error('Error rejecting appeal:', error);
    showToast('Failed to reject appeal', 'error');
  }
}

// Update statistics cards
function updateStats(total, pending, approved, rejected) {
  document.getElementById('totalAppeals').textContent = total;
  document.getElementById('pendingAppeals').textContent = pending;
  document.getElementById('approvedAppeals').textContent = approved;
  document.getElementById('rejectedAppeals').textContent = rejected;
}

// Filter appeals
function filterAppeals() {
  const statusFilter = document.getElementById('statusFilter').value;
  const searchTerm = document.getElementById('searchAppeal').value.toLowerCase();
  const rows = document.querySelectorAll('#appealsTable tbody tr');

  rows.forEach(row => {
    const status = row.dataset.status;
    const text = row.textContent.toLowerCase();

    const statusMatch = !statusFilter || status === statusFilter;
    const searchMatch = !searchTerm || text.includes(searchTerm);

    row.style.display = (statusMatch && searchMatch) ? '' : 'none';
  });
}

// Logout
function logout() {
  supabaseClient.auth.signOut().then(() => {
    sessionStorage.removeItem('officerLoggedIn');
    sessionStorage.removeItem('officerName');
    window.location.href = 'index.html';
  });
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
  const user = await checkAuth();
  if (!user) return;
  currentOfficer = user;

  const officerName = user.user_metadata?.full_name || user.email.split('@')[0];
  document.getElementById('officerName').textContent = 'Officer: ' + officerName;

  await loadAppeals();

  document.getElementById('statusFilter').addEventListener('change', filterAppeals);
  document.getElementById('searchAppeal').addEventListener('input', filterAppeals);

  // Expose functions globally
  window.viewAppealDetails = viewAppealDetails;
  window.approveAppeal = approveAppeal;
  window.rejectAppeal = rejectAppeal;
});
