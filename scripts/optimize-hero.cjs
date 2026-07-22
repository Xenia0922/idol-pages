// 一次性脚本：优化 hero 图与 logo（视觉无损，分辨率适配实际显示尺寸）
// hero-bg.webp: 2000x1501 308KB → 1600x1200 quality 90（opacity 0.22 背景下视觉无损）
// logo.png: 1080x1080 75KB → 256x256 quality 95（显示 96-128px，retina 2x 足够）
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');

async function run() {
  // 备份原图（若尚未备份）
  const heroOrig = path.join(pub, 'hero-bg-original.webp');
  if (!fs.existsSync(heroOrig)) {
    fs.copyFileSync(path.join(pub, 'hero-bg.webp'), heroOrig);
    console.log('backed up hero-bg.webp → hero-bg-original.webp');
  }
  const logoOrig = path.join(pub, 'logo-original.png');
  if (!fs.existsSync(logoOrig)) {
    fs.copyFileSync(path.join(pub, 'logo.png'), logoOrig);
    console.log('backed up logo.png → logo-original.png');
  }

  // hero-bg: 1600x1200, webp quality 90（视觉无损，opacity 0.22 下完全看不出区别）
  await sharp(heroOrig)
    .resize(1600, 1200, { fit: 'cover', position: 'center' })
    .webp({ quality: 90 })
    .toFile(path.join(pub, 'hero-bg.webp'));
  console.log('hero-bg.webp optimized');

  // logo: 256x256, png（保持透明通道，quality 95 视觉无损）
  await sharp(logoOrig)
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 95 })
    .toFile(path.join(pub, 'logo.png'));
  console.log('logo.png optimized');

  // 打印结果
  const heroSize = fs.statSync(path.join(pub, 'hero-bg.webp')).size;
  const logoSize = fs.statSync(path.join(pub, 'logo.png')).size;
  const heroOrigSize = fs.statSync(heroOrig).size;
  const logoOrigSize = fs.statSync(logoOrig).size;
  console.log(`hero-bg: ${(heroOrigSize/1024).toFixed(0)}KB → ${(heroSize/1024).toFixed(0)}KB (${(100 - heroSize/heroOrigSize*100).toFixed(0)}% smaller)`);
  console.log(`logo: ${(logoOrigSize/1024).toFixed(0)}KB → ${(logoSize/1024).toFixed(0)}KB (${(100 - logoSize/logoOrigSize*100).toFixed(0)}% smaller)`);
}

run().catch(e => { console.error(e); process.exit(1); });
