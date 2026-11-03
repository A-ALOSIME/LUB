/** Render once at upload; list requests never decode a full-size image on the Worker. */
export async function imageThumbnail(file:File):Promise<File|null>{
 if(typeof createImageBitmap!=="function")return null;
 const bitmap=await createImageBitmap(file);
 try{const scale=Math.min(1,160/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext("2d");if(!context)return null;context.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));return blob&&blob.size<=65536?new File([blob],"thumbnail.png",{type:"image/png"}):null;}finally{bitmap.close();}
}
