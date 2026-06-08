const fs = require('fs');
const path = require('path');
const assert = require('assert');

/**
 * 读取文本文件。
 * @param {string} filePath - 文件绝对路径。
 * @returns {string}
 */
function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 断言文本中包含指定片段。
 * @param {string} haystack - 原始文本。
 * @param {string} needle - 目标片段。
 * @param {string} label - 断言说明。
 */
function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label} 缺少: ${needle}`);
}

const edgeDir = path.resolve(__dirname, '../../edge-version');
const manifestPath = path.join(edgeDir, 'manifest.json');
const popupHtmlPath = path.join(edgeDir, 'popup.html');
const optionsHtmlPath = path.join(edgeDir, 'options.html');

const manifest = JSON.parse(read(manifestPath));
const popupHtml = read(popupHtmlPath);
const optionsHtml = read(optionsHtmlPath);

assert.strictEqual(manifest.version, '3.5.0', 'Edge manifest 版本号必须升级到 3.5.0');
assert.strictEqual(manifest.name, '__MSG_extName__', 'Edge manifest 必须保留多语言名称');
assert.strictEqual(manifest.description, '__MSG_extDesc__', 'Edge manifest 必须保留多语言描述');
assert.strictEqual(manifest.default_locale, 'en', 'Edge manifest 必须保留 default_locale');
assert.strictEqual(manifest.minimum_edge_version, '88', 'Edge manifest 必须保留最低 Edge 版本');
assert.strictEqual(manifest.action.default_popup, 'popup.html', '弹窗入口必须保持 popup.html');

assert.deepStrictEqual(
  manifest.permissions,
  ['storage', 'alarms', 'notifications', 'downloads'],
  '权限集合必须与已确认范围一致'
);

for (const requiredFile of [
  'adapters/storage.js',
  'adapters/crypto.js',
  'adapters/network.js',
  'services/ai.js',
  'constants.js',
  'utils.js',
  'taskManager.js',
  'shareManager.js',
  'popup.js',
  'options.js',
  'background.js'
]) {
  assert.ok(fs.existsSync(path.join(edgeDir, requiredFile)), `缺少运行时文件: ${requiredFile}`);
}

assertIncludes(popupHtml, '<button id="ai-toggle-btn"', 'popup.html');
assertIncludes(popupHtml, 'id="search-popover"', 'popup.html');
assertIncludes(popupHtml, '<script src="adapters/storage.js"></script>', 'popup.html');
assertIncludes(popupHtml, '<script src="adapters/crypto.js"></script>', 'popup.html');
assertIncludes(popupHtml, '<script src="adapters/network.js"></script>', 'popup.html');
assertIncludes(popupHtml, '<script src="services/ai.js"></script>', 'popup.html');
assertIncludes(popupHtml, 'id="pin-modal"', 'popup.html');

assertIncludes(optionsHtml, '<script src="adapters/storage.js"></script>', 'options.html');
assertIncludes(optionsHtml, '<script src="adapters/crypto.js"></script>', 'options.html');
assertIncludes(optionsHtml, 'id="aiProvider"', 'options.html');
assertIncludes(optionsHtml, 'id="visionProvider"', 'options.html');
assertIncludes(optionsHtml, '配置大语言模型接口', 'options.html');

console.log('test_edge_manifest_sync.js: PASS');
