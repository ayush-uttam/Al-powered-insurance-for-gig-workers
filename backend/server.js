// require('dotenv').config();

// const path = require('path');

// // Serve static frontend files

// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();

// const app = express();

// app.use(express.static(path.join(__dirname, '../frontend')));

// // Middleware
// app.use(cors());
// app.use(express.json());

// // ✅ TEST ROUTE (ADD THIS)
// app.get("/", (req, res) => {
//     res.send("🚀 SafeRide Backend Running Successfully");
// });

// // Routes
// const authRoutes = require("./routes/auth");
// app.use("/api/auth", authRoutes);

// // MongoDB Connection
// mongoose.connect(process.env.MONGO_URI)
// .then(() => {
//     console.log("✅ MongoDB Connected");
// })
// .catch((err) => {
//     console.log("❌ MongoDB Error:", err);
// });

// // Start Server
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//     console.log(`🚀 Server running on port ${PORT}`);
// });

// console.log("MONGO_URI:", process.env.MONGO_URI);

// app.use((req, res) => {
//   res.sendFile(path.join(__dirname, '../frontend/homepage.html'));
// });


require('dotenv').config();

const path = require('path');
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("✅ MongoDB Connected");
})
.catch((err) => {
    console.log("❌ MongoDB Error:", err);
});

// ✅ REMOVE this ❌
// app.get("/", (req, res) => {
//     res.send("🚀 SafeRide Backend Running Successfully");
// });

// ✅ Fallback to frontend
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/index.html'));
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

console.log("MONGO_URI:", process.env.MONGO_URI);