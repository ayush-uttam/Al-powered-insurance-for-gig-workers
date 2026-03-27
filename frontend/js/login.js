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
// SIGN IN (CONNECTED TO BACKEND)
// ===============================

const signInForm = document.querySelector('.sign-in form');

signInForm.addEventListener('submit', async function (e) {

    e.preventDefault();

    const email = signInForm.querySelector('input[type="email"]').value.trim();
    const password = signInForm.querySelector('input[type="password"]').value.trim();

    if (email === "" || password === "") {
        alert("⚠️ All fields are required!");
        return;
    }

    try {

        const response = await fetch("/api/auth/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await response.json();

        if (response.ok) {

            alert("✅ Login Successful!");

            // Save login state
            localStorage.setItem("user", email);

            // Redirect
            window.location.href = "homepage.html";

        } else {

            alert(data.message);

        }

    } catch (error) {

        alert("❌ Server error. Please try again.");

    }

});


// ===============================
// SIGN UP (CONNECTED TO BACKEND)
// ===============================

const signUpForm = document.querySelector('.sign-up form');

signUpForm.addEventListener('submit', async function (e) {

    e.preventDefault();

    const name = signUpForm.querySelector('input[type="text"]').value.trim();
    const email = signUpForm.querySelector('input[type="email"]').value.trim();
    const password = signUpForm.querySelector('input[type="password"]').value.trim();

    if (name === "" || email === "" || password === "") {
        alert("⚠️ All fields are required!");
        return;
    }

    try {

        const response = await fetch("/api/auth/signup", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })

        });

        const data = await response.json();

        if (response.ok) {

            alert("✅ Registration Successful!");

            // Switch to login form
            container.classList.remove("active");

        } else {

            alert(data.message);

        }

    } catch (error) {

        alert("❌ Server error. Please try again.");

    }

});