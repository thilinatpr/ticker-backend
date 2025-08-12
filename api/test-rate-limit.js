import { setCorsHeaders } from '../middleware/cors.js';
import { getTimeUntilNextCall } from '../lib/polygon-api.js';

async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const waitTime = await getTimeUntilNextCall();
    
    res.json({
      success: true,
      rateLimit: {
        waitTime,
        canMakeCall: waitTime === 0,
        nextCallIn: waitTime > 0 ? `${Math.ceil(waitTime/1000)} seconds` : 'now'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Rate limit check failed',
      message: error.message
    });
  }
}

export default handler;