// // src/hooks/useBandsManager.js
// import { useState, useRef } from "react";
// import { useAudio } from "../../../contexts/AudioContext";

// export const useBandsManager = () => {
//   const { sliders, addSlider, updateSlider, removeSlider, clearAllSliders } =
//     useAudio();

//   const [selectedBand, setSelectedBand] = useState(null);
//   const [currentSelection, setCurrentSelection] = useState(null);
//   const bandRegionsRef = useRef(new Map());

//   // -------------------------
//   // Slider CRUD 
//   // -------------------------
//   const handleAddSlider = (sliderData = {}) => {
//     const newSlider = addSlider(sliderData);
//     return newSlider;
//   };

//   const handleUpdateSlider = (sliderId, updates) => {
//     updateSlider(sliderId, updates);

//     if (selectedBand && selectedBand.id === sliderId) {
//       const updatedBand = { ...selectedBand, ...updates };
//       setSelectedBand(updatedBand);

//       if (updates.centerFreq !== undefined || updates.width !== undefined) {
//         setCurrentSelection((prev) => {
//           if (!prev) return prev;

//           const newCenterFreq =
//             updates.centerFreq !== undefined
//               ? updates.centerFreq
//               : prev.centerFreq || selectedBand.centerFreq;
//           const newWidth =
//             updates.width !== undefined
//               ? updates.width
//               : prev.width || selectedBand.width;

//           const newSelection = {
//             ...prev,
//             centerFreq: newCenterFreq,
//             width: newWidth,
//             startFreq: Math.max(20, newCenterFreq - newWidth / 2),
//             endFreq: Math.min(20000, newCenterFreq + newWidth / 2),
//           };

//           // حفظ الـ region المحدث
//           bandRegionsRef.current.set(sliderId, newSelection);
//           return newSelection;
//         });
//       }
//     }
//   };

//   const handleRemoveSlider = (sliderId) => {
//     removeSlider(sliderId);
//     bandRegionsRef.current.delete(sliderId);

//     if (selectedBand && selectedBand.id === sliderId) {
//       setSelectedBand(null);
//       setCurrentSelection(null);
//     }
//   };

//   const handleClearAllSliders = () => {
//     clearAllSliders();
//     setSelectedBand(null);
//     setCurrentSelection(null);
//     bandRegionsRef.current.clear();
//   };

//   // -------------------------
//   // Band Selection
//   // -------------------------
//   const handleSelectBand = (band) => {
//     console.log("🎯 Selecting band:", band);
//     setSelectedBand(band);

//     const savedRegion = bandRegionsRef.current.get(band.id);
//     if (savedRegion) {
//       setCurrentSelection(savedRegion);
//       console.log("✅ Restored saved region:", savedRegion);
//     } else {
//       // إنشاء selection افتراضي من بيانات الـ band
//       const defaultSelection = {
//         centerFreq: band.centerFreq,
//         width: band.width,
//         startFreq: Math.max(20, band.centerFreq - band.width / 2),
//         endFreq: Math.min(20000, band.centerFreq + band.width / 2),
//         startSample: 0, // سيتم حسابها في الـ waveform
//         endSample: 0,
//       };
//       setCurrentSelection(defaultSelection);
//       console.log("⚠️ Created default selection:", defaultSelection);
//     }
//   };

//   const saveRegionForBand = (bandId, regionData) => {
//     console.log("💾 Saving region for band:", bandId, regionData);
//     bandRegionsRef.current.set(bandId, regionData);
//   };

//   const getRegionForBand = (bandId) => {
//     return bandRegionsRef.current.get(bandId);
//   };

//   // -------------------------
//   // Add New Band from Selection
//   // -------------------------
//   const handleAddNewBand = (selection) => {
//     if (!selection || selection.width <= 0) {
//       console.warn("Invalid selection for new band");
//       return null;
//     }

//     const newSlider = handleAddSlider({
//       centerFreq: selection.centerFreq,
//       width: selection.width,
//       gain: 1.0,
//       label: `Band ${sliders.length + 1}`,
//     });

//     setSelectedBand(newSlider);
//     setCurrentSelection(selection);
//     saveRegionForBand(newSlider.id, selection);

//     return newSlider;
//   };

