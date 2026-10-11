// 在 node 中加载纯数据/生成器脚本
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={window:{},console,Math,Set,Array,Object,String,Number,JSON};ctx.window=ctx;vm.createContext(ctx);
['data.js','content.js','content2.js','content3.js','catalog.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',f),'utf8'),ctx,{filename:f}));
module.exports=ctx;
