const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const session = require('express-session');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Setup database
const dbPath = path.resolve(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database: ", err.message);
    } else {
        console.log("Connected to the SQLite database.");
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error("Error creating table: ", err.message);
            } else {
                console.log("Table 'users' created or already exists.");
            }
        });
    }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET, // Use a strong secret key here
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Serve the signup/login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Serve the chat page
app.get('/chat', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public/chat/chat.html'));
});
// Read the HTML file
function getEmailTemplate(name) {
let template = fs.readFileSync(path.join(__dirname, 'public/emailTemplate.html'), 'utf8'); // Corrected file path
return template.replace('{{name}}',name);  // Replace placeholder with user's name
}
// Handle signup
app.post('/signup', async (req, res) => {
    const { name, username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        'INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)',
        [name, username, email, hashedPassword],
        function (err) {
            if (err) {
                return res.status(500).json({ message: 'username or email has already registerd' });
            }

            // Send confirmation email
            const htmlContent = getEmailTemplate(name);  // Use the email template
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Welcome to our Chat',
                html: htmlContent // Use the HTML template
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending email: ', error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });

            res.status(200).json({ message: 'User created successfully' });
        }
    );
});

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error logging in' });
        }

        if (row && await bcrypt.compare(password, row.password)) {
            // Store user information in session
            req.session.userId = row.id;
            req.session.username = row.username;
            req.session.name = row.name; // Store name for use in the chat

            res.status(200).json({ success: true, message: 'Login successful', name: row.name });
        } else {
            res.status(401).json({ success: false, message: 'Username or password is incorrect' });
        }
    });
});

// Handle socket.io events
io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('join', (username) => {
        socket.username = username;
        io.emit('chat message', `${username} joined the chat`); // Notify others
    });

    socket.on('chat message', (data) => {
        const { user, text } = data;
        io.emit('chat message', { user, text }); // Broadcast message to everyone
    });

    socket.on('disconnect', () => {
        io.emit('chat message', `${socket.username} left the chat`); // Notify others
        console.log('User disconnected');
    });
});


server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
