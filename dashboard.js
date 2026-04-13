/**
 * Dashboard Page Logic
 * Limpopo Road Traffic Fine Management System
 */

// Check if logged in
async function checkAuth() {
  const user = await getCurrentOfficer();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

async function loadDashboardData() {
  const user = await checkAuth();
  if (!user) return;

  // Display officer name
  const officerName = user.user_metadata?.full_name || user.email.split('@')[0];
  document.getElementById('officerName').textContent = 'Officer: ' + officerName;

  try {
    // Fetch fines stats
    const { data: fines, error: finesError } = await supabaseClient
      .from('fines')
      .select('status');
    
    if (finesError) throw finesError;

    const totalFines = fines.length;
    const paidFines = fines.filter(f => f.status === 'paid').length;
    const unpaidFines = fines.filter(f => f.status === 'unpaid').length;

    document.getElementById('totalFines').textContent = totalFines;
    document.getElementById('paidFines').textContent = paidFines;
    document.getElementById('unpaidFines').textContent = unpaidFines;

    // Fetch pending appeals count
    const { count: pendingCount, error: appealsError } = await supabaseClient
      .from('appeals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (appealsError) throw appealsError;
    document.getElementById('pendingAppeals').textContent = pendingCount || 0;

    // Fetch recent fines (last 5)
    const { data: recentFines, error: recentError } = await supabaseClient
      .from('fines')
      .select(`
        fine_number,
        offense,
        amount,
        status,
        drivers!inner(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) throw recentError;

    const recentFinesTable = document.getElementById('recentFinesTable');
    recentFinesTable.innerHTML = '';
    recentFines.forEach(fine => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${fine.drivers.full_name}</td>
        <td>${fine.offense}</td>
        <td><span class="status status-${fine.status}">${fine.status.charAt(0).toUpperCase() + fine.status.slice(1)}</span></td>
      `;
      recentFinesTable.appendChild(row);
    });

    // Fetch recent appeals (last 5)
    const { data: recentAppeals, error: recentAppealsError } = await supabaseClient
      .from('appeals')
      .select(`
        appeal_number,
        submitted_at,
        status,
        fines!inner(fine_number),
        drivers!inner(full_name)
      `)
      .order('submitted_at', { ascending: false })
      .limit(5);

    if (recentAppealsError) throw recentAppealsError;

    const appealsTbody = document.getElementById('recentAppealsTable');
    if (appealsTbody) {
      appealsTbody.innerHTML = '';
      recentAppeals.forEach(appeal => {
        const submittedDate = new Date(appeal.submitted_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${appeal.appeal_number}</td>
          <td>${appeal.drivers.full_name}</td>
          <td>${appeal.fines.fine_number}</td>
          <td>${submittedDate}</td>
          <td><span class="status status-${appeal.status}">${appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1)}</span></td>
        `;
        appealsTbody.appendChild(row);
      });
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showToast('Error loading dashboard data', 'error');
  }
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

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', loadDashboardData);