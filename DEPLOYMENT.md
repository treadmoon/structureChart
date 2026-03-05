# AWS EC2 & Docker 部署指南

本文档介绍如何将本项目的“网页版演示（Demo）”通过 Docker 部署到您的 AWS EC2 服务器，并使用 GitHub Actions 实现自动化 CI/CD。

## 1. 准备您的 AWS EC2 服务器

首先，请确保您的 EC2 服务器能够运行 Docker，并允许 HTTP 访问。

1. **登录 EC2 服务器**:
   ```bash
   ssh -i /path/to/your/key.pem [EC2_USERNAME]@[EC2_PUBLIC_IP]
   ```
2. **安装 Docker**:
   ```bash
   sudo apt update
   sudo apt install docker.io -y
   sudo systemctl start docker
   sudo systemctl enable docker
   # 将当前用户加入 docker 组以免每次都需要 sudo (部分系统可能需要重启以生效)
   sudo usermod -aG docker $USER
   ```
3. **开放安全组端口**:
   - 在 AWS 控制台中，定位到该 EC2 所使用的**安全组**。
   - 编辑入站规则（Inbound Rules），添加一条规则允许 `HTTP (TCP 端口 80)` 从 `0.0.0.0/0` 访问。

## 2. 配置 GitHub Actions 的 Repository Secrets

自动化工作流 (`.github/workflows/deploy.yml`) 需要通过 GitHub Secrets 的形式读取重要的验证信息才能成功将 Docker 镜像推送到 Docker Hub 并登录您的 AWS EC2 进行部署。

请前往您的 GitHub 仓库的 **Settings** -> **Secrets and variables** -> **Actions** 菜单，添加以下内容对应的 `New repository secret`：

| Secret 名称 | 说明 |
|-------------|------|
| `DOCKER_USERNAME` | 您的 Docker Hub 用户名 |
| `DOCKER_PASSWORD` | 您的 Docker Hub 个人访问令牌 (Personal Access Token) 或密码 |
| `EC2_HOST` | 您 AWS EC2 的公网 IP 地址 或 域名 |
| `EC2_USERNAME` | 您登录 EC2 的用户名 (通常是 `ubuntu`、`ec2-user` 或 `root`) |
| `EC2_SSH_KEY` | 您的 `.pem` 私钥的内容。请用记事本打开并完整复制所有内容（包含 `-----BEGIN RSA PRIVATE KEY-----` 等信息）。**强烈建议确保该密钥安全。** |

## 3. 部署流程与触发方式

1. **首次推送代码**: 在您完成所有文件的提交并 push 到 GitHub 仓库的主分支 (`main`) 后，GitHub Actions 会自动触发第一次打包。
2. **查看进度**: 您可以在仓库的 **Actions** 选项卡查看构建和推送到 Docker Hub 的记录状态。
3. **部署至 EC2**: 流水线在构建镜像后将执行远程 SSH 命令，连接您的 EC2 拉取最新的 docker 镜像，并在 80 端口启动容器。
4. **访问**: 当流水线出现绿色勾选（成功），您即可在浏览器中访问您的 `http://[EC2_PUBLIC_IP]` 查看在线版的 `structure-chart` 演示了！

## 手动调试命令 (如果在服务器本地测试)

如果不想立刻使用 CI/CD 流水线，您可以手动登录 AWS 服务器并使用以下命令克隆代码与运行：

```bash
git clone <您的仓库地址>
cd structure-chart
docker build -t structure-chart .
docker run -d -p 80:80 --name structure-chart structure-chart
```
