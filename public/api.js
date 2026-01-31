/**
 * Event Seat Optimizer - API Service
 * Client-side service for communicating with the backend
 */

class ApiService {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl || window.location.origin;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api${endpoint}`;

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        return this.request('/health');
    }

    // Events
    async getEvents() {
        return this.request('/events');
    }

    async createEvent(eventData) {
        return this.request('/events', {
            method: 'POST',
            body: eventData
        });
    }

    async getEvent(eventId) {
        return this.request(`/events/${eventId}`);
    }

    async updateEvent(eventId, eventData) {
        return this.request(`/events/${eventId}`, {
            method: 'PUT',
            body: eventData
        });
    }

    async deleteEvent(eventId) {
        return this.request(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    // Attendees
    async addAttendees(eventId, attendees) {
        return this.request(`/events/${eventId}/attendees`, {
            method: 'POST',
            body: { attendees }
        });
    }

    async removeAttendee(eventId, attendeeId) {
        return this.request(`/events/${eventId}/attendees/${attendeeId}`, {
            method: 'DELETE'
        });
    }

    // Optimization
    async optimizeEvent(eventId, options = {}) {
        return this.request(`/events/${eventId}/optimize`, {
            method: 'POST',
            body: options
        });
    }

    async optimizeDirect(venue, attendees, options = {}) {
        return this.request('/optimize', {
            method: 'POST',
            body: {
                venue,
                attendees,
                mode: options.mode || 'balanced',
                weights: options.weights || {
                    friendProximity: 40,
                    vipPlacement: 35,
                    groupCohesion: 25
                }
            }
        });
    }

    // Seating Plan
    async getSeatingPlan(eventId) {
        return this.request(`/events/${eventId}/seating-plan`);
    }

    // Import/Export
    async importEvent(eventData) {
        return this.request('/import', {
            method: 'POST',
            body: { eventData }
        });
    }

    async exportEvent(eventId) {
        return this.request(`/events/${eventId}/export`);
    }
}

// Create global instance
window.api = new ApiService();
