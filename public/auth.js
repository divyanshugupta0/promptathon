/**
 * Authentication Page Controller
 * Handles login, signup, password validation, and theme toggle
 */

class AuthController {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.initTheme();
    }

    initElements() {
        // Theme toggle
        this.themeToggle = document.getElementById('themeToggle');

        // Tabs
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabIndicator = document.querySelector('.tab-indicator');

        // Forms
        this.loginForm = document.getElementById('loginForm');
        this.signupForm = document.getElementById('signupForm');

        // Login inputs
        this.loginEmail = document.getElementById('loginEmail');
        this.loginPassword = document.getElementById('loginPassword');
        this.loginError = document.getElementById('loginError');

        // Signup inputs
        this.signupName = document.getElementById('signupName');
        this.signupEmail = document.getElementById('signupEmail');
        this.signupPassword = document.getElementById('signupPassword');
        this.confirmPassword = document.getElementById('confirmPassword');
        this.agreeTerms = document.getElementById('agreeTerms');
        this.signupBtn = document.getElementById('signupBtn');
        this.signupError = document.getElementById('signupError');

        // Password strength
        this.passwordStrength = document.getElementById('passwordStrength');
        this.strengthFill = this.passwordStrength?.querySelector('.strength-fill');
        this.strengthText = this.passwordStrength?.querySelector('.strength-text');

        // Match indicator
        this.matchIndicator = document.getElementById('matchIndicator');
        this.matchText = document.getElementById('matchText');

        // Password toggles
        this.passwordToggles = document.querySelectorAll('.toggle-password');

        // Social buttons
        this.googleLoginBtn = document.getElementById('googleLoginBtn');
        this.googleSignupBtn = document.getElementById('googleSignupBtn');
        this.githubLoginBtn = document.getElementById('githubLoginBtn');
        this.githubSignupBtn = document.getElementById('githubSignupBtn');
    }

    bindEvents() {
        // Theme toggle
        this.themeToggle?.addEventListener('click', () => this.toggleTheme());

        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Login form submission
        this.loginForm?.addEventListener('submit', (e) => this.handleLogin(e));

        // Signup form submission
        this.signupForm?.addEventListener('submit', (e) => this.handleSignup(e));

        // Password strength check
        this.signupPassword?.addEventListener('input', () => this.checkPasswordStrength());

        // Confirm password match
        this.confirmPassword?.addEventListener('input', () => this.checkPasswordMatch());
        this.signupPassword?.addEventListener('input', () => {
            if (this.confirmPassword?.value) this.checkPasswordMatch();
        });

        // Terms checkbox
        this.agreeTerms?.addEventListener('change', () => this.updateSignupButton());

        // Password visibility toggles
        this.passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', () => this.togglePasswordVisibility(toggle));
        });

        // Social login
        this.googleLoginBtn?.addEventListener('click', () => this.googleAuth());
        this.googleSignupBtn?.addEventListener('click', () => this.googleAuth());
        this.githubLoginBtn?.addEventListener('click', () => this.githubAuth());
        this.githubSignupBtn?.addEventListener('click', () => this.githubAuth());
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    switchTab(tab) {
        // Update tab buttons
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.dataset.form === tab);
        });

        // Clear errors
        this.loginError.style.display = 'none';
        this.signupError.style.display = 'none';
    }

    togglePasswordVisibility(toggle) {
        const input = toggle.parentElement.querySelector('input');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggle.classList.toggle('active', isPassword);
    }

    checkPasswordStrength() {
        const password = this.signupPassword.value;
        let strength = 0;
        let text = 'Password strength';

        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        // Remove all strength classes
        this.strengthFill.className = 'strength-fill';

        if (password.length === 0) {
            text = 'Password strength';
        } else if (strength <= 1) {
            this.strengthFill.classList.add('weak');
            text = 'Weak password';
        } else if (strength === 2) {
            this.strengthFill.classList.add('fair');
            text = 'Fair password';
        } else if (strength === 3) {
            this.strengthFill.classList.add('good');
            text = 'Good password';
        } else {
            this.strengthFill.classList.add('strong');
            text = 'Strong password';
        }

        this.strengthText.textContent = text;
        this.updateSignupButton();
    }

    checkPasswordMatch() {
        const password = this.signupPassword.value;
        const confirm = this.confirmPassword.value;

        if (confirm.length === 0) {
            this.matchIndicator.className = 'match-indicator';
            this.matchText.textContent = '';
            this.matchText.className = 'match-text';
        } else if (password === confirm) {
            this.matchIndicator.className = 'match-indicator match';
            this.matchText.textContent = 'Passwords match';
            this.matchText.className = 'match-text match';
        } else {
            this.matchIndicator.className = 'match-indicator mismatch';
            this.matchText.textContent = 'Passwords do not match';
            this.matchText.className = 'match-text mismatch';
        }

        this.updateSignupButton();
    }

    updateSignupButton() {
        const password = this.signupPassword?.value || '';
        const confirm = this.confirmPassword?.value || '';
        const termsAccepted = this.agreeTerms?.checked || false;
        const passwordMatch = password === confirm && password.length >= 6;

        this.signupBtn.disabled = !(passwordMatch && termsAccepted);
    }

    showError(element, message) {
        element.textContent = message;
        element.classList.add('show');
        element.style.display = 'block';
    }

    hideError(element) {
        element.classList.remove('show');
        element.style.display = 'none';
    }

    setLoading(button, loading) {
        button.classList.toggle('loading', loading);
        button.disabled = loading;
    }

    async handleLogin(e) {
        e.preventDefault();

        const email = this.loginEmail.value.trim();
        const password = this.loginPassword.value;
        const submitBtn = this.loginForm.querySelector('.btn-submit');

        this.hideError(this.loginError);
        this.setLoading(submitBtn, true);

        try {
            // Check if Firebase is configured
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                // Redirect happens in auth state observer
            } else {
                // Demo mode - simulate login
                console.log('Demo login:', email);
                localStorage.setItem('demoUser', JSON.stringify({ email, name: email.split('@')[0] }));
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Login error:', error);
            let message = 'Login failed. Please try again.';

            switch (error.code) {
                case 'auth/user-not-found':
                    message = 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    message = 'Incorrect password.';
                    break;
                case 'auth/invalid-email':
                    message = 'Invalid email address.';
                    break;
                case 'auth/too-many-requests':
                    message = 'Too many attempts. Please try again later.';
                    break;
            }

            this.showError(this.loginError, message);
        } finally {
            this.setLoading(submitBtn, false);
        }
    }

    async handleSignup(e) {
        e.preventDefault();

        const name = this.signupName.value.trim();
        const email = this.signupEmail.value.trim();
        const password = this.signupPassword.value;
        const confirm = this.confirmPassword.value;
        const submitBtn = this.signupForm.querySelector('.btn-submit');

        // Validate password match
        if (password !== confirm) {
            this.showError(this.signupError, 'Passwords do not match.');
            return;
        }

        this.hideError(this.signupError);
        this.setLoading(submitBtn, true);

        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                // Create user
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);

                // Update profile with name
                await userCredential.user.updateProfile({ displayName: name });

                // Save user data to database
                await firebase.database().ref(`users/${userCredential.user.uid}/profile`).set({
                    name,
                    email,
                    createdAt: Date.now()
                });

                // Redirect happens in auth state observer
            } else {
                // Demo mode
                console.log('Demo signup:', { name, email });
                localStorage.setItem('demoUser', JSON.stringify({ email, name }));
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Signup error:', error);
            let message = 'Signup failed. Please try again.';

            switch (error.code) {
                case 'auth/email-already-in-use':
                    message = 'An account with this email already exists.';
                    break;
                case 'auth/invalid-email':
                    message = 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    message = 'Password is too weak. Use at least 6 characters.';
                    break;
            }

            this.showError(this.signupError, message);
        } finally {
            this.setLoading(submitBtn, false);
        }
    }

    async googleAuth() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                const provider = new firebase.auth.GoogleAuthProvider();
                await firebase.auth().signInWithPopup(provider);
            } else {
                alert('Google authentication requires Firebase configuration.');
            }
        } catch (error) {
            console.error('Google auth error:', error);
            alert('Google sign-in failed. Please try again.');
        }
    }

    async githubAuth() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                const provider = new firebase.auth.GithubAuthProvider();
                await firebase.auth().signInWithPopup(provider);
            } else {
                alert('GitHub authentication requires Firebase configuration.');
            }
        } catch (error) {
            console.error('GitHub auth error:', error);
            alert('GitHub sign-in failed. Please try again.');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authController = new AuthController();
});
