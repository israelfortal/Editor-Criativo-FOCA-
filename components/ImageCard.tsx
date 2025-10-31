import React from 'react';
import type { ImageFile, EditedImage } from '../types';
import { SpinnerIcon, CheckCircleIcon, DownloadIcon } from './icons';

interface ImageCardProps {
  imageFile: ImageFile;
  editedImage: EditedImage | undefined;
  isProcessingSingleImage: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ 
  imageFile, 
  editedImage, 
  isProcessingSingleImage,
  isSelected,
  onSelect
}) => {
  const imageUrl = editedImage?.editedUrl || imageFile.previewUrl;
  const isEdited = !!editedImage;

  const selectionClasses = isSelected 
    ? 'ring-4 ring-offset-2 ring-offset-gray-900 ring-brand-primary' 
    : 'ring-2 ring-transparent';

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation(); // Impede que o clique no botão selecione o card
    if (!editedImage) return;

    const link = document.createElement('a');
    link.href = editedImage.editedUrl;

    const mimeType = editedImage.editedUrl.match(/data:image\/(\w+);/)?.[1] || 'jpg';
    const originalNameWithoutExt = imageFile.file.name.split('.').slice(0, -1).join('.');
    
    link.download = `editado-${originalNameWithoutExt || 'imagem'}.${mimeType}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className={`group relative aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:scale-105 animate-fade-in cursor-pointer ${selectionClasses}`}
      onClick={() => onSelect(imageFile.id)}
    >
      <img 
        src={imageUrl} 
        alt={imageFile.file.name} 
        className={`w-full h-full object-cover transition-opacity duration-300 ${isSelected ? 'opacity-80' : 'opacity-100'}`} 
      />
      
      {isSelected && (
         <div className="absolute top-2 left-2 text-white">
            <CheckCircleIcon className="w-7 h-7" />
        </div>
      )}

      {isProcessingSingleImage && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <SpinnerIcon className="w-8 h-8 text-brand-primary" />
        </div>
      )}

      {isEdited && !isProcessingSingleImage && (
        <>
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
              Editada
          </div>
          <button
            onClick={handleDownload}
            className="absolute bottom-2 right-2 p-2 bg-brand-secondary text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-brand-secondary/80"
            aria-label="Baixar imagem editada"
          >
            <DownloadIcon className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
};

export default ImageCard;