//   // -------------------------
//   // Reset Gains
//   // -------------------------
//   const handleResetAllGains = () => {
//     sliders.forEach((slider) => {
//       handleUpdateSlider(slider.id, { gain: 1.0 });
//     });

//     if (selectedBand) {
//       setSelectedBand({ ...selectedBand, gain: 1.0 });
//     }
//   };

//   // -------------------------
//   // Save Settings as JSON
//   // -------------------------
//   const handleSaveSettings = () => {
//     const settings = {
//       mode: "generic",
//       sliders: sliders.map((slider) => ({
//         id: slider.id,
//         centerFreq: slider.centerFreq,
//         width: slider.width,
//         gain: slider.gain,
//         label: slider.label,
//       })),
//       regions: Array.from(bandRegionsRef.current.entries()).map(
//         ([id, region]) => ({
//           bandId: id,
//           ...region,
//         })
//       ),
//       timestamp: new Date().toISOString(),
//       version: "1.0",
//     };

//     const blob = new Blob([JSON.stringify(settings, null, 2)], {
//       type: "application/json",
//     });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `equalizer-settings-${new Date().getTime()}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);

//     console.log("💾 Settings saved:", settings);
//   };

//   return {
//     sliders, 
//     setSelectedBand,
//     currentSelection,
//     setCurrentSelection,
//     handleAddSlider,
//     handleUpdateSlider,
//     handleRemoveSlider,
//     handleClearAllSliders,
//     handleSelectBand,
//     handleAddNewBand,
//     handleResetAllGains,
//     handleSaveSettings,
//     saveRegionForBand,
//     getRegionForBand,
//     bandRegionsRef,
//   };
// };
// src/hooks/useBandsManager.js
import { useState, useRef } from "react"; 
import { useAudio } from "../../../contexts/AudioContext";


