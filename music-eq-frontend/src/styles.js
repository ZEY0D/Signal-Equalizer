// src/styles.js

export const styles = {
    container: { 
        padding: "20px", 
        background: "#121212", 
        minHeight: "100vh", 
        color: "#eee", 
        fontFamily: "sans-serif" 
    },
    header: { 
        display: "flex", 
        gap: "20px", 
        alignItems: "center", 
        marginBottom: "20px" 
    },
    select: { 
        padding: "5px", 
        fontSize: "1rem", 
        borderRadius: "4px",
        backgroundColor: "#2e2e2e",
        color: "#eee",
        border: "1px solid #444"
    },
    sessionIdText: {
        fontSize: '0.8rem', 
        color: '#999',
        marginLeft: 'auto' // Pushes the ID to the right
    },
    grid: { 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", // Responsive grid
        gap: "20px", 
        // height: "400px" // Removing fixed height for responsiveness
    },
    card: { 
        background: "#1e1e1e", 
        borderRadius: "8px", 
        padding: "15px", 
        display: "flex", 
        flexDirection: "column",
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
    },
    sliderContainer: { 
        marginTop: "20px", 
        background: "#1e1e1e", 
        padding: "20px", 
        borderRadius: "8px",
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
    }
};