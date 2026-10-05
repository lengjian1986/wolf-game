# AWS 部署

入口：`https://wolf.98.81.182.132.sslip.io/`。

GitHub Actions 在 `main` 的应用或部署代码更新后运行，也可以手动触发。流程在 GitHub runner 中安装依赖、运行认证测试和临时 MySQL 数据库测试、构建 Vue 网站，然后使用专用 SSH 部署密钥发送发布包。

服务器为 Amazon Linux 2023，SSH 用户 `ec2-user`。项目目录 `/home/ec2-user/wolf-game`，应用端口 `127.0.0.1:20223`；Nginx 通过新域名转发到该端口。既有项目的 Nginx 配置和端口保持独立。

## 容器与配置

- Docker Compose 项目 `wolf-game`，容器 `wolf-game-app`、`wolf-game-mysql`。
- MySQL 数据卷 `wolf_game_mysql`；数据库端口只在容器网络内开放。
- MySQL 内存上限 512 MB，应用 256 MB，两者各限制 0.5 CPU。
- 服务器 `.env` 保存在 `/home/ec2-user/wolf-game/.env`，权限 600。包含独立数据库凭据和首次创建管理员的登录凭据，不放入发布包。
- 每个版本保存到 `releases/<commit-sha>/`，Docker 镜像标签为对应提交 SHA。
- `current-version` 保存当前成功发布版本，`previous-version` 保存上一次成功版本。
- 部署健康检查失败时，自动尝试恢复之前的应用镜像；数据库数据卷保留。

## GitHub Actions Secrets

`AWS_HOST`、`AWS_USER`、`AWS_SSH_KEY`、`AWS_KNOWN_HOSTS` 已配置在仓库中。部署密钥由系统单独生成，通过服务器 `authorized_keys` 的 forced command 限制为本项目部署操作；原 AWS `.pem` 密钥不上传至 GitHub。

服务器 `/usr/local/bin/wolf-game-deploy` 是 root 所有的部署入口，对应仓库 `deploy/deploy-remote.sh`。更新部署入口脚本时，需要管理员通过原 SSH 密钥重新安装；普通自动发布不会替换该入口。

Nginx 配置见 `nginx-http.conf`、`nginx-https.conf`，安装位置 `/etc/nginx/conf.d/wolf-game.conf`。TLS 证书由现有 Certbot 管理，自动续期。

## 手动检查与回滚

```sh
cd /home/ec2-user/wolf-game
export APP_VERSION=$(cat current-version)
docker compose --env-file .env -f releases/$APP_VERSION/deploy/compose.aws.yml ps
curl --fail http://127.0.0.1:20223/api/health
```

需要回滚应用时，管理员选择 `previous-version` 中的 SHA，并使用那个版本的 Compose 文件执行 `up -d --no-deps --wait app`；检查成功后更新 `current-version`。应用回滚不会逆向迁移数据库。

不要使用 `down -v` 清理部署，避免删除数据库。云端数据库和本机数据库是独立实例，发布代码不会持续同步两边的数据。线上使用以云端数据库为准。
