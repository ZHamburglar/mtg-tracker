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
    // Check if we're running in the browser or on the server
    const isBrowser = typeof window !== 'undefined';
    
    const headers = {};
    
    // Only set cookie header on server-side requests
    // Browser automatically sends cookies, and manually setting them is blocked
    if (!isBrowser) {
      const sessionCookie = process.env.NEXT_PUBLIC_SESSION_COOKIE;
      
      if (sessionCookie) {
        // The cookie value already includes the full session data
        // Just needs to be formatted as: session=<value>
        headers['cookie'] = `session=${sessionCookie}`;
      }
    }
    
    return axios.create({
      baseURL: "https://mtg-tracker.local",
      headers,
      withCredentials: true, // Allow cookies to be sent/received in browser
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
