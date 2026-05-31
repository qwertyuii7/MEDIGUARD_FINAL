import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

async function listModels() {
  try {
    const res = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    console.log(res.data.data.map(m => m.id).join('\n'));
  } catch (err) {
    console.error(err.message);
  }
}
listModels();
