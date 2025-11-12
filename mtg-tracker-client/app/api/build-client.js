import axios from "axios";
import https from "https";

export default () => {
  if (typeof window === "undefined") {
    // We are on the server
    const isProduction = process.env.NODE_ENV === 'production';
    const isBuilding = process.env.NEXT_PHASE === 'phase-production-build';
    
    // Skip API calls during build time
    if (isBuilding) {
      console.log('Build time - skipping API client creation');
      return axios.create({
        baseURL: "http://localhost:3000",
        // This will fail gracefully during build, caught by try-catch in layout
      });
    }
    
    if (isProduction) {
      // Running in Kubernetes cluster - use internal service name
      console.log('Server-side request (K8s cluster)');
      
      return axios.create({
        baseURL: "http://ingress-nginx-controller.ingress-nginx.svc.cluster.local:80",
        headers: {
          Host: 'mtg-tracker.local', // Tell ingress which host this request is for
          'X-Forwarded-Proto': 'https' // Prevent SSL redirect loop
        }
      });
    } else {
      // Running locally with 'npm run dev' - not in cluster, use external domain
      console.log('Server-side request (local dev)');
      return axios.create({
        baseURL: "https://mtg-tracker.local",
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Ignore self-signed certificate errors in dev
        })
      });
    }
  } else {
    console.log('Browser-side request');
    // We are on the browser
    return axios.create({
      baseURL: "/",
    });
  }
};
