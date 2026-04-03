# 🚨 Intrusion Detection System (IDS) - Log Monitoring & Brute Force Detection

## 📌 Project Overview

This project is a **Log-Based Intrusion Detection System (IDS)** developed using **Node.js**. It monitors authentication logs, detects suspicious login activities, and triggers alerts when potential **brute force attacks** are identified.

The system analyzes login attempts in real-time and applies predefined rules such as **failed login thresholds within a time window**.

---

## 🎯 Features

* 📥 Real-time log monitoring
* 🔍 Log parsing (IP, Username, Timestamp, Status)
* 🚨 Brute force attack detection
* ⚙️ Configurable detection rules
* 🔔 Alert system (console-based)
* 🗄️ Optional MongoDB integration for storing attack data

---

## 🧠 System Architecture

```
Log File → Log Reader → Parser → Detection Engine → Alert System → Database (Optional)
```

---

## 📁 Project Structure

```
ids-project/
│
├── logs/
│   └── auth.log
│
├── config/
│   └── rules.js
│
├── services/
│   ├── logReader.js
│   ├── parser.js
│   ├── detector.js
│   └── alert.js
│
├── models/
│   └── attackModel.js
│
├── utils/
│   └── timeWindow.js
│
├── app.js
├── package.json
└── README.md
```

---

## ⚙️ Installation

### 1️⃣ Clone the Repository

```
git clone https://github.com/your-username/ids-project.git
cd ids-project
```

### 2️⃣ Install Dependencies

```
npm install
```

### 3️⃣ Run the Application

```
node app.js
```

---

## 📄 Log Format

The system expects logs in the following format:

```
YYYY-MM-DD HH:MM:SS IP:<ip_address> USER:<username> STATUS:<SUCCESS/FAILED>
```

### Example:

```
2026-04-02 10:15:30 IP:192.168.1.10 USER:admin STATUS:FAILED
```

---

## ⚙️ Configuration (Detection Rules)

Modify detection rules in:

📂 `config/rules.js`

```
FAILED_LOGIN_THRESHOLD = 5
TIME_WINDOW_SECONDS = 120
```

* **FAILED_LOGIN_THRESHOLD** → Number of failed attempts allowed
* **TIME_WINDOW_SECONDS** → Time window for detection

---

## 🚨 How Detection Works

1. The system reads logs line-by-line
2. Extracts key fields:

   * IP Address
   * Username
   * Timestamp
   * Login Status
3. Tracks failed login attempts per IP
4. If attempts exceed threshold within time window → ALERT

---

## 🔔 Alert Example

```
🚨 ALERT: Possible Brute Force Attack!
IP: 192.168.1.10
Failed Attempts: 5
Time: 2026-04-02T10:16:10.000Z
```

---

## 🗄️ MongoDB Integration (Optional)

To store detected attacks:

1. Install mongoose:

```
npm install mongoose
```

2. Configure database connection in `app.js`

3. Use `models/attackModel.js` to store attack logs

---

## 🚀 Future Enhancements

* 📧 Email alerts using NodeMailer
* 🌐 Web dashboard (HTML/CSS/React)
* 📊 Data visualization
* 🌍 Geo-IP tracking
* 🔒 Automatic IP blocking
* 🤖 AI-based anomaly detection

---

## 🧪 Testing

Add sample logs in:

📂 `logs/auth.log`

Then run:

```
node app.js
```

---

## 📚 Technologies Used

* Node.js
* JavaScript
* MongoDB (optional)
* File System (fs module)

---

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repository and submit pull requests.

---

## 📜 License

This project is open-source and available under the **MIT License**.

---

## 👨‍💻 Author

Developed by **Darshan BR**

---

 ## Acknowledgements

* Inspired by real-world cybersecurity monitoring systems
* Useful for academic and mini-project implementations

---
