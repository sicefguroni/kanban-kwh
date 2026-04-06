import apiService from '../../services/APIService.js';

export class AuthComponent {
  constructor(containerSelector = '#auth-form-container') {
    this.containerSelector = containerSelector;
    this.mode = 'login'; // 'login' or 'register'
    this.isLoading = false;
  }

  /** Same origin as REST API (localStorage / query / default), not a hardcoded port. */
  getGoogleAuthUrl() {
    return `${apiService.getBaseURL()}/users/auth/google`;
  }

  render() {
    const container = document.querySelector(this.containerSelector);
    if (!container) return;

    if (this.mode === 'login') {
      container.innerHTML = `
        <h2>Login</h2>
        <div class="error-message" id="error-message"></div>
        <div class="form-group">
          <label for="login-email">Email</label>
          <input type="email" id="login-email" placeholder="your@email.com" required>
        </div>
        <div class="form-group password-input-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" placeholder="Password" required>
        </div>
        <button type="submit" id="login-button">Login</button>
        <div class="divider">or</div>
        <a href="${this.getGoogleAuthUrl()}" class="google-signin-btn">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Login with Google
        </a>
        <div class="toggle-form">
          Don't have an account? <a onclick="switchToRegister()">Register</a>
        </div>
      `;
    } else {
      container.innerHTML = `
        <h2>Register</h2>
        <div class="error-message" id="error-message"></div>
        <div class="form-group">
          <label for="register-name">Full Name</label>
          <input type="text" id="register-name" placeholder="John Doe" required>
        </div>
        <div class="form-group">
          <label for="register-email">Email</label>
          <input type="email" id="register-email" placeholder="your@email.com" required>
        </div>
        <div class="form-group password-input-group">
          <label for="register-password">Password</label>
          <input type="password" id="register-password" placeholder="At least 6 characters" required>
        </div>
        <div class="form-group password-input-group">
          <label for="register-password-confirm">Confirm Password</label>
          <input type="password" id="register-password-confirm" placeholder="Confirm Password" required>
        </div>
        <button type="submit" id="register-button">Register</button>
        <div class="divider">or</div>
        <a href="${this.getGoogleAuthUrl()}" class="google-signin-btn">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Register with Google
        </a>
        <div class="toggle-form">
          Already have an account? <a onclick="switchToLogin()">Login</a>
        </div>
      `;
    }

    // Attach event listener to form
    const form = document.querySelector('#auth-form');
    form.onsubmit = (e) => this.handleSubmit(e);
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (this.isLoading) return;
    this.isLoading = true;

    try {
      if (this.mode === 'login') {
        await this.handleLogin();
      } else {
        await this.handleRegister();
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleLogin() {
    const email = document.querySelector('#login-email').value.trim();
    const password = document.querySelector('#login-password').value;

    if (!email || !password) {
      this.showError('Email and password are required');
      return;
    }

    try {
      const user = await apiService.login({ email, password });
      this.clearError();
      // Emit custom event for successful login
      window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
    } catch (error) {
      this.showError(error.message);
    }
  }

  async handleRegister() {
    const name = document.querySelector('#register-name').value.trim();
    const email = document.querySelector('#register-email').value.trim();
    const password = document.querySelector('#register-password').value;
    const confirmPassword = document.querySelector('#register-password-confirm').value;

    if (!name || !email || !password) {
      this.showError('All fields are required');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }

    try {
      const user = await apiService.register({ email, name, password });
      this.clearError();
      // Emit custom event for successful registration
      window.dispatchEvent(new CustomEvent('auth:register', { detail: user }));
    } catch (error) {
      this.showError(error.message);
    }
  }

  showError(message) {
    const errorElement = document.querySelector('#error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }
  }

  clearError() {
    const errorElement = document.querySelector('#error-message');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('show');
    }
  }

  switchMode(mode) {
    this.mode = mode;
    this.render();
  }
}

// Global helper functions for inline event handlers
window.togglePassword = function(inputId) {
  const input = document.querySelector(`#${inputId}`);
  const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
  input.setAttribute('type', type);
};

window.switchToLogin = function() {
  const authComponent = window.authComponent;
  if (authComponent) {
    authComponent.switchMode('login');
  }
};

window.switchToRegister = function() {
  const authComponent = window.authComponent;
  if (authComponent) {
    authComponent.switchMode('register');
  }
};

export default AuthComponent;
