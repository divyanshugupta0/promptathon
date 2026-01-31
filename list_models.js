require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");

async function list() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        // Attempt to list models. If this fails, I'll print the error structure.
        // Note: In @google/genai (v0.1+), it might be different.
        // If this is the *newest* SDK, it follows the specific pattern.
        // Let's assume ai.models.list() works or check error.
        const response = await ai.models.list();
        console.log("Models:", JSON.stringify(response, null, 2));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

list();
