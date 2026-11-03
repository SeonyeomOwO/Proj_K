// 뉴 햄찌 광산을 공개 사이트의 new/ 폴더로 복사한다(기존판이 있는 저장소 맨 위 파일은 건드리지 않는다).
//   공개 주소: https://seonyeomowo.github.io/Proj_K/      → 기존판(그대로)
//              https://seonyeomowo.github.io/Proj_K/new/  → 뉴 햄찌 광산(이 도구가 만든 복사본)
// 게임이 실제로 내려받는 파일만 담는다: index.html, src/(테스트·미리보기 제외), data/*.js, assets/(작업 원본·묶음 제외).
// 저장은 브라우저 안에서 기존판('hamster-mining-web-v2')과 뉴 버전('hamster-mining-renewal-v1')이 다른 키를 쓰므로 섞이지 않는다.
//
// 사용법: node tools/publish-new.mjs   → new/ 를 새로 만들고, 빠진 파일이 있으면 실패(종료 코드 1)
// 그다음 new/ 폴더만 커밋해서 올린다. 저장소 맨 위의 src/app.js 등(작업 중인 뉴 버전 소스)은 커밋하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'new');
const rel = p => path.relative(root, p).replaceAll('\\', '/');

const SRC_SKIP = [/\.test\.mjs$/, /(^|\/)(rig-preview|shop-resources|mastery-preview)\.(js|css)$/, /^src\/intro\/preview\.(js|css)$/];
const ASSET_SKIP = [
  /\.(ttf|zip|md|txt|py)$/i,
  /^assets\/intro\/(?!web\/)/,                         // 인트로는 웹용 WebP만
  /^assets\/gacha\/v1\//, /^assets\/season-pass\/(download-package|resource-map)\.json$/,
  /^assets\/shop\/exported\/resources\.json$/, /^assets\/shop\/parts\.json$/
];
// PNG는 원본(작업용)이라 기본은 제외하고, 뉴 버전이 실행 중에 직접 읽는 그림만 넣는다.
const PNG_KEEP = [/^assets\/mining\//, /^assets\/village\//];

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

const files = ['index.html', 'hamster-mining.ico'];
for (const f of walk(path.join(root, 'src')).map(rel))
  if (!SRC_SKIP.some(r => r.test(f))) files.push(f);
for (const f of walk(path.join(root, 'data')).map(rel))
  if (f.endsWith('.js')) files.push(f);
for (const f of walk(path.join(root, 'assets')).map(rel)) {
  if (ASSET_SKIP.some(r => r.test(f))) continue;
  if (/\.png$/i.test(f) && !PNG_KEEP.some(r => r.test(f))) continue;
  files.push(f);
}

fs.rmSync(out, { recursive: true, force: true });
for (const f of files) {
  const to = path.join(out, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(root, f), to);
}

// 빠진 파일 검사: 코드·CSS·HTML이 문자열로 부르는 assets/·data/ 경로와 인트로가 쓰는 그림이 new/에 있어야 한다.
const missing = [];
for (const f of files.filter(f => /\.(js|css|html)$/.test(f))) {
  const text = fs.readFileSync(path.join(out, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const m of text.matchAll(/(?:\.\.\/|["'(\s])((?:assets|data)\/[A-Za-z0-9_\-./]+\.(?:webp|png|jpe?g|svg|woff2|json|js|ico))/g)) {
    const ref = m[1];
    if (/^assets\/intro\/(motion-v1|v1)\//.test(ref) && f.endsWith('storyboard.js')) continue;   // 변환 도구용 원본 경로
    if (ref.endsWith('.png') && f.endsWith('src/assets.js')) continue;                             // 도구 전용(master) 경로
    if (!fs.existsSync(path.join(out, ref))) missing.push(`${f} → ${ref}`);
  }
}
const intro = await import(pathToFileURL(path.join(out, 'src/intro/storyboard.js')).href);
for (const [key, file] of Object.entries(intro.ASSETS))
  if (!fs.existsSync(path.resolve(out, 'src/intro', file))) missing.push(`인트로 ${key} → ${file}`);
for (const manifest of ['assets/mining/manifest.json', 'assets/village/manifest.json']) {
  const m = JSON.parse(fs.readFileSync(path.join(out, manifest), 'utf8'));
  const paths = [...Object.values(m.props ?? {}).map(p => p.path), ...(m.assets ?? []).map(p => p.path)];
  for (const p of paths)
    if (!fs.existsSync(path.resolve(out, path.dirname(manifest), p))) missing.push(`${manifest} → ${p}`);
}

const bytes = files.reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log(`new/ 파일 ${files.length}개, ${(bytes / 1048576).toFixed(1)}MB`);
if (missing.length) {
  console.log('new/에 없는 참조 ' + missing.length + '개:\n' + [...new Set(missing)].join('\n'));
  process.exitCode = 1;
}
