document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesDiv = document.getElementById('messages');
    const notificationSound = document.getElementById('notificationSound');
    const exitButton = document.getElementById('exitButton'); // Ensure this matches the HTML

    // Retrieve displayName from the data attribute
    const displayName = document.body.dataset.displayName;

    if (!displayName) {
        window.location.href = '/'; // Redirect to the login page if displayName is not found
    }

    function appendMessage(message, className) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', className);
        messageElement.textContent = message;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit('chat message', { user: displayName, text: message });
            appendMessage(`You: ${message}`, 'sent');
            messageInput.value = '';
        }
    });

    socket.on('chat message', (data) => {
        if (typeof data === 'string') {
            // This handles join and leave messages
            appendMessage(data, 'joined');
        } else {
            const { user, text } = data;
            if (user !== displayName) { // Display messages from other users
                appendMessage(`${user}: ${text}`, 'received');
                notificationSound.play();
            }
        }
    });

    exitButton.addEventListener('click', () => {
        window.location.href = '/'; // Redirect to login page or handle exit functionality
    });

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    // Notify the server when the user joins the chat
    socket.emit('join', displayName);
});
