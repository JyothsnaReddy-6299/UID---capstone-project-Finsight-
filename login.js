/* ═══════════════════════════════════════════
   FINSIGHT — Fixed Login System
   ═══════════════════════════════════════════ */

/* ── HAMBURGER MENU ── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

/* ── TAB SWITCHING ── */
function showLogin(btn) {
  document.getElementById('login-form').style.display  = 'block';
  document.getElementById('signup-form').style.display = 'none';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const target = btn instanceof Element ? btn : document.querySelectorAll('.tab-btn')[0];
  target.classList.add('active');
}

function showSignup(btn) {
  document.getElementById('login-form').style.display  = 'none';
  document.getElementById('signup-form').style.display = 'block';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const target = btn instanceof Element ? btn : document.querySelectorAll('.tab-btn')[1];
  target.classList.add('active');
}

/* ── LOGIN HANDLER ── */
function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const storedUser = JSON.parse(localStorage.getItem("finsightUser"));

  // If no account exists
  if (!storedUser || storedUser.email !== email) {
    alert("No account found. Please create an account first.");
    showSignup();
    return;
  }

  // Validate password format
  if (!isValidPassword(password)) {
    alert("Invalid password format.");
    return;
  }

  // Check password match
  if (storedUser.password !== password) {
    alert("Incorrect password.");
    return;
  }

  // Login success
  const letter = email.charAt(0).toUpperCase();

  localStorage.setItem("finsightUser", JSON.stringify({
    email,
    password,
    avatar: letter,
    loggedIn: true
  }));

  window.location.href = "index.html";
}
/* ── SIGNUP HANDLER ── */
function handleSignup(e) {
  e.preventDefault();

  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;

  if (!email || !password || !confirm) return;

  if (!isValidPassword(password)) {
    alert("Password must be at least 6 characters and include letters, numbers, and a special character.");
    return;
  }

  if (password !== confirm) {
    alert("Passwords do not match");
    return;
  }

  // Save user
  localStorage.setItem("finsightUser", JSON.stringify({ email, password }));

  alert("Account created! Please login.");

  showLogin(); // go back to login
}
/* ── SAVE USER + REDIRECT ── */
function saveUser(email) {
  const letter = email.charAt(0).toUpperCase();

  const user = {
    email: email,
    avatar: letter,
    loggedIn: true
  };

  localStorage.setItem("finsightUser", JSON.stringify(user));

  // Redirect to home page
  window.location.href = "index.html";
}

/* ── PASSWORD SHOW / HIDE ── */
function togglePw(id, icon) {
  const input = document.getElementById(id);

  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = '🙈';
  } else {
    input.type = 'password';
    icon.textContent = '👁';
  }
}

/* ── PASSWORD STRENGTH ── */
function updateStrength(val) {
  const segs   = ['s1','s2','s3','s4'].map(id => document.getElementById(id));
  const colors = ['#ff4d4d', '#ff944d', '#f5c518', '#4caf50'];

  let score = 0;
  if (val.length >= 6)           score++;
  if (/[A-Z]/.test(val))        score++;
  if (/[0-9]/.test(val))        score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  segs.forEach((seg, i) => {
    seg.style.background = i < score ? colors[score - 1] : '#e8e8e8';
  });
}
function isValidPassword(password) {
  const minLength = password.length >= 6;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return minLength && hasLetter && hasNumber && hasSpecial;
}