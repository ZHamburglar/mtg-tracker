import { useState, useCallback } from 'react';

/**
 * Enhanced loading hook that supports multiple named loading states
 * Can be used as a simple boolean or track multiple operations
 * 
 * @param {boolean|object} initialState - Initial loading state(s)
 * @returns {object} Loading state and control functions
 * 
 * @example
 * // Simple usage (backward compatible)
 * const { loading, startLoading, stopLoading } = useLoading();
 * 
 * @example
 * // Multiple loading states
 * const { loading, startLoading, stopLoading, isLoading } = useLoading({
 *   fetchingCard: false,
 *   addingToCollection: false
 * });
 * // Check specific state: isLoading('fetchingCard')
 * // Set state: startLoading('addingToCollection')
 */
export const useLoading = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);

  // Check if we're using multiple loading states (object) or single (boolean)
  const isMultiState = typeof initialState === 'object' && initialState !== null;

  // Function to set loading state to true
  const startLoading = useCallback((key) => {
    if (isMultiState && key) {
      setLoading(prev => ({ ...prev, [key]: true }));
    } else {
      setLoading(true);
    }
  }, [isMultiState]);

  // Function to set loading state to false
  const stopLoading = useCallback((key) => {
    if (isMultiState && key) {
      setLoading(prev => ({ ...prev, [key]: false }));
    } else {
      setLoading(false);
    }
  }, [isMultiState]);

  // Helper to check if any or specific key is loading
  const isLoading = useCallback((key) => {
    if (isMultiState) {
      if (key) {
        return loading[key] || false;
      }
      // Check if ANY loading state is true
      return Object.values(loading).some(state => state === true);
    }
    return loading;
  }, [loading, isMultiState]);

  return {
    loading: isMultiState ? loading : loading, // Return full object or boolean
    startLoading,
    stopLoading,
    isLoading,
  };
};