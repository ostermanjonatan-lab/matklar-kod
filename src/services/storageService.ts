import { getSupabase } from './supabaseClient';

export async function uploadRecipeFile(
  file: File,
  householdId: string = 'default'
): Promise<{ url: string; error?: string }> {
  const supabase = getSupabase();

  // If Supabase is connected, upload to storage bucket
  if (supabase) {
    try {
      const fileExt = file.name.split('.').pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = `${householdId}/${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('recipe-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Supabase storage upload error:', uploadError);
        // Fallback to local Data URL
        return { url: await fileToDataUrl(file) };
      }

      const { data } = supabase.storage.from('recipe-media').getPublicUrl(filePath);
      return { url: data.publicUrl };
    } catch (err: any) {
      console.warn('Storage upload failed, fallback to Data URL', err);
      return { url: await fileToDataUrl(file) };
    }
  }

  // Fallback: Return Base64 Data URL
  return { url: await fileToDataUrl(file) };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
