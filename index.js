import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createMessage, createRun, createThread, getThreadMessages } from './helper/chat.js';

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

        result = await getThreadMessages(run)
    } catch (error) {
        return res.status(500).json({ error: `An error occurred: ${error.message}` });
    }

    return res.json({ messages: result });
});

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));

