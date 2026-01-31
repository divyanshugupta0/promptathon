/**
 * Firebase Configuration
 * Replace with your Firebase project credentials
 */

const firebaseConfig = {
    apiKey: "AIzaSyBH7CAbuDbBHTLB4KzrU-G795wAPv3ArOk",
    authDomain: "event-seat-manager.firebaseapp.com",
    databaseURL: "https://event-seat-manager-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "event-seat-manager",
    storageBucket: "event-seat-manager.firebasestorage.app",
    messagingSenderId: "203322489851",
    appId: "1:203322489851:web:8bab371e3c9aca0cc4a95e",
    measurementId: "G-DVDBDZ7QSC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Auth and Database references
const auth = firebase.auth();
const database = firebase.database();

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);

        // Redirect to main app if on auth page
        if (window.location.pathname.includes('auth.html')) {
            window.location.href = 'index.html';
        }
    } else {
        // User is signed out
        console.log('User signed out');

        // Redirect to auth if not on auth page
        if (!window.location.pathname.includes('auth.html') &&
            !window.location.pathname.endsWith('/')) {
            // Optional: Uncomment to enforce auth
            // window.location.href = 'auth.html';
        }
    }
});

// Helper functions for database operations
const dbHelpers = {
    // Save event data
    async saveEvent(eventId, eventData) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        return database.ref(`users/${user.uid}/events/${eventId}`).set({
            ...eventData,
            updatedAt: Date.now()
        });
    },

    // Get all events for current user
    async getEvents() {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        const snapshot = await database.ref(`users/${user.uid}/events`).once('value');
        return snapshot.val() || {};
    },

    // Get a specific event
    async getEvent(eventId) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        const snapshot = await database.ref(`users/${user.uid}/events/${eventId}`).once('value');
        return snapshot.val();
    },

    // Delete an event
    async deleteEvent(eventId) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        return database.ref(`users/${user.uid}/events/${eventId}`).remove();
    },

    // Save seating plan
    async saveSeatingPlan(eventId, plan) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        return database.ref(`users/${user.uid}/events/${eventId}/seatingPlan`).set({
            ...plan,
            savedAt: Date.now()
        });
    },

    // Real-time listener for events
    onEventsChange(callback) {
        const user = auth.currentUser;
        if (!user) return null;

        return database.ref(`users/${user.uid}/events`).on('value', (snapshot) => {
            callback(snapshot.val() || {});
        });
    },

    // Remove listener
    offEventsChange() {
        const user = auth.currentUser;
        if (!user) return;

        database.ref(`users/${user.uid}/events`).off();
    }
};

// Expose to global scope
window.firebaseAuth = auth;
window.firebaseDB = database;
window.dbHelpers = dbHelpers;
