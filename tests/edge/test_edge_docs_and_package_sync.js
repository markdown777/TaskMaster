const fs = require('fs');
const path = require('path');
const assert = require('assert');

/**
 * 读取 UTF-8 文本。
 * @param {string} filePath - 文件绝对路径。
 * @returns {string}
 */
function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 断言文本包含关键字。
 * @param {string} content - 文本内容。
 * @param {string} needle - 目标关键字。
 * @param {string} label - 断言标签。
 */
function expect(content, needle, label) {
  assert.ok(content.includes(needle), `${label} 缺少关键字: ${needle}`);
}

const edgeDir = path.resolve(__dirname, '../../edge-version');
const ps1 = read(path.join(edgeDir, 'package-edge.ps1'));
const readmeEdge = read(path.join(edgeDir, 'README-EDGE.md'));
const readme = read(path.join(edgeDir, 'README.md'));
const summary = read(path.join(edgeDir, 'EDGE-VERSION-SUMMARY.md'));
const guide = read(path.join(edgeDir, 'EDGE-STORE-SUBMISSION-GUIDE.md'));
const certificationNotes = read(path.join(edgeDir, 'NOTES_FOR_CERTIFICATION.txt'));

for (const token of [
  '"constants.js"',
  '"utils.js"',
  '"taskManager.js"',
  '"shareManager.js"',
  '"adapters"',
  '"services"',
  '"_locales"'
]) {
  expect(ps1, token, 'package-edge.ps1');
}

expect(ps1, 'TaskMaster-Edge-v3.5.0.zip', 'package-edge.ps1');

for (const doc of [
  [readmeEdge, '3.5.0', 'README-EDGE.md'],
  [readmeEdge, 'AI', 'README-EDGE.md'],
  [readmeEdge, '默认关闭', 'README-EDGE.md'],
  [readme, '3.5.0', 'README.md'],
  [summary, '3.5.0', 'EDGE-VERSION-SUMMARY.md'],
  [guide, 'TaskMaster-Edge-v3.5.0.zip', 'EDGE-STORE-SUBMISSION-GUIDE.md'],
  [guide, 'AI', 'EDGE-STORE-SUBMISSION-GUIDE.md'],
  [guide, '默认关闭', 'EDGE-STORE-SUBMISSION-GUIDE.md'],
  [certificationNotes, 'default and only syncs after the user manually enables it', 'NOTES_FOR_CERTIFICATION.txt']
]) {
  expect(doc[0], doc[1], doc[2]);
}

assert.ok(fs.existsSync(path.join(edgeDir, 'UPDATE_NOTES_v3.0.0_TO_v3.5.0.md')), '缺少中文升级说明');
assert.ok(fs.existsSync(path.join(edgeDir, 'UPDATE_NOTES_v3.0.0_TO_v3.5.0_EN.md')), '缺少英文升级说明');
assert.ok(fs.existsSync(path.join(edgeDir, 'Screenshot/README.md')), '缺少截图清单说明');

console.log('test_edge_docs_and_package_sync.js: PASS');
