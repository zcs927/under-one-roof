# 同一屋檐下 · 末日家人

一款可以在浏览器里玩的中文单人生存叙事游戏。停水、断电，门外是废城；妈妈、爸爸、姐姐和弟弟需要一起撑过100天。

## 怎么玩

- 点击屋里的人物，查看状态，主动给食物、水或药品。
- 选择家人外出搜集物资。有人会拒绝，也有人会受伤、空手归来，或者一直没有回来。
- 点击桌上的日记处理每日事件、查看当天小结和过往记录。
- 面对邻居求助、陌生人敲门和广播线索作出决定。帮助别人也可能被骗或遭遇抢劫。
- 留意人物的病容、绷带和饥饿表情。死亡不可逆，最后一名留守者不能外出。

游戏自动存档在当前浏览器。不同玩家的存档互不影响；换浏览器、清除网站数据或切换网址不会自动同步进度。没有账号、联网对战或付费功能。目前是持续开发中的原型。

## 本地运行

需要 Node.js 22 和 npm。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:5293。

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

## 免费发布到 GitHub Pages

本项目使用 Next.js App Router、React、TypeScript、Tailwind CSS 和 FontAwesome；游戏逻辑与存档在浏览器执行，可以导出为静态网站。

仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，推送 `main` 分支即可触发 `.github/workflows/pages.yml`。工作流会检查游戏并生成网页，成功后的试玩地址显示在该工作流和 Pages 设置页中。

如需部署到自己的静态服务器：

```sh
npm run build:static
```

上传生成的 `out/` 内容即可，无需在服务器安装 Node.js 或数据库。如果网址有子路径，请在构建前设置 `NEXT_PUBLIC_BASE_PATH`，例如 `/under-one-roof`；GitHub 工作流会自动读取 Pages 的路径。

## 项目结构

- `src/game/`：可复现的游戏规则与本地存档。
- `src/components/`：房间、人物、日记和剧情交互。
- `src/app/`：页面、样式和元信息。
- `public/images/`：本地生成的虚构人物及末日场景素材。
- `tests/`：生存、外出、剧情、配给、状态与存档规则测试。

玩法参考《60 Seconds!》的避难所决策形式，人物、中文剧情与美术为本项目制作，未使用该游戏的角色或素材。
