const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

// Fix log_tail corruption
code = code.replace(/log_tail:function ScannerPanel/g, 'log_tail: [],\n};\n\nfunction ScannerPanel');

// Fix trailing divs
code = code.replace(/}\s*</div>\s*</g, '} <'); // rough cleanup
code = code.replace(/}  <\/div>\n    <\/section>\n  \);\n}/g, '');

fs.writeFileSync('src/main.tsx', code);
