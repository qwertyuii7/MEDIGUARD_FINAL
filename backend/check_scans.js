import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from './config/db.js';
import Scan from './models/Scan.model.js';

async function checkScans() {
  await connectDB();
  const scans = await Scan.find({}).lean();
  console.log("Total Scans:", scans.length);
  if (scans.length > 0) {
    console.log("First scan user ID:", scans[0].user);
    console.log("First scan image URL:", scans[0].imageUrl);
  }
  process.exit(0);
}
checkScans();
