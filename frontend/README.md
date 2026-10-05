# 狼人杀会员管理系统

Vue 3 + TypeScript + Pinia + Node.js + MySQL 8.4。会员、对局、玩家、操作记录、店铺设置、管理员账号和登录会话均保存在 MySQL。数据库没有演示数据种子；旧浏览器数据会自动移除，不会导入数据库。

## 本机启动

```sh
cd frontend
npm install
docker compose --env-file .env.mysql -f compose.mysql.yml up -d
npm run dev -- --port 5173 --strictPort
```

手机与电脑连接同一 Wi-Fi，访问 `http://电脑局域网IP:5173/`。页面首次进入和切换到前台时读取服务器数据，前台每 5 秒同步一次；保存操作完成后立即刷新数据。

本机已配置 `.env.local` 登录账号、`.env.mysql` 数据库凭据，文件权限为 600，已被 Git 忽略。换电脑部署时参考 `.env.example`，分别配置登录和数据库环境变量。管理员在空库首次启动时创建，密码以 scrypt 哈希保存；不要将更改环境变量当作已有账号的改密方式。

MySQL 容器为 `werewolf-mysql`，数据库为 `werewolf_members`，端口为 `127.0.0.1:3308`，不向局域网公开数据库端口。容器限制 512 MB 内存，缓冲池 128 MB，应用连接池最多 5 个连接，独立数据卷 `frontend_werewolf_mysql` 保存数据。停止容器不会清空数据；请保留该数据卷。

首次连接自动创建 members、records、games、seats、settings、users、sessions、migrations 表。一次性将旧登录会话迁移至 MySQL，以保留既有登录状态；此后会话以数据库为准，退出登录使对应会话失效。登录 cookie 有效期一年，每次访问登录状态接口自动续期，数据库会话没有自动到期时间。

## 功能

- 月卡、次卡、普通会员可添加、删除、转换；会员详情支持扣次、调整余额、查看记录。
- 月卡可添加一个自然月或选择有效期。未到期月卡从原有效期延长，已到期或新转换月卡从今天计算；月底日期自动适配。
- 普通会员无需有效期或次数。转换时替换卡片权益，保留会员身份和历史记录。
- 对局选择已有会员添加玩家，身份选填，玩家可编辑和删除；删除玩家与场次都需要确认。
- 删除会员保留历史操作记录和既有对局中的玩家姓名；删除场次级联清除该场次的玩家信息。
- 所有日期按当天计算；对局状态按东京时区的开始和结束时间动态计算，支持跨午夜。
- 服务器验证数据、登录状态和写请求来源；扣次和记录使用 MySQL 事务及行锁，避免多设备并发扣成负数。
- 保存失败会提示错误，页面不会将失败请求显示为保存成功。

## 生产运行

```sh
npm run build
npm start
```

生产服务器默认监听 `127.0.0.1:3000`。需要局域网访问时使用 `APP_HOST=0.0.0.0 npm start`；通过 HTTPS 访问时设置 `AUTH_SECURE_COOKIE=true`。开发和生产服务使用同一数据库配置。

## 检查与测试

```sh
npm run db:check
npm run test:auth
npm run test:data
npm run build
```

`test:data` 使用 `.env.mysql` 中的容器 root 凭据创建名称以 `werewolf_test_` 开头的独立临时数据库，测试后删除。覆盖接口鉴权、数据验证、并发扣次、类型转换、玩家增删、记录保留和服务重建后的持久化，不会清空正式数据库。

主要代码：`server/database.mjs`（表结构与 MySQL）、`server/api.mjs`（业务接口）、`server/auth.mjs`（认证）、`src/stores/data.ts`（动态数据）、`src/views/`（页面）、`src/style.css`（响应式样式）。
