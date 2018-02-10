# wepy-plugin-mockdata

WePY MockServer模拟数据配置合并插件。实现在开发环境分JSON文件配置MockServer模拟数据。

## 安装

	npm install wepy-plugin-mockdata --save-dev

## 使用

在 `wepy.config.json` 配置文件中配置：

	  plugins: {
	    'mockdata': {
	      filter: new RegExp('mock.+index\\.js$')	    }
	  }
	  
## 配置

	{
	    src: 'src', //源文件目录，默认：'src'
	    dist: 'dist', //目标文件目录，默认：'dist'
	    filter: new RegExp('\w$'), //文件过滤，建议严格控制，以提升插件效率
	    rule: new RegExp('export\\sdefault\\s([a-zA-Z0-9_]+)'), //规则匹配，不建议修改
	    sourceMap: true, //是否开启sourceMap
	    empty: false, // 是否清空，比如不是开发环境的时候，清空mock data的配置
	    babelPlugins: [ // bale插件依赖和wepy.config.js中的 compilers.babel.plugins一致
	        'transform-class-properties',
	        'transform-decorators-legacy',
	        'transform-object-rest-spread',
	        'transform-export-extensions',
	    ]
	}
	
## 原理

- 扫描指定目录下所有JSON配置文件，创建一个map
- 将JSON配置merge到模块导出文件中，组装在一个总的配置文件

## 实例

### 文件结构

	├── mock
	│   ├── index.js
	│   └── mock_api
	│       ├── login.json
	│       └── user
	│           └── getUserInfo.json
	
### 插件处理结果
	
	├── mock
	│   └── index.js
	
#### 插件处理前index.js的内容

	let mockData = {
	  'test.do': {status: 9000}
	};
	export default mockData;
	
#### 插件处理后index.js的内容

	var mockData = {
	  'test.do': { status: 9000 }
	};
	mockData = Object.assign(mockData, { "mock_api/login": { "status": 0, "data": {} }, "mock_api/user/getUserInfo": { "userName": "jsonzhou" } });
	exports.default = mockData;

## 清空配置

一般mock data配置只用于本地开发环境，在其它测试或生产环境，需要剔除掉这部份配置，防止增加小程序应用包的大小。
	
	{
		"empty": true
	}
	
如上配置，给插件设置empty===true,就会清空mock data的配置。上文中的`index.js`内容就会被清空。

	var mockData = {};
	exports.default = {};