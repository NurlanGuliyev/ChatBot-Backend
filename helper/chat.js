 
import dotenv from 'dotenv';

import { OpenAI } from 'openai';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const createThread = async (clientSessions, clientId) => {
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

    return threadId;
}

export const createMessage = async (threadId, content) => {
    const result = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content
    });

    console.log('Message created:', result.id);

    return result;
}

export const createRun = async (threadId) => {
    const result = await openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: process.env.OPENAI_ASSISTANT_ID,
        tool_choice: 'auto'
    });

    console.log('Run created and polled:', result.status);

    return result;
}

export const isRunSuccessful = (run) => run.status === 'completed' || run.status === 'requires_action';

export const getThreadMessages = async (run) => {
    const { data } = await openai.beta.threads.messages.list(run.thread_id);

    const result = data.reverse().map(({ role, content }) => ({
        role,
        content: content[0].text.value
    }));

    console.log('Messages retrieved:', result);

    return result;
}