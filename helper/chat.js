 
import dotenv from 'dotenv';

import axios from 'axios';

import { OpenAI } from 'openai';

import jwt from 'jsonwebtoken';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const handleBackendMessage = async (message) => {
    const backendKeyword = "FOR BACKEND:";
    const secretKey = process.env.SECRET_KEY; // Load the secret key from .env

    console.log('Processing message:', message);

    if (message.includes(backendKeyword)) {
        console.log('FOR BACKEND detected.');

        // Extract the URL after "FOR BACKEND:"
        const urlStartIndex = message.indexOf(backendKeyword) + backendKeyword.length;
        let url = message.substring(urlStartIndex).trim();

        // Remove any surrounding brackets
        url = url.replace(/^\[|\]$/g, '');

        console.log('Extracted URL:', url);

        if (url) {
            try {
                // Create an HS256 encoded token
                const token = jwt.sign({}, secretKey, { algorithm: 'HS256' });

                // Fetch the JSON data from the extracted URL with Bearer token
                const response = await axios.get(url, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const properties = response.data;

                if (Array.isArray(properties)) {
                    // Extract title and guid fields
                    const extractedData = properties.map(property => ({
                        title: property.title || 'No title available',
                        guid: property.guid || 'No GUID available'
                    }));

                    // Format the extracted data as a user message
                    const formattedMessage = extractedData.map(data => `Title: ${data.title}, GUID: ${data.guid}`).join('\n');
                    
                    return formattedMessage;
                } else {
                    console.error('Invalid data format received.');
                    return 'Error: Received data is not in expected format.';
                }
            } catch (error) {
                console.error('Error fetching or processing data:', error);
                return 'Error fetching data.';
            }
        } else {
            console.log('No URL found.');
        }
    } else {
        console.log('FOR BACKEND not found in the message.');
    }

    // If no "FOR BACKEND" message or no URL found, return null
    return null;
};


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