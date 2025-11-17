import JSZip from 'jszip';

type ProjectFile = {
  path: string;
  content: string;
};

/**
 * Downloads project files as a zip archive
 * @param files - Array of project files with path and content
 * @param projectName - Name of the project (used for zip filename)
 */
export async function downloadProjectAsZip(
  files: ProjectFile[],
  projectName: string
): Promise<void> {
  if (files.length === 0) {
    throw new Error('No files to download');
  }

  const zip = new JSZip();

  // Add all files to the zip
  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  // Generate the zip file
  const blob = await zip.generateAsync({ type: 'blob' });

  // Create a download link and trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(projectName)}.zip`;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sanitizes a filename by removing invalid characters
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 200);
}
