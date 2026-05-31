import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

async function testGroqModels() {
  const apiKey = process.env.GROQ_API_KEY;
  // A valid small 2x2 png base64
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMDA4YAQEB4lBAAAAAElFTkSuQmCC';
  const modelsToTest = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.2-11b-vision-preview'
  ];

  for (const model of modelsToTest) {
    console.log('Testing model:', model);
    try {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: model,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
              { type: 'text', text: 'What is this?' }
            ]
          }],
          max_tokens: 10
        },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      console.log('Success!', res.data.choices[0].message.content);
    } catch (err) {
      console.error('Error:', err.response?.data?.error?.message || err.message);
    }
  }
}
testGroqModels();
