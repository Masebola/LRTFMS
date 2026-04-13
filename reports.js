/**
 * Reports & Analytics Page Logic
 * Limpopo Road Traffic Fine Management System
 */

let statusChart, offenseChart, trendChart;
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

// Fetch and display all report data
async function loadReportData(month = null) {
  try {
    // Build date filter if month selected
    let dateFilter = {};
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      dateFilter = {
        offense_date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0]
        }
      };
    }

    // Fetch all fines (with optional date filter)
    let query = supabaseClient.from('fines').select(`
      id,
      amount,
      status,
      offense,
      location,
      offense_date,
      drivers!inner(full_name)
    `);
    
    if (month) {
      query = query.gte('offense_date', dateFilter.offense_date.gte)
                   .lte('offense_date', dateFilter.offense_date.lte);
    }
    
    const { data: fines, error } = await query;

    if (error) throw error;

    // Calculate summary stats
    const totalFines = fines.length;
    const paidFines = fines.filter(f => f.status === 'paid').length;
    const unpaidFines = fines.filter(f => f.status === 'unpaid').length;
    const totalRevenue = fines
      .filter(f => f.status === 'paid')
      .reduce((sum, f) => sum + parseFloat(f.amount), 0);

    document.getElementById('totalFinesIssued').textContent = totalFines;
    document.getElementById('totalPaidFines').textContent = paidFines;
    document.getElementById('totalUnpaidFines').textContent = unpaidFines;
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);

    // Prepare chart data
    const statusCounts = {
      paid: paidFines,
      unpaid: unpaidFines,
      pending: fines.filter(f => f.status === 'pending').length
    };

    // Offense type aggregation
    const offenseMap = new Map();
    fines.forEach(f => {
      offenseMap.set(f.offense, (offenseMap.get(f.offense) || 0) + 1);
    });
    const offenseLabels = Array.from(offenseMap.keys());
    const offenseData = Array.from(offenseMap.values());

    // Monthly trend (last 6 months)
    const trendData = await getMonthlyTrend();

    // Update charts
    updateStatusChart(statusCounts);
    updateOffenseChart(offenseLabels, offenseData);
    updateTrendChart(trendData);

    // Update top offenses table
    updateTopOffensesTable(offenseMap, fines);

    // Update location statistics
    updateLocationStats(fines);

    // Fetch appeals summary
    await loadAppealsSummary(month ? dateFilter : null);

  } catch (error) {
    console.error('Error loading report data:', error);
    showToast('Failed to load report data', 'error');
  }
}

// Get monthly trend for last 6 months
async function getMonthlyTrend() {
  const months = [];
  const issuedData = [];
  const paidData = [];
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const { data: fines, error } = await supabaseClient
      .from('fines')
      .select('status')
      .gte('offense_date', startDate.toISOString().split('T')[0])
      .lte('offense_date', endDate.toISOString().split('T')[0]);
    
    if (error) throw error;
    
    months.push(d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }));
    issuedData.push(fines.length);
    paidData.push(fines.filter(f => f.status === 'paid').length);
  }
  
  return { months, issuedData, paidData };
}

// Update status doughnut chart
function updateStatusChart(counts) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  if (statusChart) statusChart.destroy();
  
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Unpaid', 'Under Appeal'],
      datasets: [{
        data: [counts.paid, counts.unpaid, counts.pending],
        backgroundColor: ['#2E7D32', '#C62828', '#F57C00'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Update offense bar chart
function updateOffenseChart(labels, data) {
  const ctx = document.getElementById('offenseChart').getContext('2d');
  if (offenseChart) offenseChart.destroy();
  
  offenseChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Number of Fines',
        data: data,
        backgroundColor: '#1E3A5F'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Update trend line chart
function updateTrendChart(trendData) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.months,
      datasets: [
        {
          label: 'Fines Issued',
          data: trendData.issuedData,
          borderColor: '#1E3A5F',
          backgroundColor: 'rgba(30, 58, 95, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Paid Fines',
          data: trendData.paidData,
          borderColor: '#2E7D32',
          backgroundColor: 'rgba(46, 125, 50, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Update top offenses table with revenue
function updateTopOffensesTable(offenseMap, fines) {
  const tbody = document.querySelector('#topOffensesTable tbody');
  tbody.innerHTML = '';
  
  // Calculate revenue per offense
  const revenueMap = new Map();
  fines.filter(f => f.status === 'paid').forEach(f => {
    revenueMap.set(f.offense, (revenueMap.get(f.offense) || 0) + parseFloat(f.amount));
  });
  
  const sorted = Array.from(offenseMap.entries()).sort((a, b) => b[1] - a[1]);
  
  sorted.slice(0, 5).forEach(([offense, count]) => {
    const revenue = revenueMap.get(offense) || 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${offense}</td>
      <td>${count}</td>
      <td>${formatCurrency(revenue)}</td>
    `;
    tbody.appendChild(row);
  });
}

// Update location statistics table
function updateLocationStats(fines) {
  const locationMap = new Map();
  fines.forEach(f => {
    const loc = f.location || 'Unknown';
    if (!locationMap.has(loc)) {
      locationMap.set(loc, { count: 0, offenses: new Map(), revenue: 0 });
    }
    const entry = locationMap.get(loc);
    entry.count++;
    entry.offenses.set(f.offense, (entry.offenses.get(f.offense) || 0) + 1);
    if (f.status === 'paid') entry.revenue += parseFloat(f.amount);
  });
  
  const tbody = document.querySelector('#locationStatsTable tbody');
  tbody.innerHTML = '';
  
  const sorted = Array.from(locationMap.entries()).sort((a, b) => b[1].count - a[1].count);
  
  sorted.slice(0, 5).forEach(([location, data]) => {
    const mostCommon = Array.from(data.offenses.entries()).sort((a,b) => b[1] - a[1])[0][0];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${location}</td>
      <td>${data.count}</td>
      <td>${mostCommon}</td>
      <td>${formatCurrency(data.revenue)}</td>
    `;
    tbody.appendChild(row);
  });
}

// Load appeals summary
async function loadAppealsSummary(dateFilter = null) {
  let query = supabaseClient.from('appeals').select('status', { count: 'exact', head: true });
  
  // Count total
  const { count: total, error: totalError } = await query;
  if (totalError) throw totalError;
  
  // Count by status
  const { count: approved } = await supabaseClient.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const { count: rejected } = await supabaseClient.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'rejected');
  const { count: pending } = await supabaseClient.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  
  document.querySelector('#appealsSummary .stat-card:nth-child(1) .stat-value').textContent = total || 0;
  document.querySelector('#appealsSummary .stat-card:nth-child(2) .stat-value').textContent = approved || 0;
  document.querySelector('#appealsSummary .stat-card:nth-child(3) .stat-value').textContent = rejected || 0;
  document.querySelector('#appealsSummary .stat-card:nth-child(4) .stat-value').textContent = pending || 0;
}

// Month selector handler
function updateReport() {
  const monthSelect = document.getElementById('reportMonth');
  const selected = monthSelect.value;
  loadReportData(selected !== 'all' ? selected : null);
}

// Print report
function printReport() {
  window.print();
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

  await loadReportData();
  
  // Set up month selector
  const monthSelect = document.getElementById('reportMonth');
  monthSelect.addEventListener('change', updateReport);
  
  // Expose functions
  window.updateReport = updateReport;
  window.printReport = printReport;
  window.logout = logout;
  window.toggleMenu = toggleMenu;
  window.closeMenu = closeMenu;
});