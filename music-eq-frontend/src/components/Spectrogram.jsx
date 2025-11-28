// import React from "react";

// export default function Spectrogram({ imageSrc }) {
//   return (
//     <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
//       {imageSrc ? (
//         <img 
//           src={`data:image/png;base64,${imageSrc}`} 
//           alt="Spectrogram" 
//           style={{ width: "100%", height: "100%", objectFit: "stretch" }} 
//         />
//       ) : (
//         <span style={{color: "#555"}}>No Signal Loaded</span>
//       )}
//     </div>
//   );
// }
import React from 'react';

// Placeholder component for the Spectrogram visualization.
const Spectrogram = ({ imageSrc, type }) => {
    // Basic styling for the image container and fallback text
    const style = {
        flexGrow: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#333',
        borderRadius: '4px',
        overflow: 'hidden',
        minHeight: '250px',
        position: 'relative'
    };
    
    const imgStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'cover' // Ensure the image covers the container
    };
    
    const fallbackStyle = {
        color: '#999',
        fontSize: '1rem',
        zIndex: 5
    };

    const typeLabelStyle = {
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: type === 'input' ? '#4A90E2' : '#F5A623',
        backgroundColor: 'rgba(30, 30, 30, 0.7)',
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        zIndex: 10
    }

    return (
        <div style={style}>
            <div style={typeLabelStyle}>{type.toUpperCase()} Spectrogram</div>
            {imageSrc ? (
                <img 
                    src={imageSrc} 
                    alt={`Spectrogram of the ${type} signal`} 
                    style={imgStyle}
                    // Add a key to force image reload when the source URL changes (due to processing)
                    key={imageSrc} 
                />
            ) : (
                <p style={fallbackStyle}>Spectrogram Image Not Available</p>
            )}
        </div>
    );
};

export default Spectrogram;