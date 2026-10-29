import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import ts from "typescript";
import {expect,it} from "vitest";
function files(folder:string):string[]{return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(folder,entry.name)):[join(folder,entry.name)]).filter(file=>file.endsWith(".tsx")&&!file.includes(".test."));}
it("keeps static Arabic interface copy behind a locale selection or bilingual component",()=>{
 const missing:string[]=[];
 for(const file of files("src")){
  const content=readFileSync(file,"utf8");
  // Parse only files with a possible literal JSX text/attribute, retaining the full AST check below.
  if(!/(?:>[^<{}]*[\u0621-\u064a]|=\s*["'][^"'\r\n]*[\u0621-\u064a])/u.test(content))continue;
  const source=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node:ts.Node){
   const rawText=ts.isJsxText(node)&&/[\u0621-\u064a]/u.test(node.text);
   const rawAttribute=ts.isStringLiteral(node)&&ts.isJsxAttribute(node.parent)&&/[\u0621-\u064a]/u.test(node.text)&&!/(?:Ar|^ar)$/.test(node.parent.name.getText(source));
   // This aria-hidden wordmark is artwork; its accessible name stays ordinary searchable text.
   const brandArtwork=ts.isJsxText(node)&&ts.isJsxElement(node.parent)&&node.parent.openingElement.attributes.properties.some(attribute=>ts.isJsxAttribute(attribute)&&attribute.name.getText(source)==="className"&&attribute.initializer&&ts.isStringLiteral(attribute.initializer)&&attribute.initializer.text==="lub-brand-visual")&&node.parent.openingElement.attributes.properties.some(attribute=>ts.isJsxAttribute(attribute)&&attribute.name.getText(source)==="aria-hidden"&&attribute.initializer&&ts.isStringLiteral(attribute.initializer)&&attribute.initializer.text==="true");
   if((rawText||rawAttribute)&&!brandArtwork){let localized=false;for(let parent=node.parent;parent;parent=parent.parent){if(ts.isConditionalExpression(parent)&&/\ben\b|\blocale\b/.test(parent.condition.getText(source)))localized=true;}
    if(!localized)missing.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line+1}`);
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
 expect(missing).toEqual([]);
});
