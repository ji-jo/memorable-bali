import { readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const directory = path.join(process.cwd(), 'public', 'images', 'spots');
const files = (await readdir(directory)).filter((file) => file.endsWith('.jpg'));

for (const file of files) {
  const source = path.join(directory, file);
  const temporary = path.join(directory, `${file}.optimized`);

  await sharp(source)
    .rotate()
    .resize({ width: 1400, height: 980, fit: 'cover', position: 'attention', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(temporary);

  await rename(temporary, source);
  const sizeKb = Math.round((await stat(source)).size / 1024);
  console.log(`${file} ${sizeKb} KB`);
}
