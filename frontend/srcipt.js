const API = "http://localhost:5000";

// Register Worker
async function register() {

    const data = {
        name: document.getElementById("name").value,
        phone: document.getElementById("phone").value,
        workType: document.getElementById("workType").value,
        location: document.getElementById("location").value,
        riskScore: Math.floor(Math.random() * 3)
    };

    const res = await fetch(`${API}/users/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    alert("Registration Successful");
}

// Calculate AI Premium
async function calculatePremium() {

    const res = await fetch(`${API}/policies/premium`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            basePremium: 20,
            riskScore: 2,
            city: "Delhi"
        })
    });

    const data = await res.json();
    alert(`Premium: ₹${data.premium}\nWeather Risk: ${data.weatherRisk}`);
}

// Trigger Claim Automatically
async function triggerClaim() {

    const res = await fetch(`${API}/claims/auto`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId: "demoUser",
            reason: "Heavy Rain Disruption"
        })
    });

    const data = await res.json();
    alert("Claim Approved ₹" + data.amount);
}

// Load Claims
async function loadClaims() {

    const res = await fetch(`${API}/claims`);
    const claims = await res.json();

    const list = document.getElementById("claimsList");
    list.innerHTML = "";

    claims.forEach(c => {
        const li = document.createElement("li");
        li.innerText = `User: ${c.userId} | Amount: ₹${c.amount} | Status: ${c.status}`;
        list.appendChild(li);
    });
}