
export interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

export interface EditedImage {
  originalId: string;
  editedUrl: string;
}
