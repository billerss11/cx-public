import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${name} must be an object`);
    }
}

function sortedKeys(obj) {
    return Object.keys(obj).sort((a, b) => a.localeCompare(b));
}

function diffKeys(fromKeys, toSet) {
    return fromKeys.filter(key => !toSet.has(key));
}

function failWithList(title, keys) {
    if (keys.length === 0) return;
    const preview = keys.slice(0, 20).join(', ');
    const suffix = keys.length > 20 ? ` ... (+${keys.length - 20} more)` : '';
    throw new Error(`${title}: ${preview}${suffix}`);
}

function readJson(relativePath) {
    const filePath = path.resolve(process.cwd(), relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(source);
}

// Comprehensive Chinese mojibake patterns (GBK/GB2312 displayed as UTF-8)
// These are common Chinese words that appear corrupted when encoding is wrong
const MOJIBAKE_PATTERNS = [
    /锘/g,                    // UTF-8 BOM misinterpreted as character
    /娴嬭瘯/g,                 // "测试" (test) mojibake
    /鏁版嵁/g,                 // "数据" (data) mojibake
    /绫诲瀷/g,                 // "类型" (type) mojibake
    /鍚嶇О/g,                 // "名称" (name) mojibake
    /澶栧緞/g,                 // "外径" (OD) mojibake
    /閲嶉噺/g,                 // "重量" (weight) mojibake
    /閽㈢骇/g,                 // "钢级" (grade) mojibake
    /椤舵繁/g,                 // "顶深" (top) mojibake
    /搴曟繁/g,                 // "底深" (bottom) mojibake
    /娣卞害/g,                 // "深度" (depth) mojibake
    /鏍囩/g,                  // "标签" (label) mojibake
    /棰滆壊/g,                 // "颜色" (color) mojibake
    /瀛椾綋/g,                 // "字体" (font) mojibake
    /澶у皬/g,                 // "大小" (size) mojibake
    /鏄剧ず/g,                 // "显示" (show) mojibake
    /鍖洪棿/g,                 // "区间" (interval) mojibake
    /鏍囨敞/g,                 // "标注" (annotation) mojibake
    /濂楃/g,                  // "套管" (casing) mojibake
    /鍙傝/g,                  // "参考" (reference) mojibake
    /灞備綅/g,                 // "层位" (horizon) mojibake
    /绾挎潯/g,                 // "线条" (line) mojibake
    /绾垮瀷/g,                 // "线型" (line style) mojibake
    /瀹炵嚎/g,                 // "实线" (solid) mojibake
    /铏氱嚎/g,                 // "虚线" (dash) mojibake
    /濉厖/g,                  // "填充" (fill) mojibake
    /澶囨敞/g,                 // "备注" (comment) mojibake
    /璇︽儏/g,                 // "详情" (detail) mojibake
    /瀵归綈/g,                 // "对齐" (align) mojibake
    /姘存偿/g,                 // "水泥" (cement) mojibake
    /妗ュ/g,                  // "桥塞" (bridge plug) mojibake
    /鏍囪/g,                  // "标记" (marker) mojibake
    /灏勫瓟/g,                 // "射孔" (perforation) mojibake
    /婕忓け/g,                 // "漏失" (leak) mojibake
    /涓や晶/g,                 // "两侧" (both sides) mojibake
    /宸︿晶/g,                 // "左侧" (left) mojibake
    /鍙充晶/g,                 // "右侧" (right) mojibake
    /渚у悜/g,                 // "侧向" (side) mojibake
    /缂╂斁/g,                 // "缩放" (scale) mojibake
    /鐜┖/g,                  // "环空" (annulus) mojibake
    /娴佷綋/g,                 // "流体" (fluid) mojibake
    /绾圭悊/g,                 // "纹理" (hatch) mojibake
    /鎵嬪姩/g,                 // "手动" (manual) mojibake
    /鑷姩/g,                  // "自动" (auto) mojibake
    /瀹藉害/g,                 // "宽度" (width) mojibake
    /浣嶇疆/g,                 // "位置" (position) mojibake
    /鍔犺浇/g,                 // "加载" (load) mojibake
    /淇濆瓨/g,                 // "保存" (save) mojibake
    /涓嬭浇/g,                 // "下载" (download) mojibake
    /瀵煎嚭/g,                 // "导出" (export) mojibake
    /瀵煎叆/g,                 // "导入" (import) mojibake
    /鏂囦欢/g,                 // "文件" (file) mojibake
    /琛ㄦ牸/g,                 // "表格" (table) mojibake
    /璁剧疆/g,                 // "设置" (settings) mojibake
    /閫夋嫨/g,                 // "选择" (select) mojibake
    /鍒犻櫎/g,                 // "删除" (delete) mojibake
    /娣诲姞/g,                 // "添加" (add) mojibake
    /缂栬緫/g,                 // "编辑" (edit) mojibake
    /鏍锋湰/g,                 // "样本" (sample) mojibake
    /榛樿/g,                  // "默认" (default) mojibake
    /鍥惧舰/g,                 // "图形" (graphic) mojibake
    /缁樺埗/g,                 // "绘制" (plot) mojibake
    /棰滆壊/g,                 // "颜色" (color) mojibake
    /鍗曚綅/g,                 // "单位" (unit) mojibake
    /鑻遍/g,                  // "英寸" (inch) mojibake
    /绫/g,                    // "米" (meter) mojibake - single character
    /鑻卞昂/g,                 // "英尺" (feet) mojibake
];

// UTF-8 BOM character
const UTF8_BOM = '\uFEFF';

function detectMojibakeInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        const warnings = [];

        // Check for UTF-8 BOM at file start
        if (content.startsWith(UTF8_BOM)) {
            warnings.push({
                line: 1,
                column: 1,
                type: 'BOM',
                text: 'UTF-8 BOM',
                context: 'File starts with UTF-8 BOM (byte order mark)'
            });
        }

        lines.forEach((line, index) => {
            MOJIBAKE_PATTERNS.forEach(pattern => {
                const matches = line.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        issues.push({
                            line: index + 1,
                            column: line.indexOf(match) + 1,
                            type: 'mojibake',
                            text: match,
                            context: line.trim().substring(0, 100)
                        });
                    });
                }
            });
        });

        return { issues, warnings };
    } catch (error) {
        console.warn(`Warning: Could not read ${filePath}: ${error.message}`);
        return { issues: [], warnings: [] };
    }
}

// Directories to exclude from scanning
const EXCLUDED_DIRS = [
    'node_modules',
    'dist',
    'release',
    '.git',
    '.cursor',
    'coverage',
    'build',
    'out'
];

function getAllFiles(dirPath, extensions, fileList = [], rootPath = null) {
    if (rootPath === null) rootPath = dirPath;
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Skip excluded directories and hidden directories
            if (!EXCLUDED_DIRS.includes(file) && !file.startsWith('.')) {
                getAllFiles(filePath, extensions, fileList, rootPath);
            }
        } else if (extensions.some(ext => file.endsWith(ext))) {
            // Skip this check script itself
            const relativePath = path.relative(rootPath, filePath);
            if (!relativePath.includes('check-i18n')) {
                fileList.push(filePath);
            }
        }
    });

    return fileList;
}

// ============================================================================
// i18n Locale Key Consistency Check
// ============================================================================
console.log('Checking i18n locale key consistency...');

const zh = readJson('src/locales/zh.json');
const en = readJson('src/locales/en.json');

ensureObject(zh, 'zh locale');
ensureObject(en, 'en locale');

const zhKeys = sortedKeys(zh);
const enKeys = sortedKeys(en);
const zhSet = new Set(zhKeys);
const enSet = new Set(enKeys);

failWithList('Missing in en', diffKeys(zhKeys, enSet));
failWithList('Missing in zh', diffKeys(enKeys, zhSet));

// Check locale files for encoding issues
const suspiciousPattern = /锘|�/;
const badEntries = [];
for (const [lang, dict] of Object.entries({ zh, en })) {
    for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== 'string') continue;
        if (suspiciousPattern.test(value)) {
            badEntries.push(`${lang}.${key}`);
        }
    }
}
failWithList('Suspicious encoding artifacts in locale files', badEntries);

console.log(`✓ i18n check passed (${zhKeys.length} keys per locale)`);

// ============================================================================
// Mojibake Detection in HTML and JS Files
// ============================================================================
console.log('\nScanning for mojibake in HTML and JS files...');
console.log(`Excluding folders: ${EXCLUDED_DIRS.join(', ')}`);

const projectRoot = path.resolve(__dirname, '..');
const htmlFiles = getAllFiles(projectRoot, ['.html']);
const jsFiles = getAllFiles(projectRoot, ['.js', '.mjs']);
const allFiles = [...htmlFiles, ...jsFiles];

let totalIssues = 0;
let totalWarnings = 0;
const filesWithIssues = [];
const filesWithWarnings = [];

allFiles.forEach(filePath => {
    const { issues, warnings } = detectMojibakeInFile(filePath);
    const relativePath = path.relative(projectRoot, filePath);
    
    if (issues.length > 0) {
        totalIssues += issues.length;
        filesWithIssues.push({ file: relativePath, items: issues });
    }
    
    if (warnings.length > 0) {
        totalWarnings += warnings.length;
        filesWithWarnings.push({ file: relativePath, items: warnings });
    }
});

let hasErrors = false;

if (filesWithWarnings.length > 0) {
    console.warn('\n⚠️  Encoding warnings:\n');
    filesWithWarnings.forEach(({ file, items }) => {
        console.warn(`📁 ${file}`);
        items.forEach(({ line, column, type, text, context }) => {
            console.warn(`   Line ${line}:${column} - ${text}`);
            console.warn(`   ${context}`);
        });
    });
    console.warn(`\n⚠️  Found ${totalWarnings} warning(s) in ${filesWithWarnings.length} file(s)`);
}

if (filesWithIssues.length > 0) {
    console.error('\n❌ Mojibake detected!\n');
    filesWithIssues.forEach(({ file, items }) => {
        console.error(`📁 ${file}`);
        items.forEach(({ line, column, text, context }) => {
            console.error(`   Line ${line}:${column} - "${text}"`);
            console.error(`   Context: ${context}`);
        });
    });
    console.error(`\n❌ Found ${totalIssues} mojibake issue(s) in ${filesWithIssues.length} file(s)`);
    hasErrors = true;
}

if (!hasErrors && filesWithWarnings.length === 0) {
    console.log(`✓ No mojibake detected in ${allFiles.length} files (${htmlFiles.length} HTML, ${jsFiles.length} JS)`);
}

if (hasErrors) {
    console.log('\n💡 Tip: Fix mojibake by converting files to UTF-8 encoding');
    process.exit(1);
}

console.log('\n✅ All checks passed!');