export const useBandsManager = () => {
  // استخدم الـ sliders من الـ Context مباشرةً بدل تكرارها
  const { 
    sliders, 
    addSlider, 
    updateSlider, 
    removeSlider, 
    clearAllSliders 
  } = useAudio();

  const [selectedBand, setSelectedBand] = useState(null);
  const [currentSelection, setCurrentSelection] = useState(null);
  const bandRegionsRef = useRef(new Map());

  // -------------------------
  // Slider CRUD - استخدم الـ Context functions مباشرةً
  // -------------------------
  const handleAddSlider = (sliderData = {}) => {
    const newSlider = addSlider(sliderData);
    return newSlider;
  };

  const handleUpdateSlider = (sliderId, updates) => {
    updateSlider(sliderId, updates);

    // ✅ تحديث الـ selectedBand لو هو نفس الـ slider
    if (selectedBand && selectedBand.id === sliderId) {
      const updatedBand = { ...selectedBand, ...updates };
      setSelectedBand(updatedBand);

      // تحديث الـ currentSelection
      if (updates.centerFreq !== undefined || updates.width !== undefined) {
        setCurrentSelection((prev) => {
          if (!prev) return prev;

          const newCenterFreq = updates.centerFreq !== undefined 
            ? updates.centerFreq 
            : prev.centerFreq || selectedBand.centerFreq;
          const newWidth = updates.width !== undefined 
            ? updates.width 
            : prev.width || selectedBand.width;
                const startFreq = Math.max(20, newCenterFreq - newWidth / 2);
    const endFreq = Math.min(20000, newCenterFreq + newWidth / 2);

                     const pixelWidth = 800;
    const startX = (startFreq / 20000) * pixelWidth;
    const endX = (endFreq / 20000) * pixelWidth;

    let startSample = 0;
    let endSample = 0;
    let sampleRate = prev.sampleRate || 44100;
    let totalSamples = prev.totalSamples || 88200;

    startSample = Math.floor((startX / pixelWidth) * totalSamples);
    endSample = Math.floor((endX / pixelWidth) * totalSamples);

          const newSelection = {
            ...prev,
            centerFreq: newCenterFreq,
            width: newWidth,
            startFreq,
      endFreq,
      start: startX,
      end: endX,
      startSample,
      endSample,
      sampleRate,
      totalSamples,
          };

          // حفظ الـ region المحدث
          bandRegionsRef.current.set(sliderId, newSelection);
          return newSelection;
        });
      }
    }
  };

  const handleRemoveSlider = (sliderId) => {
    removeSlider(sliderId);
    bandRegionsRef.current.delete(sliderId);

    if (selectedBand && selectedBand.id === sliderId) {
      setSelectedBand(null);
      setCurrentSelection(null);
    }
  };

  const handleClearAllSliders = () => {
    clearAllSliders();
    setSelectedBand(null);
    setCurrentSelection(null);
    bandRegionsRef.current.clear();
  };

  // -------------------------
  // Band Selection
  // -------------------------
  const handleSelectBand = (band, inputSignal = null) => {
    console.log("🎯 Selecting band:", band);
    setSelectedBand(band);

    const savedRegion = bandRegionsRef.current.get(band.id);
    if (savedRegion) {
      setCurrentSelection(savedRegion);
      console.log("✅ Restored saved region:", savedRegion);
    } else {
      // إنشاء selection افتراضي من بيانات الـ band مع حساب الـ samples
      const startFreq = Math.max(20, band.centerFreq - band.width / 2);
      const endFreq = Math.min(20000, band.centerFreq + band.width / 2);
      
      // حساب pixel positions
      const pixelWidth = 800;
      const startX = (startFreq / 20000) * pixelWidth;
      const endX = (endFreq / 20000) * pixelWidth;
      
      // حساب samples (نحتاج inputSignal)
      let startSample = 0;
      let endSample = 0;
      let sampleRate = 44100;
      let totalSamples = 88200;
      
      if (inputSignal) {
        totalSamples = inputSignal.length;
        sampleRate = inputSignal.sampleRate;
        startSample = Math.floor((startX / pixelWidth) * totalSamples);
        endSample = Math.floor((endX / pixelWidth) * totalSamples);
      }
      
      const defaultSelection = {
        centerFreq: band.centerFreq,
        width: band.width,
        startFreq,
        endFreq,
        start: startX,
        end: endX,
        startSample,
        endSample,
        sampleRate,
        totalSamples,
      };
      
      setCurrentSelection(defaultSelection);
      bandRegionsRef.current.set(band.id, defaultSelection);
      console.log("✅ Created default selection with samples:", defaultSelection);
    }
  };

  const saveRegionForBand = (bandId, regionData) => {
    console.log("💾 Saving region for band:", bandId, regionData);
    bandRegionsRef.current.set(bandId, regionData);
  };

  const getRegionForBand = (bandId) => {
    return bandRegionsRef.current.get(bandId);
  };

  // -------------------------
  // Add New Band from Selection
  // -------------------------
  const handleAddNewBand = (selection) => {
    if (!selection || selection.width <= 0) {
      console.warn("Invalid selection for new band");
      return null;
    }

    const newSlider = handleAddSlider({
      centerFreq: selection.centerFreq,
      width: selection.width,
      gain: 1.0,
      label: `Band ${sliders.length + 1}`,
    });

    setSelectedBand(newSlider);
    setCurrentSelection(selection);
    saveRegionForBand(newSlider.id, selection);

    return newSlider;
  };

  // -------------------------
  // Reset Gains
  // -------------------------
  const handleResetAllGains = () => {
    sliders.forEach((slider) => {
      handleUpdateSlider(slider.id, { gain: 1.0 });
    });

    if (selectedBand) {
      setSelectedBand({ ...selectedBand, gain: 1.0 });
    }
  };

  // -------------------------
  // Save Settings as JSON
  // -------------------------
  const handleSaveSettings = () => {
    const settings = {
      mode: "generic",
      sliders: sliders.map((slider) => ({
        id: slider.id,
        centerFreq: slider.centerFreq,
        width: slider.width,
        gain: slider.gain,
        label: slider.label,
      })),
      regions: Array.from(bandRegionsRef.current.entries()).map(([id, region]) => ({
        bandId: id,
        ...region,
      })),
      timestamp: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equalizer-settings-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("💾 Settings saved:", settings);
  };

  return {
    sliders, // من الـ Context
    selectedBand,
    setSelectedBand,
    currentSelection,
    setCurrentSelection,
    handleAddSlider,
    handleUpdateSlider,
    handleRemoveSlider,
    handleClearAllSliders,
    handleSelectBand,
    handleAddNewBand,
    handleResetAllGains,
    handleSaveSettings,
    saveRegionForBand,
    getRegionForBand,
    bandRegionsRef,
  };
};