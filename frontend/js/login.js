const container = document.getElementById('container');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');

// TOGGLE ANIMATION
registerBtn.addEventListener('click', () => {
    container.classList.add("active");
});

loginBtn.addEventListener('click', () => {
    container.classList.remove("active");
});

// ===============================
// SIGN IN (STRICT)
// ===============================
const signInForm = document.querySelector('.sign-in form');

signInForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const email = signInForm.querySelector('input[type="email"]').value.trim();
    const password = signInForm.querySelector('input[type="password"]').value.trim();

    // ANY field empty → alert
    if (email === "" || password === "") {
        alert("⚠️ All fields are required for SafeRide security!");
        return;
    }

    // ALL filled → redirect
    window.location.href = "dashboard.html";
});

// ===============================
// SIGN UP (STRICT)
// ===============================
const signUpForm = document.querySelector('.sign-up form');

signUpForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = signUpForm.querySelector('input[type="text"]').value.trim();
    const email = signUpForm.querySelector('input[type="email"]').value.trim();
    const password = signUpForm.querySelector('input[type="password"]').value.trim();

    // ANY field empty → alert
    if (name === "" || email === "" || password === "") {
        alert("⚠️ All fields are required for SafeRide security!");
        return;
    }

    // ALL filled → redirect
    window.location.href = "dashboard.html";
});
