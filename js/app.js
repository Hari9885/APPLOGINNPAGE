// Replace these with your actual Supabase credentials
const SUPABASE_URL = "https://rrsgmgedfusqlgknshbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyc2dtZ2VkZnVzcWxna25zaGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTYzMTAsImV4cCI6MjA2OTI3MjMxMH0.Zi-3YRo8ViQdGlwE1v1K_ICeKlMUlp4hIMS7FtzFNLM";

// Initialize Supabase client (v2 syntax)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let currentUser = null;
let userProfile = null;

// ===========================================
// AUTHENTICATION FUNCTIONS
// ===========================================

async function signUp() {
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  
  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }
  
  if (password.length < 6) {
    alert("Password must be at least 6 characters long");
    return;
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signUp({ 
      email, 
      password 
    });
    
    if (error) {
      alert("Signup Error: " + error.message);
    } else {
      alert("Check your email for confirmation link!");
      // Clear form
      document.getElementById("signup-email").value = "";
      document.getElementById("signup-password").value = "";
    }
  } catch (err) {
    alert("An unexpected error occurred: " + err.message);
  }
}

async function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  
  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) {
      alert("Login Error: " + error.message);
    } else {
      // Store user info
      currentUser = data.user;
      
      // Get user profile to check role
      await getUserProfile();
      
      // Redirect to dashboard
      window.location.href = "dashboard.html";
    }
  } catch (err) {
    alert("An unexpected error occurred: " + err.message);
  }
}

async function forgotPassword() {
  const email = document.getElementById("forgot-email").value;
  
  if (!email) {
    alert("Please enter your email address");
    return;
  }
  
  try {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html'
    });
    
    if (error) {
      alert("Reset Password Error: " + error.message);
    } else {
      alert("Password reset email sent! Check your inbox.");
      document.getElementById("forgot-email").value = "";
    }
  } catch (err) {
    alert("An unexpected error occurred: " + err.message);
  }
}

async function logout() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      alert("Error signing out: " + error.message);
    } else {
      // Clear global variables
      currentUser = null;
      userProfile = null;
      
      // Redirect to login page
      window.location.href = "index.html";
    }
  } catch (err) {
    alert("An unexpected error occurred: " + err.message);
  }
}

// ===========================================
// SESSION AND PROFILE MANAGEMENT
// ===========================================

async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error("Error getting session:", error);
      return null;
    }
    
    return session;
  } catch (err) {
    console.error("Unexpected error getting session:", err);
    return null;
  }
}

async function getUserProfile() {
  if (!currentUser) return null;
  
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    
    if (error) {
      console.error("Error fetching user profile:", error);
      // If profile doesn't exist, create one with default role
      await createUserProfile();
      return null;
    }
    
    userProfile = data;
    return data;
  } catch (err) {
    console.error("Unexpected error fetching profile:", err);
    return null;
  }
}

async function createUserProfile() {
  if (!currentUser) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .insert([
        {
          id: currentUser.id,
          email: currentUser.email,
          role: 'user',
          created_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      console.error("Error creating user profile:", error);
    } else {
      console.log("User profile created successfully");
      await getUserProfile(); // Refresh profile data
    }
  } catch (err) {
    console.error("Unexpected error creating profile:", err);
  }
}

// ===========================================
// AUTHORIZATION CHECKS
// ===========================================

async function checkAuthentication() {
  const session = await getCurrentSession();
  
  if (!session || !session.user) {
    // No active session, redirect to login
    if (!window.location.pathname.includes('index.html') && 
        !window.location.pathname.includes('signup.html') && 
        !window.location.pathname.includes('forgot.html')) {
      window.location.href = "index.html";
      return false;
    }
    return false;
  }
  
  // Store current user
  currentUser = session.user;
  
  // Get user profile
  await getUserProfile();
  
  return true;
}

async function checkAdminAccess() {
  const isAuthenticated = await checkAuthentication();
  
  if (!isAuthenticated) {
    return false;
  }
  
  // Check if user has admin role
  if (!userProfile || userProfile.role !== 'admin') {
    alert("Access denied. Admin privileges required.");
    window.location.href = "dashboard.html";
    return false;
  }
  
  return true;
}

// ===========================================
// PAGE-SPECIFIC FUNCTIONS
// ===========================================

async function loadUsers() {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      alert("Error loading users: " + error.message);
      return;
    }
    
    const table = document.getElementById("user-list");
    
    if (!table) {
      console.error("User list table not found");
      return;
    }
    
    table.innerHTML = ""; // Clear existing content
    
    if (data && data.length > 0) {
      data.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${user.email || 'N/A'}</td>
          <td>${user.role || 'user'}</td>
          <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
        `;
        table.appendChild(row);
      });
    } else {
      const row = document.createElement('tr');
      row.innerHTML = "<td colspan='3'>No users found</td>";
      table.appendChild(row);
    }
  } catch (err) {
    alert("Error loading users: " + err.message);
  }
}

async function showUserInfo() {
  if (currentUser && userProfile) {
    const userInfoElement = document.getElementById("user-info");
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <p><strong>Email:</strong> ${currentUser.email}</p>
        <p><strong>Role:</strong> ${userProfile.role}</p>
        <p><strong>User ID:</strong> ${currentUser.id}</p>
      `;
    }
  }
}

// ===========================================
// PAGE INITIALIZATION
// ===========================================

async function initializePage() {
  const pathname = window.location.pathname;
  const page = pathname.substring(pathname.lastIndexOf('/') + 1);
  
  // Public pages (no authentication required)
  if (page === 'index.html' || page === 'signup.html' || page === 'forgot.html' || page === '') {
    // Check if user is already logged in and redirect to dashboard
    const session = await getCurrentSession();
    if (session && session.user && (page === 'index.html' || page === 'signup.html' || page === '')) {
      window.location.href = "dashboard.html";
    }
    return;
  }
  
  // Protected pages (authentication required)
  if (page === 'dashboard.html') {
    const isAuthenticated = await checkAuthentication();
    if (isAuthenticated) {
      showUserInfo();
    }
    return;
  }
  
  // Admin-only pages
  if (page === 'admin.html') {
    const hasAdminAccess = await checkAdminAccess();
    if (hasAdminAccess) {
      showUserInfo();
      loadUsers();
    }
    return;
  }
}

// ===========================================
// AUTH STATE CHANGE LISTENER
// ===========================================

supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session);
  
  if (event === 'SIGNED_IN') {
    currentUser = session.user;
    getUserProfile();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    userProfile = null;
  }
});

// ===========================================
// PAGE LOAD EVENT
// ===========================================

window.addEventListener('DOMContentLoaded', initializePage);

// Legacy support for onload
window.onload = initializePage;