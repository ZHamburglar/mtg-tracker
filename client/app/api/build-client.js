import axios from "axios";
import https from "https";

export default () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isBuilding = process.env.NEXT_PHASE === 'phase-production-build';

  // Skip API calls during build time
  if (isBuilding) {
    console.log('Build time - skipping API client creation');
    return axios.create({
      baseURL: "http://localhost:3000",
    });
  }

  if (isDevelopment) {
    // In development, use the backend at mtg-tracker.local
    // Use session cookie from environment variable
    const sessionCookie = process.env.NEXT_PUBLIC_SESSION_COOKIE;
    
    console.log('Development mode - using mtg-tracker.local');
    console.log('Session cookie available:', !!sessionCookie);
    console.log('Cookie length:', sessionCookie ? sessionCookie.length : 0);
    
    const headers = {};
    
    if (sessionCookie) {
      // The cookie value already includes the full session data
      // Just needs to be formatted as: session=<value>
      headers['cookie'] = `session=${sessionCookie}`;
      console.log('Cookie header set:', headers['cookie'].substring(0, 50) + '...');
    } else {
      console.warn('WARNING: No NEXT_PUBLIC_SESSION_COOKIE found in environment!');
    }
    
    return axios.create({
      baseURL: "https://mtg-tracker.local",
      headers,
      // Disable SSL verification for local development
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
  }

    if (isProduction) {
      // Running in Kubernetes cluster - use internal service name
      console.log('Server-side request (K8s cluster)');
      return axios.create({
        baseURL: "https://mtg-tracker.local",
        headers: {
          Host: 'mtg-tracker.local', // Tell ingress which host this request is for
          'X-Forwarded-Proto': 'https' // Prevent SSL redirect loop
        }
      });
    }
};
