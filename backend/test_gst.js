import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

async function testGst() {
  const gstin = '09AAACA1234A1Z5'; // Still dummy, let's see what the API returns for invalid or format
  const apiKey = process.env.GSTIN_API_KEY;
  try {
    const res = await axios.get(`https://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`);
    console.log(res.data);
  } catch (err) {
    console.error(err.message);
    if (err.response) console.error(err.response.data);
  }
}
testGst();
