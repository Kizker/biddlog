const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.tsx') || file.endsWith('.css')) results.push(file);
  });
  return results;
}

const files = walk('src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/zoom:\s*0\.9;/g, '');
  content = content.replace(/font-size:\s*(\d+)px/g, (m, p1) => 'font-size: ' + (parseInt(p1) - 1) + 'px');
  content = content.replace(/fontSize:\s*'(\d+)px'/g, (m, p1) => 'fontSize: \'' + (parseInt(p1) - 1) + 'px\'');
  fs.writeFileSync(f, content);
});
console.log('Fonts reduced');
