import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

const fileToGenerativePart = (dataUrl: string) => {
  const mimeType = dataUrl.substring(dataUrl.indexOf(":") + 1, dataUrl.indexOf(";"));
  const base64Data = dataUrl.substring(dataUrl.indexOf(",") + 1);

  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
};

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imagePart = fileToGenerativePart(base64Image);
  const textPart = { text: prompt };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [imagePart, textPart],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64Data = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      return `data:${mimeType};base64,${base64Data}`;
    }
  }

  throw new Error("Nenhuma imagem foi retornada pela API.");
};

export const removeBackgroundWithGemini = async (base64Image: string): Promise<string> => {
  const prompt = "Please remove the background from this image. The main subject should be perfectly isolated. The new background must be transparent. Output the result as a PNG file.";
  
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imagePart = fileToGenerativePart(base64Image);
  const textPart = { text: prompt };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [imagePart, textPart],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64Data = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      if (mimeType !== 'image/png') {
          console.warn(`A API retornou ${mimeType} em vez de PNG para remoção de fundo. A transparência pode ser perdida.`);
      }
      return `data:${mimeType};base64,${base64Data}`;
    }
  }

  throw new Error("Nenhuma imagem foi retornada pela API durante a remoção de fundo.");
};


export const generateImageWithImagen = async (prompt: string, aspectRatio: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
    });
    
    const base64ImageBytes = response.generatedImages[0]?.image?.imageBytes;

    if (base64ImageBytes) {
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }

    throw new Error("Nenhuma imagem foi gerada pela API.");
};