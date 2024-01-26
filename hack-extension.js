const fs = require('fs');
const path = process.argv[2];

const js = fs.readFileSync(path, 'utf8');

const matches = js.match(/\(([a-zA-Z]+),"CopilotExtensionApi"\)/);
if (!matches) {
  throw new Error('Could not find extension api constructor [calculateInlineCompletions]');
}

const apiName = matches[1];
const apiReg = new RegExp(`var ${apiName}=class ${apiName}\\{constructor\\([a-zA-Z]\\)\\{this.ctx=`);

if (!fs.existsSync(path + '.bak')) {
  fs.copyFileSync(path, path + '.bak');
}

if (!apiReg.test(js)) {
  throw new Error('Could not find extension api constructor [apiReg]');
}

const replaced = js.replace(apiReg, (match) => {
  if (!match.includes('this.ctx=')) {
    throw new Error('Could not find extension api constructor [this.ctx=]');
  }

  const matches = js.match(/\(([a-zA-Z]+),"calculateInlineCompletions"\)/);
  if (!matches) {
    throw new Error('Could not find extension api constructor [calculateInlineCompletions]');
  }

  const name = matches[1];

  return match.replace('this.ctx=', `this.calculateInlineCompletions=${name};this.ctx=`);
});


fs.writeFileSync(path, replaced, 'utf8');

console.log(`replace ${path}`, js.length, replaced.length);
