# AI-powered-insurance-for-gig-workers


## 1. Problem Statement
 
India’s gig economy workers from platforms like Zomato, Swiggy, Zepto, Amazon, and Dunzo rely heavily on daily deliveries for their income.
However, external disruptions such as:
-Extreme heat
-Heavy rainfall
-Flooding
-Severe air pollution
-Curfews or local strikes

can stop them from working and result in 20–30% loss of weekly income.

Currently, gig workers do not have any financial protection against such income disruptions.

Our solution proposes an AI-powered parametric insurance platform that automatically compensates gig workers when such disruptions occur.

---

## 2. Target Users (Personas)

-->Persona: Rahul – Food Delivery Partner
-Age: 24
-Platform: Swiggy
-Location: Delhi
-Average weekly earnings: ₹4000

-->Problem Scenario
On certain days:
-Heavy rainfall stops deliveries
-Severe pollution warnings restrict outdoor work
-Area lockdowns prevent order pickups

Rahul loses around ₹1000–₹1500 weekly income due to such disruptions.

-->Solution Scenario
Rahul subscribes to our weekly insurance plan.
When:
-Rainfall crosses threshold
-AQI becomes hazardous
-Government restrictions stop operations
The system automatically triggers a parametric payout, compensating Rahul for his lost income.

---

## 3.Workflow:

Step 1 – Worker Onboarding

User signs up through the platform.
Information collected:
-Name
-Delivery platform
-Location
-Work zone
-Average weekly income
AI generates a risk profile.

Step 2 – Risk Profiling (AI)

AI models analyze:
-Historical weather data
-Pollution levels
-Disruption frequency
-Delivery zone risk
A risk score is generated which determines the weekly premium.

Step 3 – Policy Creation

Based on the AI risk score, the system suggests a weekly insurance policy.

Example:

Risk Level	      Weekly Premium     	Maximum Weekly Payout
Low Risk            	₹20	                  ₹300
Medium Risk	         ₹40                   ₹600
High Risk	           ₹60	                  ₹900

Workers subscribe to the plan that fits their earnings.

---

## 4. Weekly Premium Model

Premium depends on:
- Age
- Health condition
- Vehicle type (if vehicle insurance)
- Risk score from AI model

Formula Example:
Premium = Base Price + Risk Factor + AI Risk Score

Parametric Triggers:
- Accident detected
- Hospital record uploaded
- Natural disaster event

Gig workers typically earn and withdraw income weekly.
Therefore our pricing model follows a weekly subscription structure.

#vPremium Calculation Factors
AI determines premium using:
-City risk score
-Weather volatility
-Pollution index trends
-Average worker earnings
-Disruption frequency

Example:

Risk Score = 0.65
Weekly Premium = ₹45
Coverage Limit = ₹700

This keeps the insurance affordable while protecting income loss.

---

## 5. Platform Choice

Our system uses automated triggers based on real-world data.

Example triggers:

Event             	          Trigger               Condition	Payout
Extreme Rain	             Rainfall > 100 mm	            ₹400
Extreme Heat	             Temperature > 45°C	           ₹350
Severe Pollution	            AQI > 400	                 ₹300
Zone Closure	            Govt restriction / strike	     ₹500
 
When a trigger is detected:
1.System validates worker location
2.Checks delivery inactivity
3.Automatically processes payout

No manual claim process required.

We are building a **Web Application** because:
- Easy to access from any device
- No installation required
- Faster development

Future plan:
Mobile App version.

---

## 6. AI/ML Integration

AI is used in multiple parts of the system.

1. Risk Prediction Model
Used to calculate weekly premium.

Possible models:
-Random Forest
-Gradient Boosting
-Logistic Regression

Inputs:
-weather history
-disruption frequency
-worker location
-platform demand data

2. Fraud Detection
Prevents fraudulent claims.

AI checks:
-abnormal claim patterns
-location mismatch
-duplicate accounts
-fake inactivity

Algorithms:
-Isolation Forest
-Anomaly Detection Models

3. Income Loss Prediction
Predicts potential income loss based on disruption severity.

Example:
Average Weekly Income = ₹4000
Rainfall Impact = 40%
Estimated Loss = ₹1600

AI will be used for:

Premium Prediction Model
Fraud Detection System
Risk Analysis

Example:
Machine Learning will analyze user data and predict risk level.

---

--> Parametric Automation

The system continuously monitors external data sources.

# Data Sources
-Weather APIs
-AQI monitoring systems
-Traffic and government alerts
-Platform delivery activity

When a threshold is crossed:
-Parametric trigger activated
-Claim initiated automatically
-Fraud checks executed
-Instant payout processed

--> Payment Processing

