import React, { useState, useCallback, useEffect } from 'react';
import type { ImageFile, EditedImage } from './types';
import { fileToDataURL, preprocessImage } from './utils/fileUtils';
import { editImageWithGemini, generateImageWithImagen, removeBackgroundWithGemini } from './services/geminiService';
import ImageCard from './components/ImageCard';
import GeneratedImageCard from './components/GeneratedImageCard';
import { UploadIcon, SparklesIcon, SpinnerIcon, CutIcon } from './components/icons';

const presetPrompts: Record<string, string> = {
  'padrão': 'Aplique correções profissionais à imagem enviada. Melhore a iluminação, ajuste o contraste e equilibre as cores para um visual polido. Aplique um efeito de profundidade de campo rasa (bokeh) como se a foto tivesse sido tirada com uma lente de 80mm e abertura f/1.4. Garanta que o sujeito principal permaneça 100% nítido, enquanto o fundo é suavemente desfocado, criando uma transição gradual e sem bordas duras. Preserve as texturas naturais da pele e a nitidez dos olhos.',
  'desenho': 'Converta para desenho hiperdetalhado a lápis e carvão, com sombreamento realista e textura de grafite sobre papel',
};

const App: React.FC = () => {
  const [mode, setMode] = useState<'edit' | 'generate'>('edit');

  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [editedImages, setEditedImages] = useState<EditedImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<{ imageUrl: string; prompt: string }[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  
  const [prompt, setPrompt] = useState<string>('');
  
  // State for batch editing settings
  const [cropAspectRatio, setCropAspectRatio] = useState<string>(() => localStorage.getItem('cropAspectRatio') || 'original');
  const [resolution, setResolution] = useState<string>(() => localStorage.getItem('resolution') || 'original');
  const [ppi, setPpi] = useState<string>(() => localStorage.getItem('ppi') || '300');
  const [outputFormat, setOutputFormat] = useState<'jpg' | 'png' | 'webp'>(() => (localStorage.getItem('outputFormat') as 'jpg' | 'png' | 'webp') || 'jpg');

  // State for image generation settings
  const [generationAspectRatio, setGenerationAspectRatio] = useState<string>('1:1');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingSingleImage, setIsProcessingSingleImage] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Effects to save settings to localStorage
  useEffect(() => { localStorage.setItem('cropAspectRatio', cropAspectRatio); }, [cropAspectRatio]);
  useEffect(() => { localStorage.setItem('resolution', resolution); }, [resolution]);
  useEffect(() => { localStorage.setItem('ppi', ppi); }, [ppi]);
  useEffect(() => { localStorage.setItem('outputFormat', outputFormat); }, [outputFormat]);

  const processFiles = useCallback(async (files: FileList) => {
    const newImageFiles: ImageFile[] = await Promise.all(
      Array.from(files)
        .filter(file => file.type.startsWith('image/'))
        .map(async (file: File) => {
          const previewUrl = await fileToDataURL(file);
          return { id: `${file.name}-${Date.now()}`, file, previewUrl };
        })
    );
    if (newImageFiles.length > 0) {
      setImageFiles((prev) => [...prev, ...newImageFiles]);
    }
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleImageSelect = (id: string) => {
    setSelectedImageIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((imageId) => imageId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    setPrompt(presetPrompts[selectedValue] || '');
  };

  const handleEditImages = useCallback(async () => {
    const imagesToProcess = selectedImageIds.length > 0 ? selectedImageIds : imageFiles.map(f => f.id);
    if (imagesToProcess.length === 0 || !prompt) {
      setError('Por favor, selecione imagens e insira um prompt.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsProcessingSingleImage(Object.fromEntries(imagesToProcess.map(id => [id, true])));

    const editPromises = imagesToProcess.map(async (id) => {
      try {
        const imageFile = imageFiles.find((img) => img.id === id);
        if (!imageFile) return;

        const editedUrlFromGemini = await editImageWithGemini(imageFile.previewUrl, prompt);
        
        const finalUrl = await preprocessImage(editedUrlFromGemini, {
            aspectRatio: cropAspectRatio,
            resolution: resolution === 'original' ? undefined : parseInt(resolution),
            format: outputFormat,
        });

        setEditedImages((prev) => [...prev.filter(img => img.originalId !== id), { originalId: id, editedUrl: finalUrl }]);
      } catch (err) {
        console.error(`Falha ao editar a imagem ${id}:`, err);
        setError(`Falha ao editar a imagem ${imageFiles.find(f => f.id === id)?.file.name}.`);
      } finally {
         setIsProcessingSingleImage(prev => ({...prev, [id]: false}));
      }
    });

    await Promise.all(editPromises);
    setIsLoading(false);
    setSelectedImageIds([]);
  }, [selectedImageIds, prompt, imageFiles, cropAspectRatio, resolution, outputFormat]);

  const handleRemoveBackground = useCallback(async () => {
    if (selectedImageIds.length === 0) {
      setError('Por favor, selecione as imagens para remover o fundo.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsProcessingSingleImage(Object.fromEntries(selectedImageIds.map(id => [id, true])));

    const removePromises = selectedImageIds.map(async (id) => {
      try {
        const imageFile = imageFiles.find((img) => img.id === id);
        if (!imageFile) return;

        const transparentUrl = await removeBackgroundWithGemini(imageFile.previewUrl);
        
        setEditedImages((prev) => [...prev.filter(img => img.originalId !== id), { originalId: id, editedUrl: transparentUrl }]);
      } catch (err) {
        console.error(`Falha ao remover fundo da imagem ${id}:`, err);
        setError(`Falha ao remover fundo da imagem ${imageFiles.find(f => f.id === id)?.file.name}.`);
      } finally {
         setIsProcessingSingleImage(prev => ({...prev, [id]: false}));
      }
    });

    await Promise.all(removePromises);
    setIsLoading(false);
  }, [selectedImageIds, imageFiles]);


  const handleGenerateImage = useCallback(async () => {
    if (!prompt) {
      setError('Por favor, insira um prompt para gerar uma imagem.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const generatedUrl = await generateImageWithImagen(prompt, generationAspectRatio);
      setGeneratedImages((prev) => [{ imageUrl: generatedUrl, prompt }, ...prev]);
    } catch (err) {
      console.error('Falha ao gerar imagem:', err);
      setError('Ocorreu um erro ao gerar a imagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, generationAspectRatio]);

  const imagesToProcessCount = selectedImageIds.length > 0 ? selectedImageIds.length : imageFiles.length;

  return (
    <div className="bg-gray-900 min-h-screen text-white font-sans">
      <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-brand-primary">Editor Criativo FOCA!</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="flex border border-gray-700 rounded-md mb-6">
                  <button onClick={() => setMode('edit')} className={`flex-1 p-2 rounded-l-md transition-colors ${mode === 'edit' ? 'bg-brand-primary text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Editar em Lote</button>
                  <button onClick={() => setMode('generate')} className={`flex-1 p-2 rounded-r-md transition-colors ${mode === 'generate' ? 'bg-brand-primary text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Gerar Imagem</button>
              </div>

              {mode === 'edit' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-xl font-semibold mb-4 text-gray-200">1. Envie suas imagens</h2>
                    <label 
                      htmlFor="file-upload" 
                      className={`w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'bg-brand-primary/20 border-brand-primary' : 'border-gray-600 hover:bg-gray-700 hover:border-brand-primary'}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <UploadIcon className="w-10 h-10 text-gray-400 mb-2" />
                      <span className="text-gray-400 font-semibold text-center">
                          {isDragging ? 'Solte as imagens aqui!' : 'Arraste e solte ou clique para enviar'}
                      </span>
                       <span className="text-xs text-gray-500 mt-1">Selecione múltiplos arquivos</span>
                    </label>
                    <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                  </div>
                  <div>
                      <h2 className="text-xl font-semibold mb-4 text-gray-200">2. Descreva a Edição</h2>
                      <select onChange={handlePresetChange} defaultValue="" className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md mb-4">
                        <option value="" disabled>Selecione um filtro...</option>
                        <option value="padrão">1. Melhoria Padrão</option>
                        <option value="lente80mm">2. Efeito Lente 80mm f/1.4</option>
                        <option value="desenho">3. Desenho a Lápis</option>
                      </select>
                      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva sua edição..." className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md" rows={4} />
                  </div>
                  <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-300">3. Configurações de Saída</h3>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">Proporção</label>
                              <select value={cropAspectRatio} onChange={e => setCropAspectRatio(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                                  <option value="original">Original</option><option value="1:1">1:1</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="4:3">4:3</option><option value="3:4">3:4</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">Resolução</label>
                              <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                                <option value="original">Original</option><option value="3840">3840px</option><option value="1920">1920px</option><option value="1280">1280px</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">Densidade</label>
                              <select value={ppi} onChange={e => setPpi(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                                <option value="300">300 PPI</option><option value="150">150 PPI</option><option value="72">72 PPI</option>
                              </select>
                          </div>
                           <div>
                              <label className="block text-sm font-medium text-gray-400 mb-1">Formato</label>
                              <select value={outputFormat} onChange={e => setOutputFormat(e.target.value as any)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                                <option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WEBP</option>
                              </select>
                          </div>
                      </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <button onClick={handleEditImages} disabled={isLoading || imagesToProcessCount === 0 || !prompt} className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-3 px-4 rounded-md hover:bg-brand-primary/90 disabled:bg-gray-600 transition-colors">
                      {isLoading && <SpinnerIcon className="w-5 h-5" />}
                      {!isLoading && <SparklesIcon className="w-5 h-5" />}
                      Editar com Prompt ({imagesToProcessCount})
                    </button>
                     <button onClick={handleRemoveBackground} disabled={isLoading || selectedImageIds.length === 0} className="w-full flex items-center justify-center gap-2 bg-brand-secondary text-white font-bold py-3 px-4 rounded-md hover:bg-brand-secondary/90 disabled:bg-gray-600 transition-colors">
                      {isLoading ? <SpinnerIcon className="w-5 h-5" /> : <CutIcon className="w-5 h-5" />}
                      Remover Fundo ({selectedImageIds.length})
                    </button>
                  </div>
                </div>
              )}

              {mode === 'generate' && (
                  <div className="space-y-6 animate-fade-in">
                       <div>
                          <h2 className="text-xl font-semibold mb-4 text-gray-200">1. Descreva sua Ideia</h2>
                          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Um astronauta lendo um livro na lua, estilo Van Gogh..." className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md" rows={6} />
                       </div>
                       <div>
                            <h3 className="text-lg font-medium text-gray-300">2. Configurações</h3>
                            <label className="block text-sm font-medium text-gray-400 mb-1 mt-2">Proporção</label>
                            <select value={generationAspectRatio} onChange={(e) => setGenerationAspectRatio(e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md">
                                <option value="1:1">Quadrado (1:1)</option><option value="16:9">Paisagem (16:9)</option><option value="9:16">Retrato (9:16)</option>
                            </select>
                       </div>
                       <button onClick={handleGenerateImage} disabled={isLoading || !prompt} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-600">
                          {isLoading ? <SpinnerIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                          Gerar Imagem
                       </button>
                  </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm bg-red-900/50 p-3 rounded-md animate-fade-in">{error}</p>}
          </div>

          {/* Images Column */}
          <div className="lg:col-span-2 space-y-8">
            {mode === 'edit' && (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">Suas Imagens</h2>
                    {imageFiles.length > 0 && (
                        <div className="flex gap-4 text-sm">
                            <span className="text-gray-400">{selectedImageIds.length} / {imageFiles.length} selecionada(s)</span>
                            <button onClick={() => setSelectedImageIds(imageFiles.map(f => f.id))} className="hover:text-brand-light font-medium">Selecionar Todas</button>
                            <button onClick={() => setSelectedImageIds([])} className="hover:text-brand-light font-medium">Limpar Seleção</button>
                        </div>
                    )}
                </div>
                 {imageFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg p-12">
                     <UploadIcon className="w-16 h-16 mb-4" />
                    <h3 className="text-lg font-semibold">Nenhuma imagem enviada</h3>
                    <p>Use a área de upload para começar a editar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {imageFiles.map((img) => (
                      <ImageCard
                        key={img.id}
                        imageFile={img}
                        editedImage={editedImages.find((edited) => edited.originalId === img.id)}
                        isProcessingSingleImage={isProcessingSingleImage[img.id] || false}
                        isSelected={selectedImageIds.includes(img.id)}
                        onSelect={handleImageSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
             {mode === 'generate' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-semibold mb-4">Imagens Geradas</h2>
                {generatedImages.length === 0 ? (
                     <div className="flex flex-col items-center justify-center text-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg p-12">
                        <SparklesIcon className="w-16 h-16 mb-4" />
                        <h3 className="text-lg font-semibold">Nenhuma imagem gerada</h3>
                        <p>Use os controles para criar sua primeira imagem com IA.</p>
                     </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {generatedImages.map((genImg, index) => (
                            <GeneratedImageCard key={`${genImg.prompt}-${index}`} imageUrl={genImg.imageUrl} prompt={genImg.prompt} />
                        ))}
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;