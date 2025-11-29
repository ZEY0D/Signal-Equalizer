/**
 * Custom React Hook for Signal Processing
 * Manages the complete signal processing workflow and state
 */

import { useState, useCallback } from 'react';
import * as api from '../services/api';

export function useSignalProcessor() {
  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Signal metadata
  const [signalInfo, setSignalInfo] = useState(null);

  // Signal data for visualization
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);

  // FFT data
  const [fftData, setFftData] = useState(null);

  // Slider state
  const [sliders, setSliders] = useState([]);

  /**
   * Upload audio file
   */
  const uploadFile = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.uploadFile(file);
      
      setSessionId(response.session_id);
      setSignalInfo({
        filename: response.filename,
        sample_rate: response.sample_rate,
        duration: response.duration,
        length: response.length,
      });

      // Automatically fetch input signal and FFT
      await Promise.all([
        fetchInputSignal(response.session_id),
        fetchFFT(response.session_id),
      ]);

      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create synthetic test signal
   */
  const createSynthetic = useCallback(async (params = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createSyntheticSignal(params);
      
      setSessionId(response.session_id);
      setSignalInfo({
        filename: 'Synthetic Signal',
        sample_rate: response.sample_rate,
        duration: response.duration,
        length: response.length,
      });

      // Automatically fetch input signal and FFT
      await Promise.all([
        fetchInputSignal(response.session_id),
        fetchFFT(response.session_id),
      ]);

      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch input signal data
   */
  const fetchInputSignal = useCallback(async (sid = sessionId) => {
    if (!sid) return;

    try {
      const data = await api.getInputSignal(sid);
      setInputSignal(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch input signal:', err);
      throw err;
    }
  }, [sessionId]);

  /**
   * Fetch output signal data
   */
  const fetchOutputSignal = useCallback(async (sid = sessionId) => {
    if (!sid) return;

    try {
      console.log('🔄 Fetching output signal...');
      const data = await api.getOutputSignal(sid);
      console.log('✓ Output signal received:', {
        length: data?.signal?.length || data?.length,
        sample_rate: data?.sample_rate,
        hasTimeAxis: !!data?.time_axis,
        maxAmplitude: data?.signal ? Math.max(...data.signal.map(Math.abs)) : 'N/A'
      });
      setOutputSignal(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch output signal:', err);
      throw err;
    }
  }, [sessionId]);

  /**
   * Fetch FFT data
   */
  const fetchFFT = useCallback(async (sid = sessionId) => {
    if (!sid) return;

    try {
      const data = await api.computeFFT(sid);
      setFftData(data);
      return data;
    } catch (err) {
      console.error('Failed to compute FFT:', err);
      throw err;
    }
  }, [sessionId]);

  /**
   * Process signal with current sliders
   */
  const processSignal = useCallback(async (customSliders = null) => {
    if (!sessionId) {
      throw new Error('No session available');
    }

    setIsLoading(true);
    setError(null);

    try {
      const slidersToProcess = customSliders || sliders;
      console.log('⚙️ Processing signal with sliders:', slidersToProcess);
      const response = await api.processSignal(sessionId, slidersToProcess);
      console.log('✓ Processing complete:', {
        output_length: response.output_length,
        max_magnitude: response.max_magnitude
      });

      // Update FFT data with processed result
      setFftData({
        frequencies: response.frequencies,
        magnitudes: response.magnitudes,
        length: response.frequencies.length,
      });

      // Fetch the updated output signal
      console.log('📊 Fetching updated output signal...');
      await fetchOutputSignal();
      console.log('✅ Output signal update complete');

      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, sliders, fetchOutputSignal]);

  /**
   * Add a new slider
   */
  const addSlider = useCallback((slider) => {
    const newSlider = {
      id: Date.now(),
      center_freq: slider?.center_freq || 1000,
      width: slider?.width || 200,
      gain: slider?.gain || 1.0,
    };
    setSliders((prev) => [...prev, newSlider]);
    return newSlider;
  }, []);

  /**
   * Update existing slider
   */
  const updateSlider = useCallback((id, updates) => {
    console.log('📝 useSignalProcessor: updateSlider called with:', { id, updates });
    setSliders((prev) => {
      const updated = prev.map((slider) =>
        slider.id === id ? { ...slider, ...updates } : slider
      );
      console.log('📝 Updated sliders state:', updated);
      return updated;
    });
  }, []);

  /**
   * Remove slider
   */
  const removeSlider = useCallback((id) => {
    setSliders((prev) => prev.filter((slider) => slider.id !== id));
  }, []);

  /**
   * Reset signal to original state
   */
  const reset = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      await api.resetSignal(sessionId);
      
      // Clear sliders and output
      setSliders([]);
      setOutputSignal(null);
      
      // Refresh input signal and FFT
      await Promise.all([
        fetchInputSignal(),
        fetchFFT(),
      ]);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, fetchInputSignal, fetchFFT]);

  /**
   * Save current configuration
   */
  const saveConfiguration = useCallback(async (configName, mode = 'generic') => {
    if (!sessionId) {
      throw new Error('No session available');
    }

    try {
      const config = {
        mode,
        sliders,
      };
      
      const response = await api.saveConfig(sessionId, configName, config);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [sessionId, sliders]);

  /**
   * Load configuration
   */
  const loadConfiguration = useCallback(async (configName) => {
    try {
      const response = await api.loadConfig(configName);
      
      // Apply loaded sliders
      if (response.config.sliders) {
        setSliders(response.config.sliders);
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * List all configurations
   */
  const listConfigurations = useCallback(async () => {
    try {
      const response = await api.listConfigs();
      return response.configs;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    // State
    sessionId,
    isLoading,
    error,
    signalInfo,
    inputSignal,
    outputSignal,
    fftData,
    sliders,

    // Actions
    uploadFile,
    createSynthetic,
    processSignal,
    addSlider,
    updateSlider,
    removeSlider,
    reset,
    saveConfiguration,
    loadConfiguration,
    listConfigurations,

    // Manual fetchers (if needed)
    fetchInputSignal,
    fetchOutputSignal,
    fetchFFT,
  };
}