Payouts are processed automatically through digital payment systems such as:
-Paytm
-PhonePe
-Google Pay

Workers receive compensation directly to their account or wallet.

---

## 7. Tech Stack

Frontend:
HTML
CSS
JavaScript

Backend:
Node.js / Python

Database:
MongoDB

AI/ML:
Python
Scikit-learn

Version Control:
GitHub

---

## 8. Development Plan

Phase 1:
Idea and Documentation

Phase 2:
Basic UI Development

Phase 3:
Backend Integration

Phase 4:
AI Model Integration

Phase 5:
Testing and Deployment

---

## 9. Future Improvements

Mobile App
Chatbot Support
Real-time Claim Tracking
Better AI Model

Possible improvements include:

-Dynamic premium adjustment
-AI-based income forecasting
-Risk heatmaps for cities
-Personalized insurance recommendations

---

## 10. Authentication
User authentication will be implemented using JWT (JSON Web Tokens).

Features:
- User Signup
- User Login
- Secure password storage
- Role based access (Customer / Admin)

---

## 11. Deployment
The prototype will be deployed using:

Frontend: Vercel  
Backend: Render  
Database: MongoDB Atlas  

The application will be connected through GitHub for continuous deployment.

---

## 12.🧪 Working Prototype (Phase 1 Scope)

For this phase, the prototype will include:

🔐 User Authentication

* Login & Signup functionality
* Basic user profile

📊 Smart Dashboard

* Displays:

  * Distance covered (mock data)
  * Weekly earnings
  * Risk score
  * Suggested premium

📋 Insurance Plan Listing

* Basic, Standard, Premium plans
* Coverage + pricing details

🧮 Dynamic Premium Calculator

* Inputs:

  * Distance
  * Working hours
  * Shift type
* Outputs:

  * Weekly premium
  * Risk score

🤖 Risk Score System

* Calculates user risk based on:

  * Distance traveled
  * Night shifts
  * Area risk

🚨 Basic Fraud Detection (Rule-Based)

* Detects:

  * Repeated claims
  * Unrealistic inputs

---

📌 Note:

This prototype demonstrates the core functionality along with initial implementation of intelligent risk-based pricing and decision-making.

---

## 13. 🔒 Adversarial Defense & Anti-Spoofing Strategy
1. Differentiation: Genuine User vs Spoofed Activity

To prevent GPS spoofing attacks, our system moves beyond single-point location verification and adopts a multi-layer behavioral intelligence model.

Instead of trusting raw GPS data, we analyze:

- Movement Continuity: Genuine delivery partners exhibit natural movement patterns (routes, stops, speed variation). Spoofed GPS often shows unnatural jumps or static positioning.

- Behavioral Profiling: Each user has a historical activity pattern (working hours, average distance covered, delivery frequency). Sudden deviations trigger risk flags.

- Sensor Fusion Validation: GPS data is cross-verified with device sensors (accelerometer, gyroscope). A user claiming movement but showing no physical motion is flagged.

- Geo-Context Consistency: Claimed location is validated against real-world constraints (roads, traffic patterns, delivery zones).

This creates a trust score for each claim, allowing the system to differentiate between genuine distress situations and manipulated inputs.

2. Data Signals for Fraud Detection

To detect coordinated fraud rings, our platform leverages multiple data sources beyond GPS:

- Device Sensor Data: Accelerometer and gyroscope to confirm physical movement

- Network Metadata: Signal strength, network switching patterns (WiFi ↔ Mobile Data)

- Delivery Activity Logs: Integration with platforms (e.g., order pickups, drop-offs)

- Weather Correlation: Matching user activity with real-time weather severity

- Device Fingerprinting: Identifying repeated usage patterns across devices/accounts

- Cluster Detection: Identifying multiple users showing identical or synchronized suspicious behavior (indicative of organized fraud groups)

- Time-Based Patterns: Simultaneous claim spikes from a specific region

Using these signals, an AI-based anomaly detection model flags suspicious claims and detects coordinated exploitation attempts.

3. UX Balance: Fair Handling of Flagged Claims

To ensure honest delivery partners are not unfairly penalized, the system follows a graceful verification workflow:

Soft Flagging (Not Immediate Rejection): Suspicious claims are marked for review instead of being denied

Step-Up Verification:

- Quick selfie or short video confirmation

- Live location revalidation

- Optional manual confirmation prompt

Delayed Payout Mechanism: Claims under review are processed with slight delay instead of rejection

Trust Score System:

- High-trust users (based on history) face fewer checks

- New or suspicious accounts undergo stricter validation

User Transparency:

- Clear communication on why a claim is flagged

- Simple steps to resolve and proceed

This ensures a balance between fraud prevention and user trust, maintaining platform reliability without harming genuine users.
