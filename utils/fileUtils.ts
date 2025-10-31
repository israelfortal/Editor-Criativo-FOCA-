// Implemented file utility to convert File to data URL
export const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URL.'));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
};

export const preprocessImage = async (
  dataUrl: string,
  options: {
    aspectRatio?: string;
    resolution?: number;
    format?: 'jpg' | 'png' | 'webp';
  }
): Promise<string> => {
  const { aspectRatio, resolution, format = 'jpg' } = options;
  if (aspectRatio === 'original' && !resolution) {
    // Se não houver alteração de dimensão e o formato for o mesmo, retorne a original
    if ((format === 'jpg' && dataUrl.startsWith('data:image/jpeg')) || (format === 'png' && dataUrl.startsWith('data:image/png')) || (format === 'webp' && dataUrl.startsWith('data:image/webp'))) {
        return dataUrl;
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      // 1. Aplicar corte de proporção (centralizado)
      if (aspectRatio && aspectRatio !== 'original') {
        const [w, h] = aspectRatio.split(':').map(Number);
        const targetAspectRatio = w / h;
        const currentAspectRatio = img.width / img.height;

        if (targetAspectRatio > currentAspectRatio) {
          sourceHeight = img.width / targetAspectRatio;
          sourceY = (img.height - sourceHeight) / 2;
        } else {
          sourceWidth = img.height * targetAspectRatio;
          sourceX = (img.width - sourceWidth) / 2;
        }
      }

      // 2. Aplicar redimensionamento pela aresta maior
      let outputWidth = sourceWidth;
      let outputHeight = sourceHeight;
      if (resolution && resolution > 0) {
        if (outputWidth > outputHeight) {
          outputHeight = (outputHeight / outputWidth) * resolution;
          outputWidth = resolution;
        } else {
          outputWidth = (outputWidth / outputHeight) * resolution;
          outputHeight = resolution;
        }
      }
      
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      
      // 3. Aplicar formato de saída
      const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
      const quality = format === 'jpg' || format === 'webp' ? 0.92 : undefined;
      
      resolve(canvas.toDataURL(mimeType, quality));
    };
    img.onerror = (error) => reject(error);
    img.src = dataUrl;
  });
};
