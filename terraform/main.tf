terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1" # 東京
}

# 最新の Amazon Linux 2023 のAMIを SSM 経由で取得（名前フィルタより確実）
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# HTTP(80番) を外から開けるセキュリティグループ（デフォルトVPCに作られる）
resource "aws_security_group" "web" {
  name        = "hackathon-web-sg"
  description = "Allow HTTP inbound"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "web" {
  ami                         = data.aws_ssm_parameter.al2023.value
  instance_type               = "t3.micro" # ← ここを後でランダム化すれば「運」要素になる
  vpc_security_group_ids      = [aws_security_group.web.id]
  associate_public_ip_address = true

  # 起動時に1回だけ実行されるスクリプト(user_data)。
  # ここに「nginxを入れてHTMLを置く手順」を書いておく＝あなたの言う"マニュアル化"。
  # HTMLは base64 で埋め込むので、HTML内の記号でスクリプトが壊れる事故が起きない。
  #
  # 配信するのは backend が生成した my-app.html。
  # このHTMLは /vendor/react.development.js などを参照するが、これらのvendorファイルは
  # 合計約3.6MBあり user_data の16KB制限に収まらないため、起動時にCDN(unpkg)から取得する。
  user_data = <<-EOF
    #!/bin/bash
    set -e
    dnf install -y nginx
    systemctl enable --now nginx

    # 生成HTMLが参照する vendor ライブラリをCDNから配置（React/ReactDOMは18.3.1で固定）
    mkdir -p /usr/share/nginx/html/vendor
    curl -fsSL https://unpkg.com/react@18.3.1/umd/react.development.js        -o /usr/share/nginx/html/vendor/react.development.js
    curl -fsSL https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js -o /usr/share/nginx/html/vendor/react-dom.development.js
    curl -fsSL https://unpkg.com/@babel/standalone/babel.min.js               -o /usr/share/nginx/html/vendor/babel.min.js

    # 生成済みアプリHTMLを index.html として配置
    echo "${base64encode(file("${path.module}/../backend/generated/my-app.html"))}" | base64 -d > /usr/share/nginx/html/index.html

    systemctl restart nginx
  EOF

  tags = {
    Name = "hackathon-web"
  }
}

# 完成後にアクセスするURLを出力する
output "url" {
  value = "http://${aws_instance.web.public_ip}"
}