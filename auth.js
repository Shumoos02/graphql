//links to use
const API_BASE_URL = 'https://learn.reboot01.com';
const SIGNIN_ENDPOINT = `${API_BASE_URL}/api/auth/signin`;
const GRAPHQL_ENDPOINT = `${API_BASE_URL}/api/graphql-engine/v1/graphql`;

// Login functionality
document.getElementById('login-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('error');

    if (!username || !password) {
        showError('Please enter both username and password', errorElement);
        return;
    }

    try {
        const token = await authenticate(username, password);
        localStorage.setItem('JWT', token);
        window.location.href = 'profile.html';
    } catch (error) {
        showError(error.message, errorElement);
    }
});

// Logout functionality
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('JWT');
    window.location.href = 'index.html';
});

// Check authentication on profile load
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('profile.html')) {
        const token = localStorage.getItem('JWT');
        if (!token) {
            window.location.href = 'index.html';
        }
    }
});

async function authenticate(username, password) {
    const authString = `${username}:${password}`;
    const encodedAuth = btoa(authString);
    
    const response = await fetch(SIGNIN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${encodedAuth}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error('Invalid credentials. Please try again.');
    }
    
    const data = await response.json();
    return data;
}

function showError(message, element) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}
