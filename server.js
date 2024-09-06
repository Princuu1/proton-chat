const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const session = require('express-session');
const fs = require('fs');
require('dotenv').config();

const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Setup PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Use the DATABASE_URL environment variable
    ssl: {
        rejectUnauthorized: false // Required for connecting securely to Supabase
    }
});

// Create table if it does not exist
async function setupDatabase() {
    try {
        const client = await pool.connect();
        console.log("Connected to the PostgreSQL database.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )
        `);

        console.log("Table 'users' created or already exists.");
        client.release(); // Release the client back to the pool
    } catch (err) {
        console.error("Error setting up the database: ", err.message);
    }
}

setupDatabase();

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
    let template = fs.readFileSync(path.join(__dirname, 'public/emailTemplate.html'), 'utf8');
    return template.replace('{{name}}', name); // Replace placeholder with user's name
}

// Handle signup
app.post('/signup', async (req, res) => {
    const { name, username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const client = await pool.connect();
        await client.query(
            'INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4)',
            [name, username, email, hashedPassword]
        );

        // Send confirmation email
        const htmlContent = getEmailTemplate(name);
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Welcome to our Chat',
            html: htmlContent
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email: ', error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

        res.status(200).json({ message: 'User created successfully' });
        client.release(); // Release the client back to the pool
    } catch (err) {
        res.status(500).json({ message: 'Username or email has already been registered' });
    }
});

// Handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        const row = result.rows[0];

        if (row && await bcrypt.compare(password, row.password)) {
            // Store user information in session
            req.session.userId = row.id;
            req.session.username = row.username;
            req.session.name = row.name; // Store name for use in the chat

            res.status(200).json({ success: true, message: 'Login successful', name: row.name });
        } else {
            res.status(401).json({ success: false, message: 'Username or password is incorrect' });
        }

        client.release(); // Release the client back to the pool
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error logging in' });
    }
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
