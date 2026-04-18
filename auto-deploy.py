#!/usr/bin/env python3
"""
腾讯云服务器自动部署脚本
用法: python auto-deploy.py
"""

import paramiko
import sys
import os
import time
from getpass import getpass

HOST = "43.133.14.168"
USER = "root"
REMOTE_SCRIPT_PATH = "/tmp/deploy-remote.sh"
LOCAL_SCRIPT_PATH = "deploy-remote.sh"

def print_banner():
    print("=" * 50)
    print("  Safety Hazard Review System - Auto Deploy")
    print("=" * 50)
    print(f"  Target: {USER}@{HOST}")
    print("=" * 50)
    print()

def ssh_connect(password):
    """建立 SSH 连接"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[1/4] 正在连接 {HOST} ...")
    try:
        client.connect(HOST, username=USER, password=password, timeout=30)
        print("      连接成功!")
        return client
    except paramiko.AuthenticationException:
        print("[ERROR] 认证失败，请检查用户名和密码")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] 连接失败: {e}")
        sys.exit(1)

def upload_script(client):
    """上传部署脚本到服务器"""
    print(f"[2/4] 上传部署脚本到 {REMOTE_SCRIPT_PATH} ...")
    try:
        sftp = client.open_sftp()
        sftp.put(LOCAL_SCRIPT_PATH, REMOTE_SCRIPT_PATH)
        sftp.chmod(REMOTE_SCRIPT_PATH, 0o755)
        sftp.close()
        print("      上传完成!")
    except Exception as e:
        print(f"[ERROR] 上传失败: {e}")
        sys.exit(1)

def run_deploy(client):
    """在服务器上执行部署脚本"""
    print(f"[3/4] 在服务器上执行部署脚本 ...")
    print("      这可能需要 5-10 分钟，请耐心等待...")
    print("-" * 50)

    stdin, stdout, stderr = client.exec_command(
        f"sudo bash {REMOTE_SCRIPT_PATH}",
        get_pty=True
    )

    # 实时输出
    for line in iter(stdout.readline, ""):
        print(line, end="")

    # 检查错误输出
    err = stderr.read().decode()
    if err:
        print("-" * 50)
        print("[WARN] 错误输出:")
        print(err)

    exit_code = stdout.channel.recv_exit_status()
    return exit_code

def cleanup(client):
    """清理远程脚本"""
    print(f"[4/4] 清理临时文件 ...")
    try:
        client.exec_command(f"rm -f {REMOTE_SCRIPT_PATH}")
        print("      完成!")
    except:
        pass

def main():
    print_banner()

    # 检查本地脚本是否存在
    if not os.path.exists(LOCAL_SCRIPT_PATH):
        print(f"[ERROR] 本地脚本 {LOCAL_SCRIPT_PATH} 不存在")
        sys.exit(1)

    # 获取密码
    password = getpass(f"请输入 {USER}@{HOST} 的密码: ")
    if not password:
        print("[ERROR] 密码不能为空")
        sys.exit(1)

    print()

    # 执行部署流程
    client = None
    try:
        client = ssh_connect(password)
        upload_script(client)
        exit_code = run_deploy(client)
        cleanup(client)

        print()
        print("=" * 50)
        if exit_code == 0:
            print("  部署成功!")
            print(f"  访问地址: http://{HOST}")
            print("  管理员: admin / admin123")
        else:
            print(f"  部署脚本退出码: {exit_code}")
            print("  请检查上方输出排查问题")
        print("=" * 50)

    except KeyboardInterrupt:
        print("\n\n[ABORT] 用户中断部署")
    finally:
        if client:
            client.close()

if __name__ == "__main__":
    main()
