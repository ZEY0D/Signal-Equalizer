// // src/components/EqualizerSliders.jsx
// import React from "react"; 
// // تم حذف { useRef } لأننا لا نحتاجه، وهذا يزيل مصدر الخطأ.

// // Renamed from InstrumentSliders to be mode-agnostic

// export default function EqualizerSliders({ labels, onChange, disabled }) {
  
//   // تم حذف: const initialValues = useRef(labels.map(() => 0));

//   return (
//     <div style={{ display: "flex", justifyContent: "space-around" }}>
//       {labels.map((label, i) => (
//         <div key={label} style={{ textAlign: "center" }}>
//           <label style={{ display: "block", color: disabled ? '#555' : "#aaa", marginBottom: "10px" }}>
//             {label}
//           </label>
//           <input
//             type="range"
//             min={-20}
//             max={20}
//             step={1}
//             // القيمة الافتراضية أصبحت 0 مباشرة.
//             defaultValue={0} 
//             onMouseUp={(e) => onChange(i, Number(e.target.value))} // Fetch data only on release
//             disabled={disabled}
//             style={{ 
//                 cursor: disabled ? 'not-allowed' : "pointer",
//                 filter: disabled ? 'grayscale(100%)' : 'none'
//             }}
//           />
//           <div style={{fontSize: "0.8rem", color: "#666"}}>dB</div>
//         </div>
//       ))}
//     </div>
//   );
// }
import React from 'react';

// Component for the equalizer sliders.
const EqualizerSliders = ({ labels, onChange, disabled }) => {
    
    // Guard clause: Ensure labels is an array before proceeding
    if (!labels || !Array.isArray(labels) || labels.length === 0) {
        return (
            <div style={{ padding: '20px', color: '#999', textAlign: 'center' }}>
                Select a mode and load an audio file.
            </div>
        );
    }
    
    // State to hold the current gain value for each slider (0 is default/center)
    const [gains, setGains] = React.useState(labels.map(() => 0));

    // Handle change for a specific slider
    const handleSliderInput = (index, event) => {
        const newGains = [...gains];
        const value = parseFloat(event.target.value);
        newGains[index] = value;
        setGains(newGains);
        // Call the parent handler with the index and the new gain value
        onChange(index, value); 
    };
    
    // Reset gains when labels (mode) change
    React.useEffect(() => {
        // This effect runs whenever labels change, correctly initializing the gains state.
        setGains(labels.map(() => 0));
        // Note: App.jsx handles triggering the signal process with zero gain here.
    }, [labels]);

    const sliderStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: '0 10px',
        minWidth: '100px',
    };
    
    const inputStyle = {
        width: '80px', // Standard width for vertical range input
        height: '250px',
        writingMode: 'bt-lr', // Vertical orientation
        WebkitAppearance: 'slider-vertical', // Specific styling for vertical slider in some browsers
        cursor: 'pointer',
        background: '#333',
        borderRadius: '5px'
    };
    
    const containerStyle = {
        display: 'flex',
        justifyContent: 'space-around',
        padding: '20px',
        overflowX: 'auto'
    };

    return (
        <div style={containerStyle}>
            {labels.map((label, index) => (
                <div key={index} style={sliderStyle}>
                    <label style={{ marginBottom: '10px', color: '#ccc', textAlign: 'center' }}>
                        {label} <br/> (Gain: {gains[index].toFixed(1)} dB)
                    </label>
                    <input
                        type="range"
                        min="-10" // Define the range of gain (e.g., -10dB to +10dB)
                        max="10"
                        step="0.1"
                        value={gains[index]}
                        onChange={(e) => handleSliderInput(index, e)}
                        style={inputStyle}
                        disabled={disabled}
                    />
                </div>
            ))}
        </div>
    );
};

export default EqualizerSliders;