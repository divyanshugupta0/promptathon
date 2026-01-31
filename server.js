/**
 * Event Seat Optimizer - Express Server
 * Backend API for seating optimization with persistent storage
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { GoogleGenAI } = require("@google/genai");

// Import the optimizer engine
const SeatOptimizer = require('./lib/optimizer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Data storage path
const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize events file if it doesn't exist
if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events: [] }, null, 2));
}

// Helper functions
function loadEvents() {
    try {
        const data = fs.readFileSync(EVENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { events: [] };
    }
}

function saveEvents(data) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
}

function findEvent(eventId) {
    const data = loadEvents();
    return data.events.find(e => e.id === eventId);
}

// =====================================
// API Routes
// =====================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

/**
 * GET /api/events
 * Get all events
 */
app.get('/api/events', (req, res) => {
    try {
        const data = loadEvents();
        res.json({
            success: true,
            events: data.events.map(e => ({
                id: e.id,
                name: e.name,
                createdAt: e.createdAt,
                venue: e.venue,
                attendeeCount: e.attendees?.length || 0,
                hasSeatingPlan: !!e.seatingPlan
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/events
 * Create a new event
 */
app.post('/api/events', (req, res) => {
    try {
        const { name, venue, attendees } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Event name is required' });
        }

        const event = {
            id: uuidv4(),
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            venue: venue || null,
            attendees: attendees || [],
            seatingPlan: null,
            optimizationHistory: []
        };

        const data = loadEvents();
        data.events.push(event);
        saveEvents(data);

        res.status(201).json({ success: true, event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/events/:id
 * Get a specific event
 */
app.get('/api/events/:id', (req, res) => {
    try {
        const event = findEvent(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        res.json({ success: true, event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/events/:id
 * Update an event
 */
app.put('/api/events/:id', (req, res) => {
    try {
        const data = loadEvents();
        const eventIndex = data.events.findIndex(e => e.id === req.params.id);

        if (eventIndex === -1) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const { name, venue, attendees } = req.body;

        if (name) data.events[eventIndex].name = name;
        if (venue) data.events[eventIndex].venue = venue;
        if (attendees) data.events[eventIndex].attendees = attendees;
        data.events[eventIndex].updatedAt = new Date().toISOString();

        saveEvents(data);

        res.json({ success: true, event: data.events[eventIndex] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/events/:id
 * Delete an event
 */
app.delete('/api/events/:id', (req, res) => {
    try {
        const data = loadEvents();
        const eventIndex = data.events.findIndex(e => e.id === req.params.id);

        if (eventIndex === -1) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        data.events.splice(eventIndex, 1);
        saveEvents(data);

        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/events/:id/attendees
 * Add attendees to an event
 */
app.post('/api/events/:id/attendees', (req, res) => {
    try {
        const data = loadEvents();
        const eventIndex = data.events.findIndex(e => e.id === req.params.id);

        if (eventIndex === -1) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const { attendees } = req.body;

        if (!Array.isArray(attendees)) {
            return res.status(400).json({ success: false, error: 'Attendees must be an array' });
        }

        // Add IDs to new attendees
        const newAttendees = attendees.map(a => ({
            ...a,
            id: a.id || uuidv4(),
            addedAt: new Date().toISOString()
        }));

        data.events[eventIndex].attendees.push(...newAttendees);
        data.events[eventIndex].updatedAt = new Date().toISOString();
        saveEvents(data);

        res.json({
            success: true,
            attendees: data.events[eventIndex].attendees,
            addedCount: newAttendees.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/events/:id/attendees/:attendeeId
 * Remove an attendee from an event
 */
app.delete('/api/events/:id/attendees/:attendeeId', (req, res) => {
    try {
        const data = loadEvents();
        const eventIndex = data.events.findIndex(e => e.id === req.params.id);

        if (eventIndex === -1) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const attendeeIndex = data.events[eventIndex].attendees.findIndex(
            a => a.id === req.params.attendeeId
        );

        if (attendeeIndex === -1) {
            return res.status(404).json({ success: false, error: 'Attendee not found' });
        }

        data.events[eventIndex].attendees.splice(attendeeIndex, 1);
        data.events[eventIndex].updatedAt = new Date().toISOString();
        saveEvents(data);

        res.json({ success: true, message: 'Attendee removed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/events/:id/optimize
 * Run optimization algorithm for an event
 */
app.post('/api/events/:id/optimize', async (req, res) => {
    try {
        const data = loadEvents();
        const eventIndex = data.events.findIndex(e => e.id === req.params.id);

        if (eventIndex === -1) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const event = data.events[eventIndex];

        if (!event.venue) {
            return res.status(400).json({ success: false, error: 'Venue not configured' });
        }

        if (!event.attendees || event.attendees.length === 0) {
            return res.status(400).json({ success: false, error: 'No attendees to optimize' });
        }

        const { mode, weights } = req.body;

        // Create optimizer instance
        const optimizer = new SeatOptimizer({
            mode: mode || 'balanced',
            friendWeight: weights?.friendProximity || 40,
            vipWeight: weights?.vipPlacement || 35,
            groupWeight: weights?.groupCohesion || 25
        });

        // Configure venue
        optimizer.setVenue(event.venue.rows, event.venue.cols, event.venue.vipRows);
        optimizer.setAttendees(event.attendees);

        // Run optimization
        const result = await optimizer.optimize();

        // Get seating plan
        const seatingPlan = optimizer.getSeatingPlan(result.solution);

        // Save results
        data.events[eventIndex].seatingPlan = seatingPlan;
        data.events[eventIndex].lastOptimization = {
            timestamp: new Date().toISOString(),
            fitness: result.fitness,
            mode,
            weights
        };
        data.events[eventIndex].optimizationHistory.push({
            timestamp: new Date().toISOString(),
            score: result.fitness.total
        });
        data.events[eventIndex].updatedAt = new Date().toISOString();

        saveEvents(data);

        res.json({
            success: true,
            seatingPlan,
            fitness: result.fitness,
            history: result.history
        });
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/events/:id/seating-plan
 * Get the current seating plan for an event
 */
app.get('/api/events/:id/seating-plan', (req, res) => {
    try {
        const event = findEvent(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        if (!event.seatingPlan) {
            return res.status(404).json({ success: false, error: 'No seating plan generated yet' });
        }

        res.json({
            success: true,
            seatingPlan: event.seatingPlan,
            lastOptimization: event.lastOptimization
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/optimize
 * Direct optimization without event storage (for quick calculations)
 */
app.post('/api/optimize', async (req, res) => {
    try {
        const { venue, attendees, mode, weights } = req.body;

        if (!venue || !venue.rows || !venue.cols) {
            return res.status(400).json({ success: false, error: 'Invalid venue configuration' });
        }

        if (!attendees || attendees.length === 0) {
            return res.status(400).json({ success: false, error: 'No attendees provided' });
        }

        if (attendees.length > venue.rows * venue.cols) {
            return res.status(400).json({ success: false, error: 'Too many attendees for venue capacity' });
        }

        // Create optimizer
        const optimizer = new SeatOptimizer({
            mode: mode || 'balanced',
            friendWeight: weights?.friendProximity || 40,
            vipWeight: weights?.vipPlacement || 35,
            groupWeight: weights?.groupCohesion || 25
        });

        optimizer.setVenue(venue.rows, venue.cols, venue.vipRows || 2);
        optimizer.setAttendees(attendees);

        // Run optimization
        const result = await optimizer.optimize();
        const seatingPlan = optimizer.getSeatingPlan(result.solution);

        res.json({
            success: true,
            seatingPlan,
            fitness: result.fitness,
            convergenceHistory: result.history
        });
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/import
 * Import event data from JSON
 */
app.post('/api/import', (req, res) => {
    try {
        const { eventData } = req.body;

        if (!eventData) {
            return res.status(400).json({ success: false, error: 'No event data provided' });
        }

        const event = {
            id: uuidv4(),
            name: eventData.name || 'Imported Event',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            venue: eventData.venue || null,
            attendees: eventData.attendees || [],
            seatingPlan: eventData.seatingPlan || null,
            optimizationHistory: []
        };

        const data = loadEvents();
        data.events.push(event);
        saveEvents(data);

        res.status(201).json({ success: true, event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/events/:id/export
 * Export event data as JSON
 */
app.get('/api/events/:id/export', (req, res) => {
    try {
        const event = findEvent(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        res.json({
            success: true,
            exportData: {
                name: event.name,
                venue: event.venue,
                attendees: event.attendees,
                seatingPlan: event.seatingPlan,
                exportedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/gemini/insights
 * Get AI analysis of the seating plan using Gemini
 */
app.post('/api/gemini/insights', async (req, res) => {
    try {
        const { venue, seatingPlan } = req.body;
        if (!venue || !seatingPlan) {
            return res.status(400).json({ success: false, error: 'Missing venue or seating plan' });
        }

        // Initialize new SDK client
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const modelName = "gemini-2.5-flash";

        console.log(`🤖 Generating insights using ${modelName}...`);

        const prompt = `
        Analyze this seating arrangement for an event.
        Venue: ${venue.rows} rows x ${venue.cols} columns.
        Seating Plan (Array of attendees at specific coordinates):
        ${JSON.stringify(seatingPlan.slice(0, 50))}... (truncated for brevity)
        
        Provide a concise analysis in the following format:
        ### Overview
        [General impression]
        
        ### Strengths
        - [Point 1]
        - [Point 2]
        
        ### Improvements needed
        - [Point 1]
        - [Point 2]
        
        ### Recommendation
        [One specific actionable change]
        `;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt
        });
        const analysis = response.text;

        res.json({ success: true, analysis });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/gemini/optimize
 * Generate seating plan using Gemini
 */
app.post('/api/gemini/optimize', async (req, res) => {
    try {
        const { venue, attendees } = req.body;

        if (!venue || !attendees) {
            return res.status(400).json({ success: false, error: 'Missing venue or attendees' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const modelName = "gemini-2.5-flash";

        console.log(`🤖 Gemini optimizing seating for ${attendees.length} people using ${modelName}...`);

        const prompt = `
        Create a seating assignment for this event.
        Venue: ${venue.rows} rows x ${venue.cols} columns.
        Attendees: ${JSON.stringify(attendees.map(a => ({ id: a.id, name: a.name, group: a.traits?.group, type: a.traits?.type })))}
        
        Rules:
        1. VIPs preferably in front rows (low row numbers).
        2. People in same group should be adjacent.
        3. Fill from front (row 1) to back.
        
        Return ONLY a JSON object with this structure:
        {
            "assignments": [
                { "seatId": "r1c1", "attendeeId": "attendee_id_1" },
                ...
            ]
        }
        `;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const resultJson = JSON.parse(response.text);
        res.json({ success: true, solution: resultJson });

    } catch (error) {
        console.error('Gemini Optimization Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🎪 Event Seat Optimizer Server                           ║
║                                                               ║
║     Running on: http://localhost:${PORT}                        ║
║                                                               ║
║     API Endpoints:                                            ║
║     • GET  /api/events         - List all events              ║
║     • POST /api/events         - Create new event             ║
║     • POST /api/events/:id/optimize - Run optimization        ║
║     • POST /api/optimize       - Quick optimization           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
