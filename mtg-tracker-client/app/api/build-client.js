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
    // In development, use localhost:3000 which proxies to mtg-tracker.local
    // This ensures cookies are set on localhost:3000 domain
    console.log('Development mode - using localhost:3000 (proxied)');
    return axios.create({
      baseURL: "https://mtg-tracker.local",
      withCredentials: true,
    });
  }

  if (isProduction) {
    // Running in Kubernetes cluster
    console.log('Production mode - using mtg-tracker.local');
    return axios.create({
      baseURL: "https://mtg-tracker.local",
      withCredentials: true,
    });
  }
};
