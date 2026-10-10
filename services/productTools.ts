const colorMap: Record<string, string> = {
    'rojo': '#ef4444',
    'azul': '#3b82f6',
    'verde': '#22c55e',
    'amarillo': '#eab308',
    'negro': '#000000',
    'blanco': '#ffffff',
    'gris': '#6b7280',
    'rosado': '#ec4899',
    'morado': '#a855f7',
    'naranja': '#f97316',
    'café': '#78350f',
    'cafe': '#78350f',
    'beige': '#f5f5dc',
    'fucsia': '#ff00ff',
    'lila': '#c8a2c8',
    'celeste': '#87ceeb',
    'turquesa': '#40e0d0',
    'vinotinto': '#800000',
    'mostaza': '#ffdb58',
    'crema': '#fffdd0',
    'militar': '#4b5320',
    'petroleo': '#00606e',
};

export const getValidColor = (colorName: string) => {
    const lower = colorName.toLowerCase().trim();
    return colorMap[lower] || lower;
};

// --- AI Service ---
export const generateProductDescription = async (productName: string, imageUrl?: string): Promise<{ name: string, description: string } | string> => {
    try {
        const response = await fetch('/api/gemini/generate-description', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productName, imageUrl })
        });
        
        if (!response.ok) {
            try {
                const errData = await response.json();
                return `Error: ${errData.error || 'No se pudo generar la descripción.'}`;
            } catch (jsonErr) {
                return `Error: Servidor devolvió código de estado ${response.status}`;
            }
        }
        
        const data = await response.json();
        return {
            name: data.name,
            description: data.description
        };
    } catch (error: any) {
        console.error("Error generating AI description:", error);
        return `Error: ${error.message || "Error de conexión con el servidor."}`;
    }
};

