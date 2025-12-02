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
                        {label} <br/> 
                        <span style={{ 
                            color: gains[index] > 0 ? '#00ff88' : gains[index] < 0 ? '#ff6b6b' : '#fff',
                            fontWeight: 'bold'
                        }}>
                            {gains[index].toFixed(1)} dB
                        </span>
                    </label>
                    <input
                        type="range"
                        min="-40" // Extended range: -40dB (near mute) to +20dB (boost)
                        max="20"
                        step="0.5"
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