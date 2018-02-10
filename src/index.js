import path from 'path';
import fs from 'fs';

export default class {

    constructor(c = {}) {
        const def = {
            src: 'src', //源文件目录
            dist: 'dist', //目标文件目录
            filter: new RegExp('\w$'),
            rule: new RegExp('export\\sdefault\\s([a-zA-Z0-9_]+)'),
            sourceMap: true,
            empty: false, // 是否清空，比如不是开发环境的时候，清空mock data的配置
            babelPlugins: [ // 插件依赖和wepy.config.js中的 compilers.babel.plugins一致
                'transform-class-properties',
                'transform-decorators-legacy',
                'transform-object-rest-spread',
                'transform-export-extensions',
            ]
        };

        this.setting = Object.assign({}, def, c);
    }

    apply (op) {

        let setting = this.setting;

        //过滤文件
        if (!setting.filter.test(op.file)) {
            op.next();
            return;
        }

        let distRelativePath = path.relative(process.cwd(), op.file); //目标文件相对路径
        let sourceFile = path.join(this.setting.src, distRelativePath.substring(this.setting.dist.length)); //对应的源文件路径
        let spath = path.parse(sourceFile); //源路径解析

        let fileContent = this.readFile(sourceFile, op.error);
        if(!setting.rule.test(fileContent)){
            op.next();
            return;
        }

        // 匹配导出对象名称
        let res = fileContent.match(setting.rule);
        if(!res || !res.length){
            op.next();
            return;
        }
        let exportCode = res[0];
        let mockDataName = res[1];

        if (this.setting.empty) { // 非开发环境清空mock data配置
            fileContent = fileContent.replace(new RegExp(mockDataName + '\\s{1,}=\\s{1}{[\\s\\S]+\\}'), () => {
                return `${mockDataName} = {}`;
            });
            fileContent = fileContent.replace(exportCode, () => {
                return 'export default {}';
            });
        } else {
            let jsonFileList = this.walkJsonFile(path.join(process.cwd(), spath.dir)); //所有JSON文件列表
            let mockData = {};
            let self = this;
            jsonFileList.forEach((file) => {
                let jsonFile = self.readJsonFile(file);
                if (jsonFile) {
                    let fileRelativePath = path.relative(path.join(process.cwd(), spath.dir), file);
                    let fileKey = fileRelativePath.replace('.json','');
                    mockData[fileKey] = jsonFile;
                }
            });

            let mockDataStr = '{}';
            try {
                mockDataStr = JSON.stringify(mockData);
            } catch (e) {
                console.error('JSON.stringify(mockData) error',e);
            }
            let mergeCode = `${mockDataName} = Object.assign(${mockDataName}, ${mockDataStr});`;

            fileContent = fileContent.replace(exportCode, () => {
                return mergeCode + exportCode;
            });
        }

        let es5Code = this.transformEs5(fileContent, spath.name);

        op.output && op.output({
            action: '合并Mock配置',
            file: op.file
        });

        op.code = es5Code;
        op.next();
    }

    transformEs5 (es6Code,fileName) {
        let compileResult = null;
        let code = es6Code;
        try{
            compileResult = require("babel-core").transform(es6Code, {
                sourceMap: this.setting.sourceMap,
                presets: ["env"],
                plugins: this.setting.babelPlugins
            });
        }catch (e){
        }

        if(compileResult && compileResult.code){
            code = compileResult.code;
            let sourceMap = compileResult.map;
            if (sourceMap) {
                sourceMap.sources = [fileName];
                sourceMap.file = fileName;
                let Base64 = require('js-base64').Base64;
                code += `\r\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Base64.encode(JSON.stringify(sourceMap))}`;
            }
        }
        return code;
    }

    walkJsonFile (filePath) {
        let fileList = [];
        let walk = (filePath) => {
            try {
                let files = fs.readdirSync(filePath);
                files.forEach(function(filename){
                    let file = path.join(filePath, filename);
                    let stats = fs.statSync(file);
                    let isDir = stats.isDirectory();
                    if (isDir) {
                        walk(file);
                    } else {
                        if (/.+\.json$/.test(file)) { // JSON文件
                            fileList.push(file);
                        }
                    }
                });
            } catch (e) {
                console.error('文件遍历失败', path, e);
            }
        };
        walk(filePath);
        return fileList;
    }

    readFile (file,error) {
        let fileContent = '';
        try{
            fileContent = fs.readFileSync(file,'utf8');
        }catch(e) {
            error && error({err:'文件读取出错',file:file});
        }
        return fileContent;
    }

    readJsonFile (file) {
        let fileContent;
        try{
            fileContent = JSON.parse(fs.readFileSync(file,'utf8'));
        }catch(e) {
            console.error('文件读取失败', file, e);
        }
        return fileContent;
    }
}