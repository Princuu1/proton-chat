document.addEventListener('DOMContentLoaded', () => {
    const signupContainer = document.getElementById('signupContainer');
    const loginContainer = document.getElementById('loginContainer');
    const showSignupLink = document.getElementById('showSignup');
    const showLoginLink = document.getElementById('showLogin');

    // Function to show signup and hide login
    const showSignup = () => {
        loginContainer.classList.add('hidden');
        signupContainer.classList.remove('hidden');
    };

    // Function to show login and hide signup
    const showLogin = () => {
        signupContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    };

    // Toggle to signup form
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSignup();
    });

    // Toggle to login form
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });

    // Signup functionality
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('nameInput').value;
        const username = document.getElementById('usernameInput').value;
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('signupPasswordInput').value;

        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, email, password })
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, 'success', 'signup');
                // Automatically show the login form after a successful signup
                showLogin();
            } else {
                showNotification(data.message, 'error', 'signup');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('An error occurred during signup.', 'error', 'signup');
        }
    });

    // Login functionality
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsernameInput').value;
        const password = document.getElementById('loginPasswordInput').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                // Store the display name
                localStorage.setItem('displayName', data.name);
                // Redirect to chat page
                showNotification('Login successful. please wait....', 'success', 'login');
                setTimeout(() => { window.location.href = '/chat'; }, 2000); // Redirect after 2 seconds
            } else {
                showNotification(data.message, 'error', 'login');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('An error occurred during login.', 'error', 'login');
        }
    });

    function showNotification(message, type, formType) {
        const popup = document.getElementById('notificationPopup');
        const messageElement = document.getElementById('notificationMessage');

        messageElement.textContent = message;

        // Apply different classes based on the form type
        if (formType === 'signup') {
            popup.className = `notification-popup ${type} signup`; // Show popup at the top for signup
        } else {
            popup.className = `notification-popup ${type}`; // Show popup at the bottom for login
        }

        popup.classList.add('show');

        setTimeout(() => {
            popup.classList.remove('show');
        }, 3000); // Hide notification after 3 seconds
    }
});
