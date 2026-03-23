const user = localStorage.getItem("user");

if(!user){
window.location.href = "index.html";
}

document.getElementById("userName").innerText = "Welcome " + user + " 👋";

let rideOn = false;
let timer = 0;
let interval;

function startRide(){
if(rideOn) return;

```
rideOn = true;
document.getElementById("rideStatus").innerText = "Status: ON";

interval = setInterval(()=>{
    timer++;
    document.getElementById("timer").innerText = timer;
    simulateAI();
},1000);
```

}

function stopRide(){
rideOn = false;
clearInterval(interval);
document.getElementById("rideStatus").innerText = "Status: OFF";
}

function emergency(){
alert("🚨 Emergency Alert Sent!");
}

function logout(){
localStorage.removeItem("user");
window.location.href = "index.html";
}

function simulateAI(){
let random = Math.random();

```
if(random < 0.1){
    document.getElementById("aiAlert").innerHTML = "⚠️ Harsh Braking Detected!";
    document.getElementById("alerts").innerText++;
}
```

}
v