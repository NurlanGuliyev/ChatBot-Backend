import express from 'express';
import openai from './helper/openai.js';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// In-memory store for client sessions and thread IDs
const clientSessions = {};

// Define the function that prints "Nurlan Guliyev"
function printAmenities(amenities) {
    console.log("Nurlan Guliyevin sanat eseri", amenities);
    // Perform any necessary actions with the amenities (e.g., save to database, send notification, etc.)
}

// Function to extract amenities from the assistant's response
function extractAmenities(text) {
    const amenityPattern = /^\d+\.\s(.+)/; // Pattern to match lines with numbered lists
    const lines = text.split('\n');
    const amenities = [];

    lines.forEach(line => {
        const match = line.match(amenityPattern);
        if (match) {
            amenities.push(match[1].trim());
        }
    });

    return amenities;
}

// Function to generate URL based on amenities and fetch data from the URL
async function generateURL(amenities) {
    const baseURL = "https://metarealtyinc.ca/wp-json/custom/v1/projects?tax_amenities=";

    if (!Array.isArray(amenities) || amenities.length === 0) {
        return baseURL;
    }

    // Encode each amenity to ensure it's URL-safe
    const encodedAmenities = amenities.map(encodeURIComponent);

    // Join the encoded amenities with commas and append to the base URL
    const fullURL = `${baseURL}${encodedAmenities.join(',')}`;

    console.log('Generated URL:', fullURL);

    try {
        const response = await axios.get(fullURL);
        const data = response.data;

        const estateData = data.map(item => ({
            link: item.guid,
            title: item.title
        }));

        console.log('Fetched Estate Data:', estateData);

        return estateData;

    } catch (error) {
        console.error('Error fetching data from URL:', error);
        return [];
    }
}

// Endpoint to handle user chat messages
app.post('/api/chat', async (req, res) => {
    const { message: userInput, clientId } = req.body;

    if (!userInput || !clientId) {
        return res.status(400).json({ error: 'Message and clientId are required' });
    }

    try {
        let threadId = clientSessions[clientId];

        if (!threadId) {
            // Create a new thread if it doesn't exist for the client
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            clientSessions[clientId] = threadId;
            clientSessions[`${clientId}_firstMessageProcessed`] = false; // Initialize the flag
            console.log('Thread created:', threadId);
        } else {
            console.log('Using existing thread:', threadId);
        }

        const message = await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: userInput
        });
        console.log('Message created:', message.id);

        let run = await openai.beta.threads.runs.createAndPoll(threadId, {
            assistant_id: process.env.OPENAI_ASSISTANT_ID,
            tool_choice: 'auto'
        });
        console.log('Run created and polled:', run.status);

        if (run.status === 'completed' || run.status === 'requires_action') {
            const messages = await openai.beta.threads.messages.list(run.thread_id);
            const responses = messages.data.reverse().map(msg => ({
                role: msg.role,
                content: msg.content[0].text.value
            }));
            console.log('Messages retrieved:', responses);

            // Check if the last assistant message indicates amenities are being finalized
            const assistantMessages = responses.filter(msg => msg.role === 'assistant');

            if (assistantMessages.length > 0) {
                const firstMessageProcessed = clientSessions[`${clientId}_firstMessageProcessed`];
                
                if (firstMessageProcessed) {
                    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]; // Get the latest assistant message

                    // Extract amenities from the last assistant message
                    const amenities = extractAmenities(lastAssistantMessage.content);

                    // Call the function with the amenities
                    if (amenities.length > 0) {
                        printAmenities(amenities);

                        // Generate URL and fetch data based on amenities
                        const fetchedData = await generateURL(amenities);

                        // Include fetched data in a single assistant message
                        const fetchedDataMessage = {
                            role: 'assistant',
                            content: fetchedData.map(item => `Estate: ${item.title} - <a href="${item.link}" target="_blank">${item.link}</a>`).join('<br />')
                        };

                        // Add fetched data message to the responses
                        responses.push(fetchedDataMessage);

                        // Return responses to the frontend
                        return res.json({ messages: responses });
                    }
                } else {
                    clientSessions[`${clientId}_firstMessageProcessed`] = true;
                }
            }

            // Return responses to the frontend
            return res.json({ messages: responses });
        } else {
            console.error('Run did not complete');
            return res.status(500).json({ error: 'Run did not complete' });
        }

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'An error occurred' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
