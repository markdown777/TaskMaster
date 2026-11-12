# TaskMaster 项目规范

## Git 推送

- 每次推送都必须同时推送到 GitHub 与 Gitee，不允许只推一端。
- 先推 GitHub（HTTPS，需经本机 FlClash 代理；直连常出现 TCP 连接超时）：
  `git -c http.proxy=http://127.0.0.1:7890 -c credential.helper='!gh auth git-credential' push origin main`
  如果代理未运行导致失败，先启动 FlClash 再重试，不要改写远程地址。
- 再推 Gitee：
  `git push gitee main`
  （`gitee` 远程为 SSH：`git@gitee.com:laifupan/TaskMaster.git`；HTTPS 密码认证因 2FA 返回 403）
- `main` 的默认上游保持 `origin/main`，不要用 `-u` 把上游改成 `gitee/main`。
- 对 Gitee 禁止强制推送；两边出现分叉时用普通合并解决，再分别推送。
- 推送后核对两端指向同一提交：
  `git -c http.proxy=http://127.0.0.1:7890 ls-remote origin main` 与 `git ls-remote gitee main`
