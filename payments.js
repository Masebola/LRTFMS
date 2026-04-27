/**
 * Payment Tracking Page Logic
 * Limpopo Road Traffic Fine Management System
 */

let currentOfficer = null;
let allPayments = [];

// Check authentication
async function checkAuth() {
  const user = await getCurrentOfficer();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// Load all payments
async function loadPayments() {
  try {
    const { data: payments, error } = await supabaseClient
      .from('payments')
      .select(`
        id,
        transaction_ref,
        amount,
        payment_method,
        paid_at,
        fines!inner(fine_number),
        drivers!fines!inner(full_name)
      `)
      .order('paid_at', { ascending: false });

    if (error) throw error;

    allPayments = payments || [];
    displayPayments(allPayments);
    updateStats(allPayments);
  } catch (error) {
    console.error('Error loading payments:', error);
    showToast('Failed to load payments', 'error');
  }
}

function displayPayments(payments) {
  const tbody = document.querySelector('#paymentsTable tbody');
  tbody.innerHTML = '';

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No payments recorded yet.</td></tr>`;
    return;
  }

  payments.forEach(payment => {
    const row = document.createElement('tr');
    const paidDate = new Date(payment.paid_at).toLocaleDateString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const method = payment.payment_method || 'Simulated';
    const driverName = payment.drivers?.full_name || 'Unknown';

    row.innerHTML = `
      <td>${payment.transaction_ref || '—'}</td>
      <td>${payment.fines.fine_number}</td>
      <td>${driverName}</td>
      <td>${formatCurrency(payment.amount)}</td>
      <td>${method}</td>
      <td>${paidDate}</td>
    `;
    tbody.appendChild(row);
  });
}

function updateStats(payments) {
  const totalPayments = payments.length;
  const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const avgPayment = totalPayments > 0 ? totalRevenue / totalPayments : 0;

  document.getElementById('totalPayments').textContent = totalPayments;
  document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
  document.getElementById('avgPayment').textContent = formatCurrency(avgPayment);
}

function filterPayments() {
  const searchTerm = document.getElementById('searchPayment').value.toLowerCase();
  const monthFilter = document.getElementById('filterMonth').value; // format: YYYY-MM

  let filtered = allPayments;

  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.fines.fine_number.toLowerCase().includes(searchTerm) ||
      (p.drivers?.full_name || '').toLowerCase().includes(searchTerm) ||
      (p.transaction_ref || '').toLowerCase().includes(searchTerm)
    );
  }

  if (monthFilter) {
    filtered = filtered.filter(p => {
      const paidDate = new Date(p.paid_at);
      const paidMonth = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`;
      return paidMonth === monthFilter;
    });
  }

  displayPayments(filtered);
  updateStats(filtered);
}

function resetFilters() {
  document.getElementById('searchPayment').value = '';
  document.getElementById('filterMonth').value = '';
  displayPayments(allPayments);
  updateStats(allPayments);
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;
  currentOfficer = user;

  const officerName = user.user_metadata?.full_name || user.email.split('@')[0];
  document.getElementById('officerName').textContent = 'Officer: ' + officerName;

  await loadPayments();

  // Expose filter functions
  window.filterPayments = filterPayments;
  window.resetFilters = resetFilters;
  window.logout = logout;
  window.toggleMenu = toggleMenu;
  window.closeMenu = closeMenu;
});
