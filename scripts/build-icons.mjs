import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
// Crisp typography remains readable in a taskbar and at small terminal sizes.
const source = await readFile(new URL('../build/icon.svg', import.meta.url));
await writeFile(new URL('../build/icon.png', import.meta.url), await sharp(source).resize(1024, 1024).png().toBuffer());
await writeFile(new URL('../build/icon-preview.png', import.meta.url), await sharp(source).resize(256, 256).png().toBuffer());
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (let i = 0; i < images.length; i++) {
  const position = 6 + i * 16;
  header[position] = sizes[i] % 256; header[position + 1] = sizes[i] % 256;
  header.writeUInt16LE(1, position + 4); header.writeUInt16LE(32, position + 6);
  header.writeUInt32LE(images[i].length, position + 8); header.writeUInt32LE(offset, position + 12);
  offset += images[i].length;
}
await writeFile(new URL('../build/icon.ico', import.meta.url), Buffer.concat([header, ...images]));
const favicon = await sharp(source).resize(128, 128).png().toBuffer();
await writeFile(new URL('../public/favicon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><image width="128" height="128" href="data:image/png;base64,${favicon.toString('base64')}"/></svg>`);
console.log('Built IMPERIUM icons: PNG 1024 / preview 256 / Windows ICO 16–256 / embedded SVG favicon.');
