# 线上证书续期

这两个 systemd unit 已安装到 AWS 的 `/etc/systemd/system/`，并已启用 `wolf-game-cert-renew.timer`。每天检查狼人杀网站证书，证书续期成功后热重载 Nginx。只处理 `wolf.98.81.182.132.sslip.io` 的证书。

```sh
sudo systemctl list-timers wolf-game-cert-renew.timer
sudo systemctl status wolf-game-cert-renew.service
```

这些运维配置由管理员安装；普通 GitHub 应用发布不修改服务器 systemd 或 Nginx 配置。
