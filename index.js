import express from 'express';
import openai from './config/openai.js';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import { saveDataToFile } from './config/fetchAndSaveData.js';
dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// In-memory store for client sessions and thread IDs
const clientSessions = {};

// Fetch and save data on server start
//saveDataToFile().catch(console.error);


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

