/**
 * Handles communication with the Gemini API, including Streaming.
 */
async function streamGeminiResponse(apiKey, model, history, systemInstruction, onChunk, onComplete, onError) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
    
    const payload = {
        contents: history,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
        }
    };

    if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `API Error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            // Parse the stream data (format: "data: {json}\n\n")
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6); // Remove "data: "
                        const json = JSON.parse(jsonStr);
                        const textChunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        
                        if (textChunk) {
                            fullText += textChunk;
                            onChunk(fullText);
                        }
                    } catch (e) {
                        // Ignore parsing errors for partial chunks
                    }
                }
            }
        }

        onComplete(fullText);

    } catch (error) {
        console.error("Stream Error:", error);
        onError(error.message);
    }
}
