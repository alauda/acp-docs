## 文档依赖

* 确保本地已安装 [Node.js](https://nodejs.org/en/) 和 [npm](https://www.npmjs.com/)
* 使用 `yarn` 安装依赖

```bash
$ yarn install
```

* 推荐使用 [Visual Studio Code](https://code.visualstudio.com/) 编辑器并安装 [MDX](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx) 插件进行文档编写

## 文档快速开始

* `yarn dev`: 启动本地开发服务器，文件修改将实时更新。(**注意：** 左导航栏相关修改需要重启服务)
* `yarn build`: 构建生产环境代码，构建完成后会在 `dist` 目录生成静态文件
* `yarn serve`: 本地预览构建后的静态文件
