import fs from 'node:fs'
import path from 'node:path'
import ts from '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'

const root='/mnt/data/diag/src'
const files=[]
function walk(dir){
  for (const name of fs.readdirSync(dir)){
    const p=path.join(dir,name)
    const st=fs.statSync(p)
    if(st.isDirectory()) walk(p)
    else if(/\.(js|jsx)$/.test(name)) files.push(p)
  }
}
walk(root)
let errors=0
for(const f of files){
  const text=fs.readFileSync(f,'utf8')
  const kind=f.endsWith('.jsx')?ts.ScriptKind.JSX:ts.ScriptKind.JS
  const sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,kind)
  const diags=sf.parseDiagnostics||[]
  if(diags.length){
    errors+=diags.length
    for(const d of diags) console.log('PARSE',f,d.messageText)
  }
}
console.log(`PARSE_SUMMARY files=${files.length} errors=${errors}`)

// Lightweight import path audit for relative imports.
const importRe=/from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g
let missing=0
for(const f of files){
  const text=fs.readFileSync(f,'utf8')
  for(const m of text.matchAll(importRe)){
    const spec=m[1]||m[2]
    const base=path.resolve(path.dirname(f),spec)
    const candidates=[base,base+'.js',base+'.jsx',path.join(base,'index.js'),path.join(base,'index.jsx')]
    if(!candidates.some(fs.existsSync)){
      console.log('MISSING_IMPORT',f,spec)
      missing++
    }
  }
}
console.log(`IMPORT_SUMMARY missing=${missing}`)
