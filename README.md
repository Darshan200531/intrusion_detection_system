# 🛡️ Intrusion Detection System (IDS)

A real-time **Host-Based Intrusion Detection System (HIDS)** developed using **Node.js**, **Express.js**, **MongoDB**, and **Socket.IO** to monitor **SSH**, **FTP**, and **SMTP** activities on Ubuntu Linux.

The system continuously monitors Linux log files, detects suspicious activities based on predefined rules, stores events in MongoDB, and displays real-time alerts through a web dashboard.

---

## 📌 Features

### SSH Monitoring
- Monitor `/var/log/auth.log`
- Detect successful login
- Detect failed login
- Detect root login
- Detect repeated authentication failures
- Generate real-time alerts

### FTP Monitoring
- Monitor `/var/log/vsftpd.log`
- Detect FTP login
- Detect file upload
- Detect file download
- Detect file deletion
- Detect suspicious file uploads
- Detect anonymous login (optional)

### SMTP Monitoring
- Monitor `/var/log/mail.log`
- Detect email sent
- Detect email received
- Detect SMTP authentication
- Detect abnormal email activity

### Dashboard
- Live alerts using Socket.IO
- Event statistics
- Severity levels
- Search and filtering
- Historical event logs

### Database
- MongoDB stores:
  - Username
  - Source IP
  - Timestamp
  - Service
  - Event
  - Severity
  - Description

---

# 🏗️ System Architecture

```
                   Ubuntu Client VM
          SSH / FTP / SMTP Requests
                    |
                    |
        ----------------------------
                    |
             Ubuntu IDS Server
        ----------------------------
              SSH Server
              FTP Server
              SMTP Server
              Node.js IDS
              MongoDB
              Socket.IO
              Web Dashboard
```

---

# 🛠️ Technologies Used

| Technology | Purpose |
|------------|----------|
| Ubuntu | Operating System |
| Node.js | Backend |
| Express.js | Web Framework |
| MongoDB | Database |
| Mongoose | MongoDB ODM |
| Socket.IO | Real-time Alerts |
| Bootstrap | Frontend UI |
| VSFTPD | FTP Server |
| OpenSSH | SSH Server |
| Postfix | SMTP Server |

---

# 📂 Project Structure

```
IDS/
│
├── config/
│   ├── config.js
│   ├── rules.js
│
├── detectors/
│   ├── sshDetector.js
│   ├── ftpDetector.js
│   ├── smtpDetector.js
│
├── services/
│   ├── authMonitor.js
│   ├── ftpMonitor.js
│   ├── smtpMonitor.js
│
├── models/
│   ├── Alert.js
│   ├── SSHLog.js
│   ├── FTPLog.js
│   ├── SMTPLog.js
│
├── routes/
│   ├── alerts.js
│   ├── sshRoutes.js
│   ├── ftpRoutes.js
│   ├── smtpRoutes.js
│
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│
├── views/
│
├── app.js
├── server.js
├── package.json
└── README.md
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/IDS.git

cd IDS
```

---

## Install Dependencies

```bash
npm install
```

---

## Install MongoDB

```bash
sudo apt update

sudo apt install mongodb
```

Start MongoDB

```bash
sudo systemctl start mongod

sudo systemctl enable mongod
```

---

## Install FTP Server

```bash
sudo apt install vsftpd
```

Start FTP

```bash
sudo systemctl start vsftpd

sudo systemctl enable vsftpd
```

---

## Install SMTP Server

```bash
sudo apt install postfix
```

---

## Start Application

```bash
npm start
```

Server starts on

```
http://localhost:3000
```

---

# 🔍 Log Files Monitored

SSH

```
/var/log/auth.log
```

FTP

```
/var/log/vsftpd.log
```

SMTP

```
/var/log/mail.log
```

---

# 🚀 Demonstration Commands

## SSH

Successful Login

```bash
ssh student@192.168.56.101
```

---

Failed Login

Enter incorrect password.

---

## FTP

Connect

```bash
ftp 192.168.56.101
```

Upload

```ftp
put report.txt
```

Download

```ftp
get report.txt
```

Delete

```ftp
delete report.txt
```

Exit

```ftp
bye
```

---

## SMTP

Send Email

```bash
echo "Hello IDS" | mail -s "SMTP Test" user@localhost
```

Multiple Emails

```bash
for i in {1..10}
do
echo "Mail $i" | mail -s "Test$i" user@localhost
done
```

---

# 📊 Sample Dashboard

Displays

- SSH Alerts
- FTP Alerts
- SMTP Alerts
- Severity Levels
- Statistics
- Charts

---

# 📂 MongoDB

Open MongoDB

```bash
mongosh
```

Show Databases

```javascript
show dbs
```

Use IDS Database

```javascript
use ids
```

Show Collections

```javascript
show collections
```

View Logs

```javascript
db.logs.find().pretty()
```

---

# 🚨 Detection Rules

## SSH

- Successful Login
- Failed Login
- Root Login
- Multiple Failed Logins

## FTP

- Login
- Upload
- Download
- Delete
- Suspicious File Upload

## SMTP

- Email Sent
- Email Received
- SMTP Authentication
- High Email Rate

---

# 📈 Future Enhancements

- Machine Learning-based detection
- Automatic IP blocking
- Email notifications
- Threat intelligence integration
- Docker deployment
- Cloud monitoring
- WebSocket-based analytics

---

# 📚 References

- Ubuntu Documentation
- Node.js Documentation
- MongoDB Documentation
- VSFTPD Documentation
- OpenSSH Documentation
- Postfix Documentation
- OWASP
- MITRE ATT&CK Framework

---

# 📄 License

This project is developed for educational and research purposes as a Final Year Engineering Project.
