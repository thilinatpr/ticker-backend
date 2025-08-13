/**
 * CORS middleware configuration for Google Apps Script compatibility
 */
import cors from 'cors';

// Configure CORS to allow requests from Google's domains
const corsOptions = {
  origin: [
    'https://script.google.com',
    'https://script.googleusercontent.com',
    'https://docs.google.com',
    'https://sheets.google.com',
    // Allow localhost for development
    'http://localhost:3000',
    'http://localhost:8080',
    // Allow your frontend domain if you have one
    /\.vercel\.app$/,
    /\.netlify\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-API-Key',
    'X-Requested-With'
  ],
  credentials: false, // Apps Script doesn't send credentials
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

export const corsMiddleware = cors(corsOptions);

// For Vercel serverless functions, we need to handle CORS manually
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}