/**
 * Authentication Service
 * Manages authentication state and user session
 */

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.loadAuthState();
  }

  loadAuthState() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('auth_user');
    
    if (token && userData) {
      try {
        this.currentUser = JSON.parse(userData);
        this.isAuthenticated = true;
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        this.clearAuth();
      }
    }
  }

  setAuthState(user, token) {
    this.currentUser = user;
    this.isAuthenticated = true;
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_token', token);
    window.dispatchEvent(new CustomEvent('auth:change', { detail: { user, isAuthenticated: true } }));
  }

  clearAuth() {
    this.currentUser = null;
    this.isAuthenticated = false;
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: null, isAuthenticated: false } }));
  }

  getUser() {
    return this.currentUser;
  }

  getUserId() {
    return this.currentUser ? this.currentUser.id : null;
  }

  isLoggedIn() {
    return this.isAuthenticated && this.currentUser !== null;
  }
}

export default new AuthService();
