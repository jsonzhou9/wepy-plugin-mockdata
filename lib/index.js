'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
    function _class() {
        var c = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, _class);

        var def = {
            src: 'src', //源文件目录
            dist: 'dist', //目标文件目录
            filter: new RegExp('\w$'),
            rule: new RegExp('export\\sdefault\\s([a-zA-Z0-9_]+)'),
            sourceMap: true,
            empty: false, // 是否清空，比如不是开发环境的时候，清空mock data的配置
            babelPlugins: [// 插件依赖和wepy.config.js中的 compilers.babel.plugins一致
            'transform-class-properties', 'transform-decorators-legacy', 'transform-object-rest-spread', 'transform-export-extensions']
        };

        this.setting = Object.assign({}, def, c);
    }

    _createClass(_class, [{
        key: 'apply',
        value: function apply(op) {

            var setting = this.setting;

            //过滤文件
            if (!setting.filter.test(op.file)) {
                op.next();
                return;
            }

            var distRelativePath = _path2.default.relative(process.cwd(), op.file); //目标文件相对路径
            var sourceFile = _path2.default.join(this.setting.src, distRelativePath.substring(this.setting.dist.length)); //对应的源文件路径
            var spath = _path2.default.parse(sourceFile); //源路径解析

            var fileContent = this.readFile(sourceFile, op.error);
            if (!setting.rule.test(fileContent)) {
                op.next();
                return;
            }

            // 匹配导出对象名称
            var res = fileContent.match(setting.rule);
            if (!res || !res.length) {
                op.next();
                return;
            }
            var exportCode = res[0];
            var mockDataName = res[1];

            if (this.setting.empty) {
                // 非开发环境清空mock data配置
                fileContent = fileContent.replace(new RegExp(mockDataName + '\\s{1,}=\\s{1}{[\\s\\S]+\\}'), function () {
                    return mockDataName + ' = {}';
                });
                fileContent = fileContent.replace(exportCode, function () {
                    return 'export default {}';
                });
            } else {
                var jsonFileList = this.walkJsonFile(_path2.default.join(process.cwd(), spath.dir)); //所有JSON文件列表
                var mockData = {};
                var self = this;
                jsonFileList.forEach(function (file) {
                    var jsonFile = self.readJsonFile(file);
                    if (jsonFile) {
                        var fileRelativePath = _path2.default.relative(_path2.default.join(process.cwd(), spath.dir), file);
                        var fileKey = fileRelativePath.replace('.json', '');
                        mockData[fileKey] = jsonFile;
                    }
                });

                var mockDataStr = '{}';
                try {
                    mockDataStr = JSON.stringify(mockData);
                } catch (e) {
                    console.error('JSON.stringify(mockData) error', e);
                }
                var mergeCode = mockDataName + ' = Object.assign(' + mockDataName + ', ' + mockDataStr + ');';

                fileContent = fileContent.replace(exportCode, function () {
                    return mergeCode + exportCode;
                });
            }

            var es5Code = this.transformEs5(fileContent, spath.name);

            op.output && op.output({
                action: '合并Mock配置',
                file: op.file
            });

            op.code = es5Code;
            op.next();
        }
    }, {
        key: 'transformEs5',
        value: function transformEs5(es6Code, fileName) {
            var compileResult = null;
            var code = es6Code;
            try {
                compileResult = require("babel-core").transform(es6Code, {
                    sourceMap: this.setting.sourceMap,
                    presets: ["env"],
                    plugins: this.setting.babelPlugins
                });
            } catch (e) {}

            if (compileResult && compileResult.code) {
                code = compileResult.code;
                var sourceMap = compileResult.map;
                if (sourceMap) {
                    sourceMap.sources = [fileName];
                    sourceMap.file = fileName;
                    var Base64 = require('js-base64').Base64;
                    code += '\r\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + Base64.encode(JSON.stringify(sourceMap));
                }
            }
            return code;
        }
    }, {
        key: 'walkJsonFile',
        value: function walkJsonFile(filePath) {
            var fileList = [];
            var walk = function walk(filePath) {
                try {
                    var files = _fs2.default.readdirSync(filePath);
                    files.forEach(function (filename) {
                        var file = _path2.default.join(filePath, filename);
                        var stats = _fs2.default.statSync(file);
                        var isDir = stats.isDirectory();
                        if (isDir) {
                            walk(file);
                        } else {
                            if (/.+\.json$/.test(file)) {
                                // JSON文件
                                fileList.push(file);
                            }
                        }
                    });
                } catch (e) {
                    console.error('文件遍历失败', _path2.default, e);
                }
            };
            walk(filePath);
            return fileList;
        }
    }, {
        key: 'readFile',
        value: function readFile(file, error) {
            var fileContent = '';
            try {
                fileContent = _fs2.default.readFileSync(file, 'utf8');
            } catch (e) {
                error && error({ err: '文件读取出错', file: file });
            }
            return fileContent;
        }
    }, {
        key: 'readJsonFile',
        value: function readJsonFile(file) {
            var fileContent = void 0;
            try {
                fileContent = JSON.parse(_fs2.default.readFileSync(file, 'utf8'));
            } catch (e) {
                console.error('文件读取失败', file, e);
            }
            return fileContent;
        }
    }]);

    return _class;
}();

exports.default = _class;
//# sourceMappingURL=index.js.map