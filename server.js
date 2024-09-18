import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";
import { config } from 'dotenv';
import twilio from 'twilio';
import cron from 'node-cron';
import axios from 'axios';
import cookieParser from 'cookie-parser';  // Import cookie-parser

// Load environment variables
config();  // This should be at the very top

const PORT = process.env.PORT || 8080;

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
}

const client = twilio(accountSid, authToken);

installGlobals();

const remixHandler = createRequestHandler({
  build: await import("./build/server/index.js")
});

const app = express();

app.use("/assets", express.static("./build/client/assets"));
app.use(cookieParser());  // Use cookie-parser middleware

// Set up the cron job to run every 15 minutes
// Uncomment the following block if the cron job is needed

// cron.schedule('*/15 * * * *', async () => {
//   console.log('Cron job started');
//   try {
//     const response = await axios.post(
//       process.env.ENTRONOONA_RUN_ENDPOINT,  // Endpoint where you send the request
//       {}, // Empty data payload
//       {
//         headers: {
//           'x-entronoona-hash': process.env.SECRET  // Use the SECRET as the hash
//         }
//       }
//     );b
//     console.log('HTTP Request successful:', response.data);
//   } catch (error) {
//     console.error('HTTP Request failed:', error);
//   }
//   console.log('Cron job finished');
// });


app.all("*", remixHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
