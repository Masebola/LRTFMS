

/**
 * Limpopo Road Traffic Fine Management System
 * Main JavaScript File with Supabase Integration
 */

// =============================================
// Supabase Configuration
// =============================================
const SUPABASE_URL = 'https://jgzfwceqkwtctaagjiwf.supabase.co'; // Replace with your actual URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnemZ3Y2Vxa3d0Y3RhYWdqaXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzAyMTYsImV4cCI6MjA5MTYwNjIxNn0.EN7Hl_aw_AQ8-Bpc4RFP7_P6rGwC3QoteOnn6aBncF4'; // Replace with your actual anon key

// Initialize Supabase client safely (using a unique variable name)
let supabaseClient = null;

function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized');
  } else {
    console.error('Supabase library not loaded. Ensure the script tag is included.');
    // Provide a fallback dummy client to prevent crashes
    supabaseClient = {
      auth: {
        signInWithPassword: () => Promise.reject(new Error('Supabase not configured')),
        signOut: () => Promise.resolve({ error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null })
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null })
      })
    };
  }
}

initSupabase();

// =============================================
// Authentication Helpers
// =============================================
async function getCurrentOfficer() {
  if (!supabaseClient) return null;
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function requireAuth() {
  const user = await getCurrentOfficer();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// =============================================
// Modal Functions
// =============================================
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
});

// =============================================
// Form Validation Helpers
// =============================================
function validateIDNumber(idNumber) {
  return /^\d{13}$/.test(idNumber);
}

function validatePhoneNumber(phone) {
  return /^0\d{9}$/.test(phone.replace(/\s/g, ''));
}

function formatCurrency(amount) {
  return 'R' + parseFloat(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-ZA', options);
}

// Generate unique fine/appeal number (e.g., FIN-2026-001)
async function generateSequentialNumber(prefix, table, column) {
  if (!supabaseClient) return `${prefix}-${Date.now()}`;
  const currentYear = new Date().getFullYear();
  const { count, error } = await supabaseClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .like(column, `${prefix}-${currentYear}-%`);
  
  if (error) {
    console.error('Error generating number:', error);
    return `${prefix}-${currentYear}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }
  
  const nextNumber = (count || 0) + 1;
  return `${prefix}-${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
}

// =============================================
// Toast Notification
// =============================================
function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 2000;
    animation: slideIn 0.3s ease;
    background: ${type === 'success' ? '#2E7D32' : type === 'error' ? '#C62828' : '#F57C00'};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// =============================================
// Local Storage Helpers (for demo fallback)
// =============================================
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage not available');
  }
}

function getFromStorage(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('LocalStorage not available');
    return null;
  }
}

// =============================================
// Print functionality
// =============================================
function printPage() {
  window.print();
}

// =============================================
// Table sorting (basic)
// =============================================
function sortTable(tableId, columnIndex) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    const aText = a.cells[columnIndex].textContent.trim();
    const bText = b.cells[columnIndex].textContent.trim();
    return aText.localeCompare(bText);
  });

  rows.forEach(row => tbody.appendChild(row));
}

// =============================================
// Initialize page
// =============================================
document.addEventListener('DOMContentLoaded', function() {
  // Add active class to current nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });

  // Initialize date inputs with today's date where applicable
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) {
      input.valueAsDate = new Date();
    }
  });
});

console.log('LRTFMS - Supabase integration loaded');