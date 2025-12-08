import { useState, useCallback } from 'react';

export const useLoading = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);

    // Function to set loading state to true
  const startLoading = useCallback(() => {
    setLoading(true);
  }, []);

  // Function to set loading state to false
  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  return {
    loading,
    startLoading,
    stopLoading,
  };
};