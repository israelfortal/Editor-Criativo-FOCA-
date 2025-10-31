import React from 'react';
import { DownloadIcon } from './icons';

interface GeneratedImageCardProps {
  imageUrl: string;
  prompt: string;
}

const GeneratedImageCard: React.FC<GeneratedImageCardProps> = ({ imageUrl, prompt }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    
    // Create a filename from the prompt
    const safePrompt = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `gerado-${safePrompt || 'imagem'}.jpg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 animate-fade-in">
      <img src={imageUrl} alt={prompt} className="w-full h-full object-cover" />
      
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex flex-col items-center justify-center p-4">
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 p-2 bg-green-600 text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-green-700"
          aria-label="Baixar imagem"
        >
          <DownloadIcon className="w-5 h-5" />
        </button>
        <p className="text-white text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
          {prompt}
        </p>
      </div>
    </div>
  );
};

export default GeneratedImageCard;