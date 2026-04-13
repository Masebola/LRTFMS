/**
 * Public Appeal Submission Page Logic
 * Limpopo Road Traffic Fine Management System
 */

let appealCounter = 0;

document.getElementById('appealForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const fineIdInput = document.getElementById('fineId').value.trim();
  const idNumber = document.getElementById('idNumber').value.trim();
  const fullName = document.getElementById('fullName').value.trim();
  const contactNumber = document.getElementById('contactNumber').value.trim();
  const email = document.getElementById('email').value.trim();
  const reason = document.getElementById('appealReason').value;
  const details = document.getElementById('appealDetails').value.trim();
  const errorDiv = document.getElementById('loginError'); // reuse error div

  if (!fineIdInput || !idNumber || !fullName || !contactNumber || !email || !reason || !details) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  if (!validateIDNumber(idNumber)) {
    showToast('ID Number must be 13 digits', 'error');
    return;
  }

  try {
    // Find the fine by fine_number and verify driver ID matches
    const { data: fine, error: fineError } = await supabaseClient
      .from('fines')
      .select(`
        id,
        fine_number,
        status,
        drivers!inner(id, id_number, full_name)
      `)
      .eq('fine_number', fineIdInput)
      .single();

    if (fineError || !fine) {
      showToast('Fine not found. Please check the Fine ID.', 'error');
      return;
    }

    if (fine.drivers.id_number !== idNumber) {
      showToast('The ID Number does not match the driver associated with this fine.', 'error');
      return;
    }

    if (fine.status !== 'unpaid') {
      showToast('This fine cannot be appealed (already paid or under appeal).', 'error');
      return;
    }

    // Check if an appeal already exists for this fine
    const { data: existingAppeal } = await supabaseClient
      .from('appeals')
      .select('appeal_number')
      .eq('fine_id', fine.id)
      .maybeSingle();

    if (existingAppeal) {
      showToast(`An appeal already exists for this fine. Reference: ${existingAppeal.appeal_number}`, 'error');
      return;
    }

    // Generate appeal number
    const appealNumber = await generateSequentialNumber('APL', 'appeals', 'appeal_number');

    // Insert appeal
    const { error: insertError } = await supabaseClient
      .from('appeals')
      .insert([{
        appeal_number: appealNumber,
        fine_id: fine.id,
        driver_id: fine.drivers.id,
        reason: reason,
        details: details,
        status: 'pending'
      }]);

    if (insertError) throw insertError;

    // Show success
    document.getElementById('appealRef').textContent = appealNumber;
    document.getElementById('appealSuccess').classList.remove('hidden');
    document.getElementById('appealForm').reset();

    // Add to recent appeals table if visible
    const tbody = document.querySelector('#appealsTable tbody');
    if (tbody) {
      const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${appealNumber}</td>
        <td>${fine.fine_number}</td>
        <td>${fullName}</td>
        <td>${reason}</td>
        <td>${today}</td>
        <td><span class="status status-pending">Under Review</span></td>
      `;
      tbody.prepend(row);
    }

    showToast('Appeal submitted successfully!', 'success');
  } catch (error) {
    console.error('Error submitting appeal:', error);
    showToast('Failed to submit appeal. Please try again.', 'error');
  }
});

// Check appeal status (optional)
async function checkAppealStatus() {
  const appealId = document.getElementById('checkAppealId').value.trim().toUpperCase();
  const resultDiv = document.getElementById('appealStatusResult');
  
  if (!appealId) {
    resultDiv.innerHTML = '<p style="color: var(--danger);">Please enter an appeal reference number.</p>';
    resultDiv.classList.remove('hidden');
    return;
  }

  try {
    const { data: appeal, error } = await supabaseClient
      .from('appeals')
      .select(`
        appeal_number,
        status,
        submitted_at,
        fines!inner(fine_number)
      `)
      .eq('appeal_number', appealId)
      .single();

    if (error || !appeal) {
      resultDiv.innerHTML = `<p style="color: var(--danger);">No appeal found with reference: ${appealId}</p>`;
      resultDiv.classList.remove('hidden');
      return;
    }

    const submittedDate = new Date(appeal.submitted_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    let statusClass = appeal.status === 'pending' ? 'status-pending' : (appeal.status === 'approved' ? 'status-approved' : 'status-rejected');
    let statusText = appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1);
    let message = appeal.status === 'approved' ? 'Your appeal has been approved. The fine has been cancelled.' :
                  appeal.status === 'rejected' ? 'Your appeal has been rejected. Please pay the fine within 30 days.' :
                  'Your appeal is currently being reviewed by our team.';

    resultDiv.innerHTML = `
      <h4>Appeal Status</h4>
      <div class="fine-detail"><span>Appeal ID:</span><span>${appeal.appeal_number}</span></div>
      <div class="fine-detail"><span>Fine ID:</span><span>${appeal.fines.fine_number}</span></div>
      <div class="fine-detail"><span>Submitted:</span><span>${submittedDate}</span></div>
      <div class="fine-detail"><span>Status:</span><span class="status ${statusClass}">${statusText}</span></div>
      <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-muted);">${message}</p>
    `;
    resultDiv.classList.remove('hidden');
  } catch (error) {
    console.error('Error checking appeal:', error);
    showToast('Failed to check appeal status', 'error');
  }
}

// Expose to global
window.checkAppealStatus = checkAppealStatus;