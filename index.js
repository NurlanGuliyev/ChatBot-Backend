import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createMessage, createRun, createThread, getThreadMessages, isRunSuccessful, handleBackendMessage } from './helper/chat.js';

dotenv.config();

const PORT = process.env.PORT;

const app = express();

app.use(cors());

app.use(express.json());

const clientSessions = {};

app.post('/api/chat', async (req, res) => {
    const { message, clientId } = req.body;
    let result;

    if (!message || !clientId) 
        return res.status(400).json({ error: 'Message and clientId are required' });

    try {
        const threadId = await createThread(clientSessions, clientId);

        await createMessage(threadId, message);

        const run = await createRun(threadId);
 
        if (!isRunSuccessful(run)) 
            return res.status(500).json({ error: 'Run did not complete' });

        const threadMessages = await getThreadMessages(run);

        // Check if any message contains "FOR BACKEND" and process it
        for (let msg of threadMessages) {
            const backendResponse = await handleBackendMessage(msg.content);
            if (backendResponse) {
                // Inject the backend response as a user message
                await createMessage(threadId, backendResponse);
            }
        }

        // Retrieve the latest messages after processing backend messages
        result = await getThreadMessages(run);
        
    } catch (error) {
        return res.status(500).json({ error: `An error occurred: ${error.message}` });
    }

    return res.json({ messages: result });
});


app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));

