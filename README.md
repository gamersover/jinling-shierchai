# 金陵十二钗正册

在线阅读：**[jinling.caoqinping.com](https://jinling.caoqinping.com/)**

以《红楼梦》第五回中的金陵十二钗正册为内容，呈现可展开、翻阅、合卷的线装书。桌面端采用左图右判的对开布局，手机端依次呈现图叶与判词叶。十一组图判对应十二钗，钗黛合为一组。

## 内容与素材

- 判词、册中画意依程乙本第五回整理，异文和参考来源可在页面“关于此册”及“释文”中查看。
- 原文参考：[维基文库·红楼梦程乙本第一回至第十回](https://zh.wikisource.org/zh-hans/紅樓夢（程乙本）/第一回_至第十回)。
- 插画和判词书法字稿为本项目的 AI 视觉创作，不是古代原件或名家手迹。准确判词同时保留为可访问文本。
- 字体说明及完整授权文件见 `public/assets/fonts/`。GPL 字体的原字体与重建材料也保留在该目录的 `source/` 中。

## 运行

这是原生 HTML、CSS、JavaScript 静态网站，无 npm 依赖、后端服务、数据库或环境变量。

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory public
```

访问 <http://127.0.0.1:8765/>。网站运行所需图像和字体均在仓库中；文献来源链接在用户打开时跳转到外部网站。

## Vercel 部署

从 GitHub 导入仓库，项目根目录选本仓库根目录。`vercel.json` 已指定：

- Framework Preset：Other（`framework: null`）
- Build Command：留空，跳过构建
- Install Command：留空，不安装依赖
- Output Directory：`public`

不需要 `package.json`，不要把输出目录改为整个仓库，也不要提交包含所有图片的单文件离线 HTML。正常提交代码后，Vercel 的 Git 集成可生成部署。

官方说明：[跳过静态项目构建](https://vercel.com/docs/builds/configure-a-build#skip-build-step)、[vercel.json 配置](https://vercel.com/docs/project-configuration/vercel-json)。

绑定子域名时，先在 Vercel 项目中添加完整域名，再把 Vercel 为该项目给出的 DNS 记录填入现有 DNS 服务商；使用控制台显示的记录值，不预先写死 CNAME 目标。

## 目录

```text
public/
  index.html       页面入口
  style.css        基础样式
  antique.css      装帧和响应式样式
  content.js       十一组图判及来源
  motion.js        翻页动作
  app.js           阅读交互
  assets/          图画、书法、纸张和字体
vercel.json        无构建部署配置
```
